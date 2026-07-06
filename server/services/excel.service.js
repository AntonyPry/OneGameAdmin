// services/excel.service.js
const ExcelJS = require('exceljs');

const generatePaymentsXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 13 },
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

  return await workbook.xlsx.writeBuffer();
};

const generateSbpXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 13 },
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

  return await workbook.xlsx.writeBuffer();
};

const generateCashOrdersXlsx = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 13 },
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

  return await workbook.xlsx.writeBuffer();
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

  data.forEach((item) => {
    worksheet.addRow(item);
  });

  worksheet.getRow(1).font = { bold: true };

  return await workbook.xlsx.writeBuffer();
};

module.exports = {
  generatePaymentsXlsx,
  generateSbpXlsx,
  generateCashOrdersXlsx,
  generateFirstSessionsXlsx,
};
