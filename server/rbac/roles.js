'use strict';

const SYSTEM_ROLES = Object.freeze({
  USER: 'user',
  PLATFORM_ADMIN: 'platform_admin',
});

const CLUB_ROLES = Object.freeze({
  OWNER: 'owner',
  MANAGER: 'manager',
  CLUB_ADMIN: 'club_admin',
});

const LEGACY_CLUB_ROLE_ALIASES = Object.freeze({
  admin: CLUB_ROLES.CLUB_ADMIN,
});

const PERMISSIONS = Object.freeze({
  PLATFORM_MANAGE: 'platform:manage',
  ADMIN_PANEL_READ: 'club:admin_panel:read',
  PLANS_READ: 'club:plans:read',
  PLANS_WRITE: 'club:plans:write',
  PAYMENTS_EXPORT: 'club:payments:export',
  CHECKLIST_CONFIRM: 'club:checklist:confirm',
});

const SYSTEM_ROLE_PERMISSIONS = Object.freeze({
  [SYSTEM_ROLES.USER]: Object.freeze([]),
  [SYSTEM_ROLES.PLATFORM_ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
});

const CLUB_ROLE_PERMISSIONS = Object.freeze({
  [CLUB_ROLES.OWNER]: Object.freeze([
    PERMISSIONS.ADMIN_PANEL_READ,
    PERMISSIONS.PLANS_READ,
    PERMISSIONS.PLANS_WRITE,
    PERMISSIONS.PAYMENTS_EXPORT,
    PERMISSIONS.CHECKLIST_CONFIRM,
  ]),
  [CLUB_ROLES.MANAGER]: Object.freeze([
    PERMISSIONS.ADMIN_PANEL_READ,
    PERMISSIONS.PLANS_READ,
    PERMISSIONS.PLANS_WRITE,
    PERMISSIONS.PAYMENTS_EXPORT,
    PERMISSIONS.CHECKLIST_CONFIRM,
  ]),
  [CLUB_ROLES.CLUB_ADMIN]: Object.freeze([PERMISSIONS.ADMIN_PANEL_READ]),
});

const ROUTE_ROLES = Object.freeze({
  adminPanel: Object.freeze([
    CLUB_ROLES.CLUB_ADMIN,
    CLUB_ROLES.MANAGER,
    CLUB_ROLES.OWNER,
  ]),
  plansRead: Object.freeze([CLUB_ROLES.MANAGER, CLUB_ROLES.OWNER]),
  plansWrite: Object.freeze([CLUB_ROLES.MANAGER, CLUB_ROLES.OWNER]),
  paymentsExport: Object.freeze([CLUB_ROLES.MANAGER, CLUB_ROLES.OWNER]),
  checklistConfirm: Object.freeze([CLUB_ROLES.MANAGER, CLUB_ROLES.OWNER]),
});

const SYSTEM_ROLE_VALUES = Object.freeze(Object.values(SYSTEM_ROLES));
const CLUB_ROLE_VALUES = Object.freeze(Object.values(CLUB_ROLES));

const flattenRoles = (roles) =>
  (Array.isArray(roles) ? roles : [roles]).flat().filter(Boolean);

const normalizeSystemRole = (role) => {
  const value = role ? String(role).trim() : SYSTEM_ROLES.USER;
  return SYSTEM_ROLE_VALUES.includes(value) ? value : SYSTEM_ROLES.USER;
};

const normalizeClubRole = (role) => {
  if (!role) return null;

  const value = String(role).trim();
  const normalized = LEGACY_CLUB_ROLE_ALIASES[value] || value;
  return CLUB_ROLE_VALUES.includes(normalized) ? normalized : null;
};

const toStorageClubRole = (role) => {
  const normalized = normalizeClubRole(role);
  if (!normalized) return null;
  return normalized === CLUB_ROLES.CLUB_ADMIN ? 'admin' : normalized;
};

const isPlatformAdminRole = (role) =>
  normalizeSystemRole(role) === SYSTEM_ROLES.PLATFORM_ADMIN;

const isPlatformAdmin = (user) =>
  isPlatformAdminRole(user?.systemRole || user?.system_role);

const hasSystemRole = (user, roles) => {
  const allowedRoles = flattenRoles(roles).map(normalizeSystemRole);
  return allowedRoles.includes(
    normalizeSystemRole(user?.systemRole || user?.system_role),
  );
};

const hasClubRole = (role, roles) => {
  const normalizedRole = normalizeClubRole(role);
  const allowedRoles = flattenRoles(roles).map(normalizeClubRole);
  return Boolean(normalizedRole && allowedRoles.includes(normalizedRole));
};

const systemRoleHasPermission = (role, permission) =>
  (SYSTEM_ROLE_PERMISSIONS[normalizeSystemRole(role)] || []).includes(
    permission,
  );

const clubRoleHasPermission = (role, permission) => {
  const normalizedRole = normalizeClubRole(role);
  return Boolean(
    normalizedRole &&
      (CLUB_ROLE_PERMISSIONS[normalizedRole] || []).includes(permission),
  );
};

module.exports = {
  SYSTEM_ROLES,
  CLUB_ROLES,
  PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  CLUB_ROLE_PERMISSIONS,
  ROUTE_ROLES,
  normalizeSystemRole,
  normalizeClubRole,
  toStorageClubRole,
  isPlatformAdminRole,
  isPlatformAdmin,
  hasSystemRole,
  hasClubRole,
  systemRoleHasPermission,
  clubRoleHasPermission,
};
