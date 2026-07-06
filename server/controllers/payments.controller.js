// controllers/payments.controller.js
const paymentsService = require('../services/payments.service');
const excelService = require('../services/excel.service');
const exportHistoryService = require('../services/exportHistory.service');
const { getManagerToken } = require('../services/token.service');

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const isUpstreamTokenError = (result) => {
  if (!result?.error) return false;

  const code = String(result.code || '');
  const message = String(result.message || '');

  return (
    code.startsWith('SMARTSHELL') ||
    /smartshell|token|токен|credentials/i.test(message)
  );
};

const sendServiceError = (res, result, fallbackStatus = 400) =>
  res
    .status(isUpstreamTokenError(result) ? 502 : fallbackStatus)
    .send(result);

const startExportHistory = async (req, reportType, { startDate, endDate }) => {
  try {
    return await exportHistoryService.createExportHistory({
      clubId: req.dbClubId,
      userId: req.user?.id,
      reportType,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error('exportHistory.create ERROR ->', error.message);
    return null;
  }
};

const markExportSuccess = async (history) => {
  try {
    await exportHistoryService.markExportHistorySuccess(history);
  } catch (error) {
    console.error('exportHistory.success ERROR ->', error.message);
  }
};

const markExportError = async (history, errorMessage) => {
  try {
    await exportHistoryService.markExportHistoryError(history, errorMessage);
  } catch (error) {
    console.error('exportHistory.error ERROR ->', error.message);
  }
};

const sendXlsx = (res, buffer, fileName) => {
  res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
  res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
  res.send(buffer);
};

const listExportHistory = async (req, res) => {
  try {
    const history = await exportHistoryService.listExportHistory({
      clubId: req.dbClubId,
      limit: req.query.limit,
    });

    return res.status(200).send({ error: false, history });
  } catch (error) {
    console.error('listExportHistory ERROR ->', error);
    return res
      .status(500)
      .send({ error: true, message: 'Не удалось загрузить историю выгрузок' });
  }
};

const paymentsFromPeriod = async (req, res) => {
  let exportHistory = null;

  try {
    let { startDate, endDate } = req.body;
    exportHistory = await startExportHistory(
      req,
      exportHistoryService.REPORT_TYPES.PAYMENTS,
      { startDate, endDate },
    );

    const resultsArray = await paymentsService.getResultsArray(
      startDate,
      endDate,
      req.smartshellCompanyId,
    );

    if (resultsArray.error) {
      await markExportError(exportHistory, resultsArray.message);
      return sendServiceError(res, resultsArray);
    }

    const sortedData = resultsArray.sort((a, b) =>
      a.idForSort > b.idForSort ? 1 : -1,
    );
    const xlsxBuffer = await excelService.generatePaymentsXlsx(sortedData);

    await markExportSuccess(exportHistory);
    sendXlsx(res, xlsxBuffer, `payments_${Date.now()}.xlsx`);
  } catch (error) {
    await markExportError(exportHistory, error.message);
    console.log('paymentsFromPeriod ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const sbpFromPeriod = async (req, res) => {
  let exportHistory = null;

  try {
    let { startDate, endDate } = req.body;
    exportHistory = await startExportHistory(
      req,
      exportHistoryService.REPORT_TYPES.SBP,
      { startDate, endDate },
    );

    const managerBearer = await getManagerToken(req.smartshellCompanyId);
    if (managerBearer.error) {
      await markExportError(exportHistory, managerBearer.message);
      return sendServiceError(res, managerBearer);
    }

    const data = await paymentsService.getSbpData(
      startDate,
      endDate,
      managerBearer,
    );
    if (data.error) {
      await markExportError(exportHistory, data.message);
      return sendServiceError(res, data);
    }

    const xlsxBuffer = await excelService.generateSbpXlsx(data.result);
    await markExportSuccess(exportHistory);
    sendXlsx(res, xlsxBuffer, `sbp_payments_${Date.now()}.xlsx`);
  } catch (error) {
    await markExportError(exportHistory, error.message);
    console.log('sbpFromPeriod ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const cashOrdersFromPeriod = async (req, res) => {
  let exportHistory = null;

  try {
    let { startDate, endDate } = req.body;
    exportHistory = await startExportHistory(
      req,
      exportHistoryService.REPORT_TYPES.CASH_ORDERS,
      { startDate, endDate },
    );

    const managerBearer = await getManagerToken(req.smartshellCompanyId);
    if (managerBearer.error) {
      await markExportError(exportHistory, managerBearer.message);
      return sendServiceError(res, managerBearer);
    }

    const data = await paymentsService.getCashOrders(
      startDate,
      endDate,
      managerBearer,
    );
    if (data.error) {
      await markExportError(exportHistory, data.message);
      return sendServiceError(res, data);
    }

    const xlsxBuffer = await excelService.generateCashOrdersXlsx(data.result);
    await markExportSuccess(exportHistory);
    sendXlsx(res, xlsxBuffer, `cash_orders_${Date.now()}.xlsx`);
  } catch (error) {
    await markExportError(exportHistory, error.message);
    console.log('cashOrdersFromPeriod ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const getFirstSessionsFromPeriod = async (req, res) => {
  let exportHistory = null;

  try {
    // Дата открытия теперь берется прямо из объекта req.currentClub
    if (!req.currentClub.opening_date) {
      exportHistory = await startExportHistory(
        req,
        exportHistoryService.REPORT_TYPES.FIRST_SESSIONS,
        { startDate: null, endDate: null },
      );
      await markExportError(
        exportHistory,
        'В настройках клуба не указана дата открытия',
      );
      return res
        .status(400)
        .json({ message: 'В настройках клуба не указана дата открытия' });
    }

    const startDate = new Date(req.currentClub.opening_date)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const endDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    exportHistory = await startExportHistory(
      req,
      exportHistoryService.REPORT_TYPES.FIRST_SESSIONS,
      { startDate, endDate },
    );

    const managerBearer = await getManagerToken(req.smartshellCompanyId);
    if (managerBearer.error) {
      await markExportError(exportHistory, managerBearer.message);
      return sendServiceError(res, managerBearer);
    }

    const firstSessions = await paymentsService.getFirstClientSessions(
      startDate,
      endDate,
      managerBearer,
    );

    if (firstSessions.error) {
      await markExportError(exportHistory, firstSessions.message);
      return sendServiceError(res, firstSessions, 500);
    }

    const xlsxBuffer = await excelService.generateFirstSessionsXlsx(
      firstSessions.result,
    );
    const fileName = `Первые_сессии_${startDate.split(' ')[0]}_${endDate.split(' ')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="First_Sessions.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    await markExportSuccess(exportHistory);
    res.send(xlsxBuffer);
  } catch (error) {
    await markExportError(exportHistory, error.message);
    console.log('getFirstSessionsFromPeriod ERROR ->', error);
    res.status(500).json({ message: 'Ошибка на стороне сервера' });
  }
};

module.exports = {
  listExportHistory,
  paymentsFromPeriod,
  sbpFromPeriod,
  cashOrdersFromPeriod,
  getFirstSessionsFromPeriod,
};
