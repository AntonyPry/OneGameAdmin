// controllers/payments.controller.js
const dotenv = require('dotenv');
const axios = require('axios');
const ExcelJS = require('exceljs');

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

    const data = await getPaymentData(startDate, endDate, managerBearer);
    if (data.error) {
      console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, data.message);
      return res.status(400).send(data);
    } else {
      const xlsxBuffer = await generatePaymentsXlsx(data.result);

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
      result = [
        ...result,
        ...resPaymentsData.data.data.eventList.data.map((payment) => ({
          id: payment.payment.id,
          type: payment.payment_items[0].entity_type,
          date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${payment.timestamp.split(' ')[0].split('-')[1]}.${
            payment.timestamp.split(' ')[0].split('-')[0]
          }`,
          time: payment.timestamp.split(' ')[1],
          client: payment.client?.phone ? `+${payment.client?.phone}` : null,
          nickname: payment.client?.nickname ? payment.client?.nickname : null,
          title: payment.payment_items[0].title ? payment.payment_items[0].title : 'Пополнение депозита',
          amount: payment.payment_items[0].amount,
          sum: payment.payment_items[0].sum,
          payment_title: payment.payment.title,
        })),
      ];
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
          result = [
            ...result,
            ...resPaymentsData.data.data.eventList.data.map((payment) => ({
              id: payment.payment.id,
              type: payment.payment_items[0].entity_type,
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              nickname: payment.client?.nickname ? payment.client?.nickname : null,
              title: payment.payment_items[0].title ? payment.payment_items[0].title : 'Пополнение депозита',
              amount: payment.payment_items[0].amount,
              sum: payment.payment_items[0].sum,
              payment_title: payment.payment.title,
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
          id: payment.payment.id,
          date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${payment.timestamp.split(' ')[0].split('-')[1]}.${
            payment.timestamp.split(' ')[0].split('-')[0]
          }`,
          time: payment.timestamp.split(' ')[1],
          client: payment.client?.phone ? `+${payment.client?.phone}` : null,
          sum: payment.payment_items[0].sum,
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
              id: payment.payment.id,
              date: `${payment.timestamp.split(' ')[0].split('-')[2]}.${
                payment.timestamp.split(' ')[0].split('-')[1]
              }.${payment.timestamp.split(' ')[0].split('-')[0]}`,
              time: payment.timestamp.split(' ')[1],
              client: payment.client?.phone ? `+${payment.client?.phone}` : null,
              sum: payment.payment_items[0].sum,
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
    { header: 'ID', key: 'id', width: 11 },
    { header: 'Тип', key: 'type', width: 11 },
    { header: 'Дата', key: 'date', width: 11 },
    { header: 'Время', key: 'time', width: 11 },
    { header: 'Клиент', key: 'client', width: 16 },
    { header: 'Ник', key: 'nickname', width: 16 },
    { header: 'Позиция', key: 'title', width: 25 },
    { header: 'Количество', key: 'amount', width: 11 },
    { header: 'Сумма', key: 'sum', width: 11 },
    { header: 'Происхождение', key: 'payment_title', width: 20 },
  ];

  data.forEach((item) => {
    worksheet.addRow(item);
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
