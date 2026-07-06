'use strict';

const {
  clubRoleHasPermission,
  hasClubRole,
  hasSystemRole,
  isPlatformAdmin,
} = require('../rbac/roles');

const unauthorized = (res) =>
  res.status(401).send({ error: true, message: 'Требуется авторизация' });

const forbidden = (res, message) =>
  res.status(403).send({ error: true, message });

const requireSystemRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return unauthorized(res);

    if (!hasSystemRole(req.user, roles)) {
      return forbidden(res, 'Недостаточно системных прав');
    }

    return next();
  };

const requireClubRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return unauthorized(res);

    if (isPlatformAdmin(req.user)) return next();

    if (!hasClubRole(req.userClubRole || req.userRole, roles)) {
      return forbidden(res, 'Недостаточно прав в клубе');
    }

    return next();
  };

const requireClubPermission = (permission) => (req, res, next) => {
  if (!req.user) return unauthorized(res);

  if (isPlatformAdmin(req.user)) return next();

  if (!clubRoleHasPermission(req.userClubRole || req.userRole, permission)) {
    return forbidden(res, 'Недостаточно прав в клубе');
  }

  return next();
};

module.exports = {
  requireSystemRole,
  requireClubRole,
  requireClubPermission,
};
