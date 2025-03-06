// controllers/payments.controller.js
const dotenv = require('dotenv');
const axios = require('axios');
const ExcelJS = require('exceljs');
const { FAKE_PAYMENTS } = require('../consts/fakePayments');

console.log(FAKE_PAYMENTS);

dotenv.config();

exports.paymentsFromPeriod = async (req, res) => {
  try {
    let { startDate, endDate, clubId } = req.body;
    if (!clubId) clubId = 6816;

    const managerBearer = await getSmartshellManagerBearer(clubId);
    if (managerBearer.error) {
      console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
      return res.status(400).send(managerBearer);
    }

    const dataBasicPayments = await getPaymentData(startDate, endDate, managerBearer);
    if (dataBasicPayments.error) {
      console.log(`Ошибка при получении данных об оплатах для клуба ${clubId}:`, dataBasicPayments.message);
      return res.status(400).send(dataBasicPayments);
    }

    const dataSbpPayments = await getSbpData(startDate, endDate, managerBearer);
    if (dataSbpPayments.error) {
      console.log(`Ошибка при получении пополненй по СБП для клуба ${clubId}:`, dataSbpPayments.message);
      return res.status(400).send(dataSbpPayments);
    }

    const dataTariffPerMinutePayments = await getTariffPerMinuteData(startDate, endDate, managerBearer);
    if (dataTariffPerMinutePayments.error) {
      console.log(`Ошибка при получении поминутных тарифов для клуба ${clubId}:`, dataTariffPerMinutePayments.message);
      return res.status(400).send(dataTariffPerMinutePayments);
    }

    const dataBonusPayments = await getBonusData(startDate, endDate, managerBearer);
    if (getBonusData.error) {
      console.log(`Ошибка при получении начисления бонусов для клуба ${clubId}:`, getBonusData.message);
      return res.status(400).send(getBonusData);
    }

    const paymentRefundData = await getPaymentRefundData(startDate, endDate, managerBearer);
    if (paymentRefundData.error) {
      console.log(`Ошибка при получении отмененных платежей ${clubId}:`, paymentRefundData.message);
      return res.status(400).send(paymentRefundData);
    }

    const xlsxBuffer = await generatePaymentsXlsx(
      [
        ...dataBasicPayments.result,
        ...dataSbpPayments.result,
        ...dataTariffPerMinutePayments.result,
        ...dataBonusPayments.result,
        ...paymentRefundData.result,
      ].sort((a, b) => (a.idForSort > b.idForSort ? 1 : -1))
    );
    res.setHeader('Content-Disposition', `attachment; filename=payments_${Date.now}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(xlsxBuffer);
    // return res.status(200).send(data.result);
  } catch (error) {
    console.log('paymentsFromPeriod ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

exports.sbpFromPeriod = async (req, res) => {
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
      console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, data.message);
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

const getSmartshellManagerBearer = async (clubId) => {
  const dataManagerLogin = {
    query: `mutation Login {
          login(
              input: { login: "79115288454", password: "sahroQ-jugquv-4xymti", company_id: ${clubId} }
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
                : payment?.payment_items[i]?.title?.includes('PS')
                ? 'PS'
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
              sum: Math.floor(payment.payment_items[i].sum - payment.value1),
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
                    : payment?.payment_items[i]?.title?.includes('PS')
                    ? 'PS'
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
                  sum: Math.floor(payment.payment_items[i].sum - payment.value1),
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
          start: "${startDate} 00:00:00"
          finish: "${endDate} 23:59:59"
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
          start: "${startDate} 00:00:00"
          finish: "${endDate} 23:59:59"
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
              start: "${startDate} 00:00:00"
              finish: "${endDate} 23:59:59"
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
              start: "${startDate} 00:00:00"
              finish: "${endDate} 23:59:59"
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
              title: 'Отмена ' + (await getPaymentById(endDate, payment.payment.id, i, managerBearer)),
              amount: payment.payment_items[i].amount,
              sum:
                payment.payment.title === 'BONUS'
                  ? Math.floor(payment.value1)
                  : -Math.floor(payment.payment_items[i].sum - payment.value1),
              bonus:
                payment.payment.title === 'BONUS'
                  ? -Math.floor(payment.payment_items[i].sum - payment.value1)
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
                  title: 'Отмена ' + (await getPaymentById(endDate, payment.payment.id, i, managerBearer)),
                  amount: payment.payment_items[i].amount,
                  sum:
                    payment.payment.title === 'BONUS'
                      ? Math.floor(payment.value1)
                      : -Math.floor(payment.payment_items[i].sum - payment.value1),
                  bonus:
                    payment.payment.title === 'BONUS'
                      ? -Math.floor(payment.payment_items[i].sum - payment.value1)
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
          start: "${startDate} 00:00:00"
          finish: "${endDate} 23:59:59"
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
  };
};

const getPaymentById = async (endDate, id, paymentItemsIndex, managerBearer) => {
  try {
    let smartshellPaymentsDataRequest = createSmartshellPaymentByIdRequest(endDate, id, managerBearer);
    let resPaymentsData = await axios(smartshellPaymentsDataRequest);

    if (resPaymentsData.data.errors) {
      resPaymentsData.data.errors.map((error) => console.log('getPaymentById ERROR ->', error));
      return { error: true, message: 'Не удалось получить данные об отмененном платеже' };
    } else {
      return resPaymentsData.data.data.eventList.data[0]?.payment_items[paymentItemsIndex].title || 'бонусы';
    }
  } catch (error) {
    console.log('getPaymentById ERROR ->', error);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const createSmartshellPaymentByIdRequest = (endDate, id, managerBearer) => {
  let dataPayments = {
    query: `query eventList {
  eventList(
      input: {
          start: "2024-12-01 00:00:00"
          finish: "${endDate} 23:59:59"
          types: "PAYMENT_CREATED"
          q: "${id}"
  }
  ) {
        data {
            payment_items {
                title
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
  ];

  data.forEach((item) => {
    worksheet.addRow(item);
  });

  let totalSum = 0;

  data.forEach((item) => {
    if (!(item.type === 'TARIFF' && item.payment_title === 'DEPOSIT')) totalSum += Number(item.sum);
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
