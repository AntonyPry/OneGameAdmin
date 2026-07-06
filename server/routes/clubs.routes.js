'use strict';

const express = require('express');
const clubsController = require('../controllers/clubs.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { checkClubAccess } = require('../middlewares/club.middleware');
const { requireClubRole } = require('../middlewares/rbac.middleware');
const { CLUB_ROLES } = require('../rbac/roles');

const router = express.Router();

router.use(authenticateToken);

const requireOwnerMembership = (req, res, next) => {
  if (req.userClubRole !== CLUB_ROLES.OWNER) {
    return res
      .status(403)
      .send({ error: true, message: 'Недостаточно прав владельца клуба' });
  }

  return next();
};

router.get(
  '/current/settings',
  checkClubAccess,
  requireClubRole(CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER),
  clubsController.getCurrentSettings,
);

router.patch(
  '/current/settings',
  checkClubAccess,
  requireClubRole(CLUB_ROLES.OWNER),
  clubsController.updateCurrentSettings,
);

router.get(
  '/current/users',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.listCurrentUsers,
);

router.post(
  '/current/users',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.createCurrentUser,
);

router.get(
  '/current/users/:userId',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.getCurrentUser,
);

router.patch(
  '/current/users/:userId',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.updateCurrentUser,
);

router.post(
  '/current/users/:userId/membership',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.upsertCurrentUserMembership,
);

router.patch(
  '/current/users/:userId/membership',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.updateCurrentUserMembership,
);

router.delete(
  '/current/users/:userId/membership',
  checkClubAccess,
  requireOwnerMembership,
  clubsController.removeCurrentUserMembership,
);

module.exports = router;
