// Пример твоего routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { checkClubAccess } = require('../middlewares/club.middleware');
const { requireClubRole } = require('../middlewares/rbac.middleware');
const { ROUTE_ROLES } = require('../rbac/roles');

// Теперь запросы проходят двойную проверку:
// 1. Кто ты такой? (токен)
// 2. Есть ли у тебя доступ к этому клубу? (база данных)
router.use(authenticateToken);
router.use(checkClubAccess);

router.get(
  '/currentStats',
  requireClubRole(...ROUTE_ROLES.adminPanel),
  adminController.currentStats,
);
router.get(
  '/getActiveWorkshift',
  requireClubRole(...ROUTE_ROLES.adminPanel),
  adminController.getActiveWorkshift,
);
router.get(
  '/plans',
  requireClubRole(...ROUTE_ROLES.plansRead),
  adminController.getPlans,
);
router.post(
  '/plans',
  requireClubRole(...ROUTE_ROLES.plansWrite),
  adminController.updatePlan,
);
router.post(
  '/approveAdminResponsibilities',
  requireClubRole(...ROUTE_ROLES.checklistConfirm),
  adminController.approveAdminResponsibilities,
);

module.exports = router;
