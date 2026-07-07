'use strict';

const express = require('express');
const platformController = require('../controllers/platform.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requireSystemRole } = require('../middlewares/rbac.middleware');
const { SYSTEM_ROLES } = require('../rbac/roles');

const router = express.Router();

router.use(authenticateToken);
router.use(requireSystemRole(SYSTEM_ROLES.PLATFORM_ADMIN));

router.get('/clubs', platformController.listClubs);
router.post('/clubs', platformController.createClub);
router.get('/clubs/:clubId', platformController.getClub);
router.patch('/clubs/:clubId', platformController.updateClub);
router.patch('/clubs/:clubId/settings', platformController.updateClubSettings);

router.get('/users', platformController.listUsers);
router.post('/users', platformController.createUser);
router.get('/users/:userId', platformController.getUser);
router.patch('/users/:userId', platformController.updateUser);
router.delete('/users/:userId', platformController.removeUser);
router.post('/users/:userId/memberships', platformController.upsertUserMembership);
router.patch(
  '/users/:userId/memberships/:clubId',
  platformController.updateUserMembership,
);
router.delete(
  '/users/:userId/memberships/:clubId',
  platformController.removeUserMembership,
);

module.exports = router;
