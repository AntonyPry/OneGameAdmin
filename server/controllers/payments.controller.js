// controllers/payments.controller.js
const dotenv = require('dotenv');
const axios = require('axios');
const ExcelJS = require('exceljs');
const { FAKE_PAYMENTS } = require('../consts/fakePayments');
const https = require('https');

dotenv.config();

const agent = new https.Agent({
  rejectUnauthorized: false, // Отключает проверку сертификата
});

const paymentsFromPeriod = async (req, res) => {
  let { startDate, endDate, clubId } = req.body;
  if (!clubId) clubId = 6816;

  const resultsArray = await getResultsArray(startDate, endDate, clubId);
  if (resultsArray.error) {
    console.log(`Ошибка при получении данных для клуба ${clubId}:`, resultsArray.message);
    return res.status(400).send(resultsArray);
  }

  const xlsxBuffer = await generatePaymentsXlsx(resultsArray.sort((a, b) => (a.idForSort > b.idForSort ? 1 : -1)));
  res.setHeader('Content-Disposition', `attachment; filename=payments_${Date.now}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(xlsxBuffer);
};

const getResultsArray = async (startDate, endDate, clubId) => {
  try {
    const managerBearer = await getSmartshellManagerBearer(clubId);
    if (managerBearer.error) {
      console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
      return managerBearer;
    }

    const dataBasicPayments = await getPaymentData(startDate, endDate, managerBearer);
    if (dataBasicPayments.error) {
      console.log(`Ошибка при получении данных об оплатах для клуба ${clubId}:`, dataBasicPayments.message);
      return dataBasicPayments;
    }

    const dataSbpPayments = await getSbpData(startDate, endDate, managerBearer);
    if (dataSbpPayments.error) {
      console.log(`Ошибка при получении пополненй по СБП для клуба ${clubId}:`, dataSbpPayments.message);
      return dataSbpPayments;
    }

    const dataTariffPerMinutePayments = await getTariffPerMinuteData(startDate, endDate, managerBearer);
    if (dataTariffPerMinutePayments.error) {
      console.log(`Ошибка при получении поминутных тарифов для клуба ${clubId}:`, dataTariffPerMinutePayments.message);
      return dataTariffPerMinutePayments;
    }

    const dataBonusPayments = await getBonusData(startDate, endDate, managerBearer);
    if (getBonusData.error) {
      console.log(`Ошибка при получении начисления бонусов для клуба ${clubId}:`, getBonusData.message);
      return getBonusData;
    }

    const paymentRefundData = await getPaymentRefundData(startDate, endDate, managerBearer);
    if (paymentRefundData.error) {
      console.log(`Ошибка при получении отмененных платежей ${clubId}:`, paymentRefundData.message);
      return paymentRefundData;
    }

    const resultsArray = [
      ...dataBasicPayments?.result,
      ...dataSbpPayments?.result,
      ...dataTariffPerMinutePayments?.result,
      ...dataBonusPayments?.result,
      ...paymentRefundData?.result,
    ];

    return resultsArray;
  } catch (error) {
    console.log('getResultsArray ERROR ->', error);
    return { error: true, message: error.message };
  }
};

const sbpFromPeriod = async (req, res) => {
  try {
    let { startDate, endDate, clubId } = req.body;
    if (!clubId) clubId = 6816;

    const managerBearer = await getSmartshellManagerBearer(clubId);
    if (managerBearer.error) {
      console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
      return res.status(400).send(managerBearer);
    }

    const data = await getSbpData(startDate, endDate, managerBearer);
    if (data.error) {
      console.log(`Ошибка при получении даннх по СБП для клуба ${clubId}:`, data.message);
      return res.status(400).send(data);
    } else {
      const xlsxBuffer = await generateSbpXlsx(data.result);

      res.setHeader('Content-Disposition', `attachment; filename=payments_${Date.now}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(xlsxBuffer);
    }
    // return res.status(200).send(data.result);
  } catch (error) {
    console.log('paymentsFromPeriod ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const cashOrdersFromPeriod = async (req, res) => {
  try {
    let { startDate, endDate, clubId } = req.body;
    if (!clubId) clubId = 6816;

    const managerBearer = await getSmartshellManagerBearer(clubId);
    if (managerBearer.error) {
      console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
      return res.status(400).send(managerBearer);
    }

    const data = await getCashOrders(startDate, endDate, managerBearer);
    if (data.error) {
      console.log(`Ошибка при получении даннх о кассовых ордерах клуба ${clubId}:`, data.message);
      return res.status(400).send(data);
    } else {
      const xlsxBuffer = await generateCashOrdersXlsx(data.result);

      res.setHeader('Content-Disposition', `attachment; filename=payments_${Date.now}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(xlsxBuffer);
    }
    // return res.status(200).send(data.result);
  } catch (error) {
    console.log('cashOrdersFromPeriod ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const getSmartshellManagerBearer = async (clubId = 6816) => {
  const dataManagerLogin = {
    query: `mutation Login {
          login(
              input: { login: "79216855543", password: "Toshka3g39!", company_id: ${clubId} }
          ) {
              access_token
          }
      }`,
  };

  try {
    const res = await axios({
      method: 'post',
      url: `https://billing.smartshell.gg/api/graphql`,
      data: dataManagerLogin,
      httpsAgent: agent,
    });

    if (res.data.errors) {
      res.data.errors.map((error) => console.log(login, 'getSmartshellManagerBearer ERROR ->', error.message));
      return { error: true, message: 'Не удалось получить данные от smartshell' };
    } else {
      return res.data.data.login.access_token;
    }
  } catch (error) {
    console.log('getSmartshellManagerBearer ERROR ->', error.message);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const getPaymentData = async (startDate, endDate, managerBearer) => {
  try {
    let page = 1;
    let smartshellPaymentsDataRequest = createSmartshellPaymentsDataRequest(startDate, endDate, page, managerBearer);

    let result = [];
    let resPaymentsData = await axios(smartshellPaymentsDataRequest);

    if (resPaymentsData.data.errors) {
      resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об оплатах' };
    } else {
      resPaymentsData.data.data.eventList.data.forEach((payment) => {
        for (let i = 0; i < payment.payment_items.length; i++) {
          result = [
            ...result,
            {
              idForSort: parseInt(
                payment.timestamp.split(' ')[0].split('-').join('') +
                  payment.timestamp.split(' ')[1].split(':').join('')
              ),
              id: payment.payment.id,
              type: FAKE_PAYMENTS.includes(payment.payment.id.toString())
                ? 'FAKE'
                : payment?.payment_items[i]?.title?.includes('PS') ||
                  payment?.payment_items[i]?.title?.includes('Ps') ||
                  payment?.payment_items[i]?.title?.includes('ps')
                ? 'PS'
                : payment?.payment_items[i]?.title?.includes('Кресло')
                ? 'RACEZONE'
                : payment.payment_items[i].entity_type
                ? payment.payment_items[i].entity_type
                : 'TARIFF',
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              nickname: payment.client?.nickname ? payment.client?.nickname : null,
              title: payment.payment_items[i].title ? payment.payment_items[i].title : 'Пополнение депозита',
              amount: payment.payment_items[i].amount,
              sum:
                payment.payment.title === 'DEPOSIT'
                  ? Math.floor(payment.payment_items[i].sum - payment.value1)
                  : Math.floor(payment.payment_items[i].sum),
              bonus: Math.floor(payment.value1),
              payment_title: payment.payment.title,
              operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
            },
          ];
        }
      });
      while (resPaymentsData.data.data.eventList.paginatorInfo.lastPage > page) {
        page += 1;
        let smartshellPaymentsDataRequest = createSmartshellPaymentsDataRequest(
          startDate,
          endDate,
          page,
          managerBearer
        );
        resPaymentsData = await axios(smartshellPaymentsDataRequest);
        if (resPaymentsData.data.errors) {
          resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные об оплатах' };
        } else {
          resPaymentsData.data.data.eventList.data.forEach((payment) => {
            for (let i = 0; i < payment.payment_items.length; i++) {
              result = [
                ...result,
                {
                  idForSort: parseInt(
                    payment.timestamp.split(' ')[0].split('-').join('') +
                      payment.timestamp.split(' ')[1].split(':').join('')
                  ),
                  id: payment.payment.id,
                  type: FAKE_PAYMENTS.includes(payment.payment.id.toString())
                    ? 'FAKE'
                    : payment?.payment_items[i]?.title?.includes('PS') ||
                      payment?.payment_items[i]?.title?.includes('Ps') ||
                      payment?.payment_items[i]?.title?.includes('ps')
                    ? 'PS'
                    : payment?.payment_items[i]?.title?.includes('Кресло')
                    ? 'RACEZONE'
                    : payment.payment_items[i].entity_type
                    ? payment.payment_items[i].entity_type
                    : 'TARIFF',
                  date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                    payment.timestamp.split(' ')[0].split('-')[1]
                  }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
                  time: payment.timestamp.split(' ')[1],
                  client: payment.client?.phone ? `+${payment.client?.phone}` : null,
                  nickname: payment.client?.nickname ? payment.client?.nickname : null,
                  title: payment.payment_items[i].title ? payment.payment_items[i].title : 'Пополнение депозита',
                  amount: payment.payment_items[i].amount,
                  sum:
                    payment.payment.title === 'DEPOSIT'
                      ? Math.floor(payment.payment_items[i].sum - payment.value1)
                      : Math.floor(payment.payment_items[i].sum),
                  bonus: Math.floor(payment.value1),
                  payment_title: payment.payment.title,
                  operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
                },
              ];
            }
          });
        }
      }
      return { result };
    }
  } catch (error) {
    console.log('getClientData ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const createSmartshellPaymentsDataRequest = (startDate, endDate, page, managerBearer) => {
  let dataPayments = {
    query: `query eventList {
  eventList(
      input: {
          start: "${startDate}"
          finish: "${endDate}"
          types: "PAYMENT_CREATED"
      }
      first: 1000
      page: ${page}
  ) {
      paginatorInfo {
          count
          currentPage
          lastPage
      }
      data {
          type
          timestamp
          client {
              phone
              nickname
          }
          payment {
              id
              value
              title
          }
          payment_items {
              title
              amount
              sum
              entity_type
          }
          value1
          operator {
              first_name
              last_name
          }
      }
  }
  }
  `,
  };
  return {
    method: 'post',
    url: `https://billing.smartshell.gg/api/graphql`,
    headers: {
      authorization: `Bearer ${managerBearer}`,
    },
    data: dataPayments,
    httpsAgent: agent,
  };
};

const getSbpData = async (startDate, endDate, managerBearer) => {
  try {
    let page = 1;

    let smartshellPaymentsDataRequest = createSmartshellSpbDataRequest(startDate, endDate, page, managerBearer);
    let result = [];
    let resPaymentsData = await axios(smartshellPaymentsDataRequest);

    if (resPaymentsData.data.errors) {
      resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об оплатах' };
    } else {
      result = [
        ...result,
        ...resPaymentsData.data.data.eventList.data.map((payment) => ({
          idForSort: parseInt(
            payment.timestamp.split(' ')[0].split('-').join('') + payment.timestamp.split(' ')[1].split(':').join('')
          ),
          id: payment.payment.id,
          type: 'TARIFF',
          date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${payment.timestamp.split(' ')[0].split('-')[1]}.${
            payment.timestamp.split(' ')[0].split('-')[0]
          }`,
          time: payment.timestamp.split(' ')[1],
          client: payment.client?.phone ? `+${payment.client?.phone}` : null,
          nickname: payment.client?.nickname ? payment.client?.nickname : null,
          title: 'Пополнение по СБП',
          amount: payment.payment_items[0].amount,
          sum: Math.floor(payment.payment_items[0].sum),
          bonus: Math.floor(payment.value1) || 0,
          payment_title: 'СБП',
        })),
      ];
      while (resPaymentsData.data.data.eventList.paginatorInfo.lastPage > page) {
        page += 1;
        let smartshellPaymentsDataRequest = createSmartshellSpbDataRequest(startDate, endDate, page, managerBearer);
        resPaymentsData = await axios(smartshellPaymentsDataRequest);
        if (resPaymentsData.data.errors) {
          resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные об оплатах' };
        } else {
          result = [
            ...result,
            ...resPaymentsData.data.data.eventList.data.map((payment) => ({
              idForSort: parseInt(
                payment.timestamp.split(' ')[0].split('-').join('') +
                  payment.timestamp.split(' ')[1].split(':').join('')
              ),
              id: payment.payment.id,
              type: 'TARIFF',
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              nickname: payment.client?.nickname ? payment.client?.nickname : null,
              title: 'Пополнение по СБП',
              amount: payment.payment_items[0].amount,
              sum: Math.floor(payment.payment_items[0].sum),
              bonus: Math.floor(payment.value1) || 0,
              payment_title: 'СБП',
              operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
            })),
          ];
        }
      }
      return { result };
    }
  } catch (error) {
    console.log('getClientData ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const createSmartshellSpbDataRequest = (startDate, endDate, page, managerBearer) => {
  const dataPayments = {
    query: `query eventList {
  eventList(
      input: {
          start: "${startDate}"
          finish: "${endDate}"
          types: "DEPOSIT_ADDED_ONLINE"
      }
      first: 1000
      page: ${page}
  ) {
      paginatorInfo {
          count
          currentPage
          lastPage
      }
      data {
          type
          timestamp
          client {
              phone
              nickname
          }
          payment {
              id
              value
          }
          payment_items {
              title
              amount
              sum
              entity_type
          }
          operator {
              first_name
              last_name
          }
      }
  }
}
`,
  };
  return {
    method: 'post',
    url: `https://billing.smartshell.gg/api/graphql`,
    headers: {
      authorization: `Bearer ${managerBearer}`,
    },
    data: dataPayments,
    httpsAgent: agent,
  };
};

const getTariffPerMinuteData = async (startDate, endDate, managerBearer) => {
  try {
    let page = 1;

    let smartshellPaymentsDataRequest = createSmartshellTariffPerMinuteDataRequest(
      startDate,
      endDate,
      page,
      managerBearer
    );
    let result = [];
    let resPaymentsData = await axios(smartshellPaymentsDataRequest);

    if (resPaymentsData.data.errors) {
      resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об оплатах' };
    } else {
      resPaymentsData.data.data.eventList.data.forEach((payment) => {
        if (payment.client_session.is_per_minute === true) {
          result = [
            ...result,
            {
              idForSort: parseInt(
                payment.timestamp.split(' ')[0].split('-').join('') +
                  payment.timestamp.split(' ')[1].split(':').join('')
              ),
              id: payment.payment?.id || 0,
              type: 'TARIFF',
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              nickname: payment.client?.nickname ? payment.client?.nickname : null,
              title: 'Поминутный',
              amount: payment.client_session.elapsed,
              sum: Math.floor(payment?.client_session?.total_cost) || 0,
              bonus: Math.floor(payment.value1) || 0,
              payment_title: 'DEPOSIT',
              operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
            },
          ];
        }
      });
      while (resPaymentsData.data.data.eventList.paginatorInfo.lastPage > page) {
        page += 1;
        let smartshellPaymentsDataRequest = createSmartshellTariffPerMinuteDataRequest(
          startDate,
          endDate,
          page,
          managerBearer
        );
        resPaymentsData = await axios(smartshellPaymentsDataRequest);
        if (resPaymentsData.data.errors) {
          resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные об оплатах' };
        } else {
          resPaymentsData.data.data.eventList.data.forEach((payment) => {
            if (payment.client_session.is_per_minute === true) {
              result = [
                ...result,
                {
                  idForSort: parseInt(
                    payment.timestamp.split(' ')[0].split('-').join('') +
                      payment.timestamp.split(' ')[1].split(':').join('')
                  ),
                  id: payment.payment?.id || 0,
                  type: 'TARIFF',
                  date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                    payment.timestamp.split(' ')[0].split('-')[1]
                  }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
                  time: payment.timestamp.split(' ')[1],
                  client: payment.client?.phone ? `+${payment.client?.phone}` : null,
                  nickname: payment.client?.nickname ? payment.client?.nickname : null,
                  title: 'Поминутный',
                  amount: payment.client_session.elapsed,
                  sum: Math.floor(payment?.client_session?.total_cost) || 0,
                  bonus: Math.floor(payment.value1) || 0,
                  payment_title: 'DEPOSIT',
                  operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
                },
              ];
            }
          });
        }
      }
      return { result };
    }
  } catch (error) {
    console.log('getClientData ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const createSmartshellTariffPerMinuteDataRequest = (startDate, endDate, page, managerBearer) => {
  const dataPayments = {
    query: `query eventList {
      eventList(
          input: {
              start: "${startDate}"
              finish: "${endDate}"
              types: "CLIENT_SESSION_FINISHED"
          }
          first: 1000
          page: ${page}
      ) {
            paginatorInfo {
                count
                currentPage
                lastPage
            }
            data {
                timestamp
                client {
                    phone
                    nickname
                }
                payment {
                    id
                    value
                    title
                }
                payment_items {
                    title
                    amount
                    sum
                    entity_type
                }
                description
                client_session {
                    is_per_minute
                    total_cost
                    elapsed
                }
                operator {
                  first_name
                  last_name
                }
            }
        }
    }
    `,
  };
  return {
    method: 'post',
    url: `https://billing.smartshell.gg/api/graphql`,
    headers: {
      authorization: `Bearer ${managerBearer}`,
    },
    data: dataPayments,
    httpsAgent: agent,
  };
};

const getBonusData = async (startDate, endDate, managerBearer) => {
  try {
    let page = 1;

    let smartshellPaymentsDataRequest = createSmartshellBonusDataRequest(startDate, endDate, page, managerBearer);
    let result = [];
    let resPaymentsData = await axios(smartshellPaymentsDataRequest);

    if (resPaymentsData.data.errors) {
      resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об оплатах' };
    } else {
      result = [
        ...result,
        ...resPaymentsData.data.data.eventList.data.map((payment) => ({
          idForSort: parseInt(
            payment.timestamp.split(' ')[0].split('-').join('') + payment.timestamp.split(' ')[1].split(':').join('')
          ),
          id: payment.payment.id,
          type: 'DEPOSIT',
          date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${payment.timestamp.split(' ')[0].split('-')[1]}.${
            payment.timestamp.split(' ')[0].split('-')[0]
          }`,
          time: payment.timestamp.split(' ')[1],
          client: payment.client?.phone ? `+${payment.client?.phone}` : null,
          nickname: payment.client?.nickname ? payment.client?.nickname : null,
          title: 'Начисление смарт-бонусов',
          amount: payment.payment_items[0].amount,
          sum: 0,
          bonus: payment.payment_items[0].sum,
          payment_title: payment.payment.title,
          operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
          comment: payment.comment,
        })),
      ];
      while (resPaymentsData.data.data.eventList.paginatorInfo.lastPage > page) {
        page += 1;
        let smartshellPaymentsDataRequest = createSmartshellBonusDataRequest(startDate, endDate, page, managerBearer);
        resPaymentsData = await axios(smartshellPaymentsDataRequest);
        if (resPaymentsData.data.errors) {
          resPaymentsData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные об оплатах' };
        } else {
          result = [
            ...result,
            ...resPaymentsData.data.data.eventList.data.map((payment) => ({
              idForSort: parseInt(
                payment.timestamp.split(' ')[0].split('-').join('') +
                  payment.timestamp.split(' ')[1].split(':').join('')
              ),
              id: payment.payment.id,
              type: 'DEPOSIT',
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              nickname: payment.client?.nickname ? payment.client?.nickname : null,
              title: 'Начисление смарт-бонусов',
              amount: payment.payment_items[0].amount,
              sum: 0,
              bonus: payment.payment_items[0].sum,
              payment_title: payment.payment.title,
              operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
              comment: payment.comment,
            })),
          ];
        }
      }
      return { result };
    }
  } catch (error) {
    console.log('getClientData ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const createSmartshellBonusDataRequest = (startDate, endDate, page, managerBearer) => {
  const dataPayments = {
    query: `query eventList {
      eventList(
          input: {
              start: "${startDate}"
              finish: "${endDate}"
              types: "BONUS_PAYMENT_CREATED"
          }
          first: 1000
          page: ${page}
      ) {
            paginatorInfo {
                count
                currentPage
                lastPage
            }
            data {
                timestamp
                client {
                    phone
                    nickname
                }
                payment {
                    id
                    value
                    title
                }
                payment_items {
                    title
                    amount
                    sum
                    entity_type
                }
                description
                client_session {
                    is_per_minute
                    total_cost
                    elapsed
                }
                operator {
                  first_name
                  last_name
                }
                comment
            }
        }
    }
    `,
  };
  return {
    method: 'post',
    url: `https://billing.smartshell.gg/api/graphql`,
    headers: {
      authorization: `Bearer ${managerBearer}`,
    },
    data: dataPayments,
    httpsAgent: agent,
  };
};

const getPaymentRefundData = async (startDate, endDate, managerBearer) => {
  try {
    let page = 1;
    let smartshellPaymentsDataRequest = createSmartshellPaymentRefundDataRequest(
      startDate,
      endDate,
      page,
      managerBearer
    );

    let result = [];
    let resPaymentsData = await axios(smartshellPaymentsDataRequest);

    if (resPaymentsData.data.errors) {
      resPaymentsData.data.errors.map((error) => console.log('getPaymentRefundData ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об отменах' };
    } else {
      for (const payment of resPaymentsData.data.data.eventList.data) {
        for (let i = 0; i < payment.payment_items.length; i++) {
          result = [
            ...result,
            {
              idForSort: parseInt(
                payment.timestamp.split(' ')[0].split('-').join('') +
                  payment.timestamp.split(' ')[1].split(':').join('')
              ),
              id: 0,
              type: payment.payment_items[i].entity_type,
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              nickname: payment.client?.nickname ? payment.client?.nickname : null,
              title: 'Отмена ' + payment.payment_items[i].entity_type,
              amount: payment.payment_items[i].amount,
              sum:
                payment.payment.title === 'BONUS'
                  ? 0
                  : payment.payment.title === 'DEPOSIT'
                  ? -Math.floor(payment.payment_items[i].sum - payment.value1)
                  : -Math.floor(payment.payment_items[i].sum),
              bonus:
                payment.payment.title === 'BONUS'
                  ? payment.payment.title === 'DEPOSIT'
                    ? -Math.floor(payment.payment_items[i].sum - payment.value1)
                    : -Math.floor(payment.payment_items[i].sum)
                  : Math.floor(payment.value1),
              payment_title: payment.payment.title,
              operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
            },
          ];
        }
      }
      while (resPaymentsData.data.data.eventList.paginatorInfo.lastPage > page) {
        page += 1;
        let smartshellPaymentsDataRequest = createSmartshellPaymentRefundDataRequest(
          startDate,
          endDate,
          page,
          managerBearer
        );
        resPaymentsData = await axios(smartshellPaymentsDataRequest);
        if (resPaymentsData.data.errors) {
          resPaymentsData.data.errors.map((error) => console.log('getPaymentRefundData ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные об отменах' };
        } else {
          for (const payment of resPaymentsData.data.data.eventList.data) {
            for (let i = 0; i < payment.payment_items.length; i++) {
              result = [
                ...result,
                {
                  idForSort: parseInt(
                    payment.timestamp.split(' ')[0].split('-').join('') +
                      payment.timestamp.split(' ')[1].split(':').join('')
                  ),
                  id: 0,
                  type: payment.payment_items[i].entity_type,
                  date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                    payment.timestamp.split(' ')[0].split('-')[1]
                  }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
                  time: payment.timestamp.split(' ')[1],
                  client: payment.client?.phone ? `+${payment.client?.phone}` : null,
                  nickname: payment.client?.nickname ? payment.client?.nickname : null,
                  title: 'Отмена ' + payment.payment_items[i].entity_type,
                  amount: payment.payment_items[i].amount,
                  sum:
                    payment.payment.title === 'BONUS'
                      ? 0
                      : payment.payment.title === 'DEPOSIT'
                      ? -Math.floor(payment.payment_items[i].sum - payment.value1)
                      : -Math.floor(payment.payment_items[i].sum),
                  bonus:
                    payment.payment.title === 'BONUS'
                      ? -Math.floor(payment.payment_items[i].sum)
                      : Math.floor(payment.value1),
                  payment_title: payment.payment.title,
                  operator: `${payment.operator?.first_name} ${payment.operator?.last_name}`,
                },
              ];
            }
          }
        }
      }
      return { result };
    }
  } catch (error) {
    console.log('getPaymentRefundData ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const createSmartshellPaymentRefundDataRequest = (startDate, endDate, page, managerBearer) => {
  let dataPayments = {
    query: `query eventList {
  eventList(
      input: {
          start: "${startDate}"
          finish: "${endDate}"
          types: "PAYMENT_REFUND"
      }
      first: 1000
      page: ${page}
  ) {
      paginatorInfo {
          count
          currentPage
          lastPage
      }
      data {
          type
          timestamp
          client {
              phone
              nickname
          }
          payment {
              id
              value
              title
          }
          payment_items {
              title
              amount
              sum
              entity_type
          }
          value1
          operator {
              first_name
              last_name
          }
      }
  }
  }
  `,
  };
  return {
    method: 'post',
    url: `https://billing.smartshell.gg/api/graphql`,
    headers: {
      authorization: `Bearer ${managerBearer}`,
    },
    data: dataPayments,
    httpsAgent: agent,
  };
};

// const getPaymentById = async (endDate, id, paymentItemsIndex, managerBearer) => {
//   try {
//     let smartshellPaymentsDataRequest = createSmartshellPaymentByIdRequest(endDate, id, managerBearer);
//     let resPaymentsData = await axios(smartshellPaymentsDataRequest);

//     if (resPaymentsData.data.errors) {
//       resPaymentsData.data.errors.map((error) => console.log('getPaymentById ERROR ->', error));
//       return { error: true, message: 'Не удалось получить данные об отмененном платеже' };
//     } else {
//       return resPaymentsData.data.data.eventList.data[0]?.payment_items[paymentItemsIndex].title || 'бонусы';
//     }
//   } catch (error) {
//     console.log('getPaymentById ERROR ->', error);
//     return { error: true, message: 'Ошибка на стороне сервера' };
//   }
// };

// const createSmartshellPaymentByIdRequest = (endDate, id, managerBearer) => {
//   let dataPayments = {
//     query: `query eventList {
//   eventList(
//       input: {
//           start: "2024-12-01 00:00:00"
//           finish: "${endDate}"
//           types: "PAYMENT_CREATED"
//   }
//   ) {
//         data {
//             payment_items {
//                 title
//             }
//         }
//     }
// }
//   `,
//   };
//   return {
//     method: 'post',
//     url: `https://billing.smartshell.gg/api/graphql`,
//     headers: {
//       authorization: `Bearer ${managerBearer}`,
//     },
//     data: dataPayments,
//     httpsAgent: agent,
//   };
// };

const getCashOrders = async (startDate, endDate, managerBearer) => {
  try {
    let page = 1;
    let cashordersRequest = getCashOrdersRequest(startDate, endDate, page, managerBearer);

    let result = [];
    let cashOrdersData = await axios(cashordersRequest);

    if (cashOrdersData.data.errors) {
      cashOrdersData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об оплатах' };
    } else {
      cashOrdersData.data.data.eventList.data.forEach((order) => {
        result = [
          ...result,
          {
            idForSort: parseInt(
              order.cash_order.created_at.split(' ')[0].split('-').join('') +
                order.cash_order.created_at.split(' ')[1].split(':').join('')
            ),
            id: order.cash_order.id,
            type: order.cash_order.type,
            date: `${order.cash_order.created_at.split(' ')[0].split('-')[2]}.${
              order.cash_order.created_at.split(' ')[0].split('-')[1]
            }.${order.cash_order.created_at.split(' ')[0].split('-')[0]}`,
            time: order.cash_order.created_at.split(' ')[1],
            sum: order.cash_order.sum,
            comment: order.cash_order.comment,
            operator: `${order.operator?.first_name} ${order.operator?.last_name}`,
          },
        ];
      });
      while (cashOrdersData.data.data.eventList.paginatorInfo.lastPage > page) {
        page += 1;
        let cashordersRequest = getCashOrdersRequest(startDate, endDate, page, managerBearer);
        cashOrdersData = await axios(cashordersRequest);
        if (cashOrdersData.data.errors) {
          cashOrdersData.data.errors.map((error) => console.log('getClientData ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные об оплатах' };
        } else {
          cashOrdersData.data.data.eventList.data.forEach((order) => {
            result = [
              ...result,
              {
                idForSort: parseInt(
                  order.cash_order.created_at.split(' ')[0].split('-').join('') +
                    order.cash_order.created_at.split(' ')[1].split(':').join('')
                ),
                id: order.cash_order.id,
                type: order.cash_order.type,
                date: `${order.cash_order.created_at.split(' ')[0].split('-')[2]}.${
                  order.cash_order.created_at.split(' ')[0].split('-')[1]
                }.${order.cash_order.created_at.split(' ')[0].split('-')[0]}`,
                time: order.cash_order.created_at.split(' ')[1],
                sum: order.cash_order.sum,
                comment: order.cash_order.comment,
                operator: `${order.operator?.first_name} ${order.operator?.last_name}`,
              },
            ];
          });
        }
      }
      console.log(result);
      return { result };
    }
  } catch (error) {
    console.log('getCashOrders ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const getCashOrdersRequest = (startDate, endDate, page, managerBearer) => {
  let dataPayments = {
    query: `query eventList {
    eventList(
        input: {
            start: "${startDate}"
            finish:"${endDate}"
            types: "CASH_ORDER_CREATED"
        }
        first: 1000
        page: ${page}
    ) {
        paginatorInfo {
            count
            currentPage
            lastPage
        }
        data {
            cash_order {
                id
                created_at
                type
                sum
                comment
            }
            operator {
                first_name
                last_name
            }
        }
    }
}
  `,
  };
  return {
    method: 'post',
    url: `https://billing.smartshell.gg/api/graphql`,
    headers: {
      authorization: `Bearer ${managerBearer}`,
    },
    data: dataPayments,
    httpsAgent: agent,
  };
};

const getFirstSessionsFromPeriod = async (req, res) => {
  try {
    const startDate = '2024-12-01 00:00:00'; // Дата открытия клуба
    const endDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // Текущая дата и время
    const managerBearer = await getSmartshellManagerBearer();

    // 1. Получаем данные так же, как и раньше
    const firstSessions = await getFirstClientSessions(startDate, endDate, managerBearer);

    if (firstSessions.error) {
      return res.status(500).json({ message: firstSessions.message });
    }

    // 2. Генерируем XLSX-буфер из полученных данных
    const xlsxBuffer = await generateFirstSessionsXlsx(firstSessions.result);

    const formattedStartDate = startDate.split(' ')[0];
    const formattedEndDate = endDate.split(' ')[0];
    const fileName = `Первые_сессии_${formattedStartDate}_${formattedEndDate}.xlsx`;

    // 3. Отправляем файл клиенту
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="First_Sessions_All_Time.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(xlsxBuffer);
  } catch (error) {
    console.log('getFirstSessionsFromPeriod ERROR ->', error);
    res.status(500).json({ message: 'Ошибка на стороне сервера' });
  }
};

// Сервисная функция для основной логики
const getFirstClientSessions = async (startDate, endDate, managerBearer) => {
  try {
    const result = [];
    const seenClients = new Set(); // Хранилище для уникальных клиентов (по номеру телефона)

    let currentStartDate = new Date(startDate);

    // Итерация по месяцам
    while (currentStartDate <= new Date(endDate)) {
      const currentMonth = currentStartDate.getMonth();
      const currentYear = currentStartDate.getFullYear();

      const monthStartDate = new Date(currentYear, currentMonth, 1, 0, 0, 0);
      const monthEndDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      const formattedMonthStart = monthStartDate.toISOString().slice(0, 19).replace('T', ' ');
      const formattedMonthEnd = monthEndDate.toISOString().slice(0, 19).replace('T', ' ');

      let page = 1;
      let hasMorePages = true;

      // Пагинация внутри месяца
      while (hasMorePages) {
        const requestConfig = createSmartshellEventListRequest(
          formattedMonthStart,
          formattedMonthEnd,
          page,
          managerBearer
        );
        const response = await axios(requestConfig);

        if (response.data.errors) {
          response.data.errors.map((error) => console.log('getFirstClientSessions ERROR ->', error));
          return { error: true, message: 'Не удалось получить данные о сессиях' };
        }

        const eventList = response.data.data.eventList;
        hasMorePages = eventList.paginatorInfo.hasMorePages;
        page += 1;

        for (const event of eventList.data) {
          const clientPhone = event.client?.phone;

          // Проверяем, видели ли мы этого клиента раньше
          if (clientPhone && !seenClients.has(clientPhone)) {
            seenClients.add(clientPhone); // Добавляем в список уникальных
            result.push({
              key: clientPhone, // Уникальный ключ для React-таблицы
              firstSessionDate: event.timestamp,
              nickname: event.client.nickname,
              phone: `+${event.client.phone}`,
              email: event.client.email || 'Не указан',
            });
          }
        }
      }
      // Переходим к следующему месяцу
      currentStartDate.setMonth(currentStartDate.getMonth() + 1);
    }

    // Сортируем результат по дате для наглядности
    result.sort((a, b) => new Date(a.firstSessionDate) - new Date(b.firstSessionDate));

    return { result };
  } catch (error) {
    console.log('getFirstClientSessions ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

// Хелпер для создания запроса (на основе вашего примера)
const createSmartshellEventListRequest = (startDate, endDate, page, managerBearer) => {
  const query = `
      query EventList {
        eventList(
            input: {
                start: "${startDate}"
                finish: "${endDate}"
                types: "CLIENT_SESSION_FINISHED"
            }
            first: 1000
            page: ${page}
        ) {
            paginatorInfo {
                hasMorePages
            }
            data {
                timestamp
                type
                client {
                    phone
                    email
                    nickname
                }
            }
        }
      }`;

  return {
    method: 'post',
    url: 'https://billing.smartshell.gg/api/graphql',
    headers: {
      authorization: `Bearer ${managerBearer}`,
      'Content-Type': 'application/json',
    },
    data: { query },
    // httpsAgent: agent, // если используете
  };
};

const generatePaymentsXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 9 },
    { header: 'Тип', key: 'type', width: 7 },
    { header: 'Дата', key: 'date', width: 11 },
    { header: 'Время', key: 'time', width: 9 },
    { header: 'Клиент', key: 'client', width: 13 },
    { header: 'Ник', key: 'nickname', width: 16 },
    { header: 'Позиция', key: 'title', width: 32 },
    { header: 'Кол-во', key: 'amount', width: 7 },
    { header: 'Сумма', key: 'sum', width: 10 },
    { header: 'Бонус', key: 'bonus', width: 6 },
    { header: 'Источник', key: 'payment_title', width: 10 },
    { header: 'Сотрудник', key: 'operator', width: 25 },
    { header: 'Комментарий', key: 'comment', width: 30 },
  ];

  data.forEach((item) => {
    worksheet.addRow(item);
  });

  let totalSum = 0;

  data.forEach((item) => {
    if (item.payment_title !== 'DEPOSIT') totalSum += item.sum;
  });

  worksheet.addRow({
    id: '',
    type: '',
    date: '',
    time: '',
    client: '',
    nickname: '',
    title: '',
    amount: 'Итого',
    sum: totalSum,
    bonus: '',
    payment_title: '',
    operator: '',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

const generateSbpXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 11 },
    { header: 'Дата', key: 'date', width: 11 },
    { header: 'Время', key: 'time', width: 11 },
    { header: 'Клиент', key: 'client', width: 16 },
    { header: 'Сумма', key: 'sum', width: 11 },
  ];

  data.forEach((item) => {
    worksheet.addRow(item);
  });

  const totalSum = data.reduce((acc, item) => acc + Number(item.sum), 0);
  worksheet.addRow({
    id: '',
    date: '',
    time: '',
    client: 'Итого',
    sum: totalSum,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

const generateCashOrdersXlsx = async (data) => {
  console.log(data);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 11 },
    { header: 'Тип', key: 'type', width: 11 },
    { header: 'Дата', key: 'date', width: 11 },
    { header: 'Время', key: 'time', width: 11 },
    { header: 'Сумма', key: 'sum', width: 11 },
    { header: 'Комментарий', key: 'comment', width: 25 },
    { header: 'Администратор', key: 'operator', width: 25 },
  ];

  data.forEach((item) => {
    worksheet.addRow(item);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

const generateFirstSessionsXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Первые сессии');

  worksheet.columns = [
    { header: 'Дата первой сессии', key: 'firstSessionDate', width: 20 },
    { header: 'Никнейм', key: 'nickname', width: 25 },
    { header: 'Телефон', key: 'phone', width: 20 },
    { header: 'Email', key: 'email', width: 30 },
  ];

  // Заполняем строки данными
  data.forEach((item) => {
    worksheet.addRow(item);
  });

  // Делаем заголовок жирным
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  getSmartshellManagerBearer,
  paymentsFromPeriod,
  getResultsArray,
  sbpFromPeriod,
  cashOrdersFromPeriod,
  getFirstSessionsFromPeriod,
};
