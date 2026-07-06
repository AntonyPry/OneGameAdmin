// routes/payments.routes.js (примерное название твоего файла)
const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { checkClubAccess } = require('../middlewares/club.middleware');
const { requireClubRole } = require('../middlewares/rbac.middleware');
const { ROUTE_ROLES } = require('../rbac/roles');

// Защищаем все роуты экспорта!
router.use(authenticateToken);
router.use(checkClubAccess);
router.use(requireClubRole(...ROUTE_ROLES.paymentsExport));

router.get('/export-history', paymentsController.listExportHistory);
router.post('/paymentsFromPeriod', paymentsController.paymentsFromPeriod);
router.post('/sbpFromPeriod', paymentsController.sbpFromPeriod);
router.post('/cashOrdersFromPeriod', paymentsController.cashOrdersFromPeriod);
router.post(
  '/firstSessionsFromPeriod',
  paymentsController.getFirstSessionsFromPeriod,
);

module.exports = router;
