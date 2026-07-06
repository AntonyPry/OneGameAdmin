// middlewares/club.middleware.js
const { UserClub, Club } = require('../models');
const { normalizeClubSettings } = require('../utils/clubSettings');
const {
  SYSTEM_ROLES,
  isPlatformAdmin,
  normalizeClubRole,
} = require('../rbac/roles');

const checkClubAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .send({ error: true, message: 'Требуется авторизация' });
    }

    // Header/query/body club id is always our DB Club.id, never Smartshell id.
    const rawDbClubId =
      req.headers['x-club-id'] || req.query.clubId || (req.body || {}).clubId;
    const rawDbClubIdString = rawDbClubId ? String(rawDbClubId).trim() : '';
    const dbClubId = Number.parseInt(rawDbClubIdString, 10);

    if (
      !rawDbClubIdString ||
      !/^\d+$/.test(rawDbClubIdString) ||
      !Number.isInteger(dbClubId) ||
      dbClubId <= 0
    ) {
      return res
        .status(400)
        .send({ error: true, message: 'Не указан ID клуба (x-club-id)' });
    }

    const club = await Club.findByPk(dbClubId);

    if (!club) {
      return res
        .status(400)
        .send({ error: true, message: 'Клуб не найден' });
    }

    const clubSettings = normalizeClubSettings(club.settings, club);
    club.setDataValue('settings', clubSettings);

    req.currentClub = club;
    req.currentClubSettings = clubSettings;
    req.dbClubId = dbClubId;
    req.smartshellCompanyId = clubSettings.smartshell.companyId;

    if (isPlatformAdmin(req.user)) {
      req.currentMembership = null;
      req.userClubRole = null;
      req.userRole = SYSTEM_ROLES.PLATFORM_ADMIN;
      return next();
    }

    const access = await UserClub.findOne({
      where: { user_id: req.user.id, club_id: dbClubId },
    });

    if (!access) {
      return res
        .status(403)
        .send({ error: true, message: 'У вас нет доступа к этому клубу' });
    }

    const accessData = access.get({ plain: true });
    const clubRole = normalizeClubRole(accessData.role);

    if (!clubRole) {
      return res
        .status(403)
        .send({ error: true, message: 'Некорректная роль в клубе' });
    }

    req.currentMembership = {
      ...accessData,
      role: clubRole,
      dbRole: accessData.role,
    };
    req.userClubRole = clubRole;
    req.userRole = clubRole;

    next();
  } catch (error) {
    console.error('checkClubAccess ERROR ->', error);
    return res
      .status(500)
      .send({ error: true, message: 'Ошибка проверки прав доступа' });
  }
};

module.exports = { checkClubAccess };
