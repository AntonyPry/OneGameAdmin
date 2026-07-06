'use strict';

const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { Club, User, UserClub, sequelize } = require('../models');
const {
  normalizeClubRole,
  normalizeSystemRole,
  toStorageClubRole,
  CLUB_ROLES,
  SYSTEM_ROLES,
} = require('../rbac/roles');
const { normalizeClubSettings } = require('../utils/clubSettings');
const {
  ENCRYPTION_KEY_ENV,
  CredentialsEncryptionError,
  encryptCredential,
} = require('../utils/credentialsCrypto');
const { invalidateManagerToken } = require('./token.service');

const USER_PUBLIC_ATTRIBUTES = [
  'id',
  'email',
  'first_name',
  'last_name',
  'system_role',
  'createdAt',
  'updatedAt',
];

const CLUB_PUBLIC_ATTRIBUTES = [
  'id',
  'smartshell_id',
  'name',
  'address',
  'opening_date',
  'settings',
  'createdAt',
  'updatedAt',
];

const MEMBERSHIP_ATTRIBUTES = [
  'id',
  'user_id',
  'club_id',
  'role',
  'createdAt',
  'updatedAt',
];

const SENSITIVE_SETTINGS_KEYS = [
  'password',
  'passphrase',
  'secret',
  'token',
  'credential',
  'apikey',
  'privatekey',
  'accesskey',
  'refreshkey',
  'refreshtoken',
  'login',
];

const SENSITIVE_SETTINGS_KEY_ALLOWLIST = new Set([
  'settings.motivation.penalties.secretGuestFailed',
]);

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new ApiError(400, message, details);
const notFound = (message) => new ApiError(404, message);
const conflict = (message) => new ApiError(409, message);
const forbidden = (message) => new ApiError(403, message);

const isPlainObject = (value) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const toPlain = (modelOrObject) =>
  modelOrObject?.get ? modelOrObject.get({ plain: true }) : modelOrObject;

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const normalizeKey = (key) => String(key).toLowerCase().replace(/[-_\s]/g, '');

const isSensitiveSettingsKey = (key) =>
  SENSITIVE_SETTINGS_KEYS.some((sensitiveKey) =>
    normalizeKey(key).includes(sensitiveKey),
  );

const isAllowedSensitiveSettingsPath = (path) =>
  SENSITIVE_SETTINGS_KEY_ALLOWLIST.has(path);

const assertNoSensitiveSettingsKeys = (value, path = 'settings') => {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoSensitiveSettingsKeys(item, `${path}[${index}]`),
    );
    return;
  }

  if (!isPlainObject(value)) return;

  Object.entries(value).forEach(([key, nestedValue]) => {
    const nestedPath = `${path}.${key}`;

    if (
      isSensitiveSettingsKey(key) &&
      !isAllowedSensitiveSettingsPath(nestedPath)
    ) {
      throw badRequest(
        `Поле ${nestedPath} похоже на секрет и не может сохраняться в settings`,
      );
    }

    assertNoSensitiveSettingsKeys(nestedValue, nestedPath);
  });
};

const assertNoSensitiveSettingsKeysOutsideSmartshell = (patch) => {
  const { smartshell, ...nonSmartshellPatch } = patch || {};
  void smartshell;
  assertNoSensitiveSettingsKeys(nonSmartshellPatch);
};

const sanitizeSmartshellForResponse = (
  smartshell = {},
  { includeManagerLogin = false } = {},
) => {
  const safeSmartshell = {};

  Object.entries(smartshell).forEach(([key, nestedValue]) => {
    if (
      [
        'managerPassword',
        'managerPasswordPlain',
        'managerPasswordEncrypted',
        'password',
      ].includes(key)
    ) {
      return;
    }

    if (key === 'managerLogin') {
      if (includeManagerLogin) safeSmartshell.managerLogin = nestedValue || '';
      return;
    }

    if (!isSensitiveSettingsKey(key)) {
      safeSmartshell[key] = sanitizeSettingsForResponse(nestedValue, {
        includeSmartshellManagerLogin: includeManagerLogin,
      });
    }
  });

  safeSmartshell.companyId = smartshell.companyId ?? null;
  safeSmartshell.hasManagerCredentials = Boolean(
    smartshell.hasManagerCredentials,
  );
  safeSmartshell.credentialsUpdatedAt =
    smartshell.credentialsUpdatedAt || null;

  if (includeManagerLogin && !hasOwn(safeSmartshell, 'managerLogin')) {
    safeSmartshell.managerLogin = '';
  }

  return safeSmartshell;
};

const sanitizeSettingsForResponse = (value, options = {}, path = 'settings') => {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeSettingsForResponse(item, options, `${path}[${index}]`),
    );
  }
  if (!isPlainObject(value)) return value;

  if (path === 'settings.smartshell') {
    return sanitizeSmartshellForResponse(value, {
      includeManagerLogin: Boolean(options.includeSmartshellManagerLogin),
    });
  }

  return Object.entries(value).reduce((safeValue, [key, nestedValue]) => {
    if (!isSensitiveSettingsKey(key)) {
      safeValue[key] = sanitizeSettingsForResponse(
        nestedValue,
        options,
        `${path}.${key}`,
      );
    }

    return safeValue;
  }, {});
};

const toCanonicalSettingsShape = (settings) => {
  const {
    salary_rates,
    bonuses,
    salaryRates,
    bonusRates,
    smartshellCompanyId,
    ...canonicalSettings
  } = settings;

  void salary_rates;
  void bonuses;
  void salaryRates;
  void bonusRates;
  void smartshellCompanyId;

  return canonicalSettings;
};

const assertPlainObject = (value, fieldName) => {
  if (!isPlainObject(value)) {
    throw badRequest(`${fieldName} должен быть объектом`);
  }
};

const trimString = (value, fieldName, { required = false } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) {
    if (required) throw badRequest(`${fieldName} обязателен`);
    return null;
  }

  const stringValue = String(value).trim();
  if (!stringValue && required) throw badRequest(`${fieldName} обязателен`);

  return stringValue || null;
};

const requiredString = (value, fieldName) =>
  trimString(value, fieldName, { required: true });

const parsePositiveInteger = (value, fieldName, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${fieldName} обязателен`);
    return undefined;
  }

  const valueString = String(value).trim();
  const parsedValue = Number.parseInt(valueString, 10);

  if (
    !/^\d+$/.test(valueString) ||
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    throw badRequest(`${fieldName} должен быть положительным целым числом`);
  }

  return parsedValue;
};

const parseDateOrNull = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${fieldName} должен быть корректной датой`);
  }

  return date;
};

const parseNonNegativeNumber = (value, fieldName) => {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw badRequest(`${fieldName} должен быть неотрицательным числом`);
  }

  return number;
};

const getFirstDefinedValue = (payload, fieldNames) => {
  for (const fieldName of fieldNames) {
    if (hasOwn(payload, fieldName)) return payload[fieldName];
  }

  return undefined;
};

const assertNoConflictingValues = (values, fieldName) => {
  const definedValues = values
    .filter(({ value }) => value !== undefined && value !== null && value !== '')
    .map(({ name, value }) => ({ name, value: String(value).trim() }));

  if (!definedValues.length) return undefined;

  const firstValue = definedValues[0].value;
  const hasConflict = definedValues.some(({ value }) => value !== firstValue);

  if (hasConflict) {
    throw badRequest(`${fieldName} передан в нескольких полях с разными значениями`);
  }

  return definedValues[0];
};

const getPayloadSmartshellCompanyId = (payload = {}) => {
  const settings = isPlainObject(payload.settings) ? payload.settings : {};
  const smartshell = isPlainObject(settings.smartshell)
    ? settings.smartshell
    : {};

  const candidate = assertNoConflictingValues(
    [
      { name: 'smartshell_id', value: payload.smartshell_id },
      { name: 'smartshellId', value: payload.smartshellId },
      { name: 'smartshellCompanyId', value: payload.smartshellCompanyId },
      {
        name: 'settings.smartshell.companyId',
        value: smartshell.companyId,
      },
    ],
    'Smartshell company id',
  );

  if (!candidate) return undefined;
  return parsePositiveInteger(candidate.value, candidate.name);
};

const validateSystemRole = (role) => {
  if (role === undefined) return undefined;

  const normalizedRole = normalizeSystemRole(role);
  if (!Object.values(SYSTEM_ROLES).includes(String(role).trim())) {
    throw badRequest('Некорректная системная роль');
  }

  return normalizedRole;
};

const validateClubRole = (role) => {
  const normalizedRole = normalizeClubRole(role);
  if (!normalizedRole || !Object.values(CLUB_ROLES).includes(normalizedRole)) {
    throw badRequest('Некорректная роль в клубе');
  }

  return normalizedRole;
};

const parseEmail = (value, { required = false } = {}) => {
  const email = trimString(value, 'email', { required });
  if (!email) return email;

  const normalizedEmail = email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw badRequest('Некорректный email');
  }

  return normalizedEmail;
};

const parsePassword = (payload, { required = false } = {}) => {
  const password = getFirstDefinedValue(payload, ['password', 'initialPassword']);

  if (password === undefined || password === null || password === '') {
    if (required) throw badRequest('password обязателен при создании пользователя');
    return undefined;
  }

  const passwordString = String(password);
  if (passwordString.length < 8) {
    throw badRequest('password должен быть не короче 8 символов');
  }

  return passwordString;
};

const serializeUserBase = (user) => {
  const plainUser = toPlain(user);
  const systemRole = normalizeSystemRole(plainUser.system_role);

  return {
    id: plainUser.id,
    email: plainUser.email,
    firstName: plainUser.first_name,
    first_name: plainUser.first_name,
    lastName: plainUser.last_name,
    last_name: plainUser.last_name,
    systemRole,
    system_role: systemRole,
    createdAt: plainUser.createdAt,
    updatedAt: plainUser.updatedAt,
  };
};

const serializeClubBase = (club, options = {}) => {
  const plainClub = toPlain(club);
  const settings = toCanonicalSettingsShape(
    normalizeClubSettings(plainClub.settings, plainClub),
  );

  return {
    id: plainClub.id,
    name: plainClub.name,
    address: plainClub.address,
    openingDate: plainClub.opening_date,
    opening_date: plainClub.opening_date,
    smartshellId: plainClub.smartshell_id,
    smartshell_id: plainClub.smartshell_id,
    smartshellCompanyId: settings.smartshell.companyId,
    settings: sanitizeSettingsForResponse(settings, {
      includeSmartshellManagerLogin:
        options.includeSmartshellManagerLogin !== false,
    }),
    createdAt: plainClub.createdAt,
    updatedAt: plainClub.updatedAt,
  };
};

const serializeMembership = (membership, { user, club } = {}) => {
  const plainMembership = toPlain(membership);
  const role = normalizeClubRole(plainMembership.role);

  return {
    id: plainMembership.id,
    userId: plainMembership.user_id,
    user_id: plainMembership.user_id,
    clubId: plainMembership.club_id,
    club_id: plainMembership.club_id,
    role,
    dbRole: plainMembership.role,
    db_role: plainMembership.role,
    user: user ? serializeUserBase(user) : undefined,
    club: club ? serializeClubBase(club) : undefined,
    createdAt: plainMembership.createdAt,
    updatedAt: plainMembership.updatedAt,
  };
};

const serializeUser = (user) => {
  const plainUser = toPlain(user);
  const serializedUser = serializeUserBase(plainUser);

  return {
    ...serializedUser,
    memberships: (plainUser.clubs || []).map((club) => {
      const plainClub = toPlain(club);
      return serializeMembership(plainClub.UserClub, {
        user: serializedUser,
        club: plainClub,
      });
    }),
  };
};

const serializeCurrentClubUser = (
  user,
  membership,
  club,
  { membershipCount = 1 } = {},
) => {
  const serializedUser = serializeUserBase(user);
  const serializedMembership = serializeMembership(membership, {
    user: serializedUser,
    club,
  });
  const safeMembershipCount = Number(membershipCount) || 0;

  return {
    ...serializedUser,
    membership: serializedMembership,
    memberships: [serializedMembership],
    membershipCount: safeMembershipCount,
    isSharedUser: safeMembershipCount > 1,
    canEditProfile: safeMembershipCount <= 1,
  };
};

const serializeClub = (club) => {
  const plainClub = toPlain(club);
  const serializedClub = serializeClubBase(plainClub);

  return {
    ...serializedClub,
    memberships: (plainClub.users || []).map((user) => {
      const plainUser = toPlain(user);
      return serializeMembership(plainUser.UserClub, {
        user: plainUser,
        club: serializedClub,
      });
    }),
  };
};

const userInclude = [
  {
    model: Club,
    as: 'clubs',
    attributes: CLUB_PUBLIC_ATTRIBUTES,
    through: { attributes: MEMBERSHIP_ATTRIBUTES },
  },
];

const clubInclude = [
  {
    model: User,
    as: 'users',
    attributes: USER_PUBLIC_ATTRIBUTES,
    through: { attributes: MEMBERSHIP_ATTRIBUTES },
  },
];

const findClubOrThrow = async (clubId, options = {}) => {
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const club = await Club.findByPk(dbClubId, {
    attributes: CLUB_PUBLIC_ATTRIBUTES,
    ...options,
  });

  if (!club) throw notFound('Клуб не найден');
  return club;
};

const findUserOrThrow = async (userId, options = {}) => {
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const user = await User.findByPk(dbUserId, {
    attributes: USER_PUBLIC_ATTRIBUTES,
    ...options,
  });

  if (!user) throw notFound('Пользователь не найден');
  return user;
};

const findMembershipRows = (userId, clubId, options = {}) =>
  UserClub.findAll({
    where: { user_id: userId, club_id: clubId },
    attributes: MEMBERSHIP_ATTRIBUTES,
    order: [['id', 'ASC']],
    ...options,
  });

const countUserMemberships = (userId, options = {}) =>
  UserClub.count({
    where: { user_id: userId },
    ...options,
  });

const countMembershipsByUserIds = async (userIds) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await UserClub.findAll({
    attributes: [
      'user_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'membershipCount'],
    ],
    where: { user_id: { [Op.in]: ids } },
    group: ['user_id'],
    raw: true,
  });

  return new Map(
    rows.map((row) => [
      Number(row.user_id),
      Number(row.membershipCount || row.membershipcount || 0),
    ]),
  );
};

const getCurrentClubUserInclude = (clubId) => [
  {
    model: Club,
    as: 'clubs',
    attributes: CLUB_PUBLIC_ATTRIBUTES,
    where: { id: clubId },
    through: { attributes: MEMBERSHIP_ATTRIBUTES },
    required: true,
  },
];

const assertOwnerPayloadDoesNotEditSystemRole = (payload) => {
  if (hasOwn(payload, 'system_role') || hasOwn(payload, 'systemRole')) {
    throw badRequest('Владельцу нельзя менять системную роль пользователя');
  }
};

const assertOwnerPayloadDoesNotEditPassword = (payload) => {
  if (hasOwn(payload, 'password') || hasOwn(payload, 'initialPassword')) {
    throw badRequest('Изменение пароля не входит в этот endpoint');
  }
};

const assertUserIsOwnerManageable = (user) => {
  const systemRole = normalizeSystemRole(toPlain(user).system_role);
  if (systemRole === SYSTEM_ROLES.PLATFORM_ADMIN) {
    throw forbidden('Владельцу нельзя управлять platform_admin');
  }
};

const hasOwnerProfilePatch = (payload) =>
  hasOwn(payload, 'email') ||
  hasOwn(payload, 'first_name') ||
  hasOwn(payload, 'firstName') ||
  hasOwn(payload, 'last_name') ||
  hasOwn(payload, 'lastName');

const assertOwnerCanEditProfile = async (userId, clubId, options = {}) => {
  const membershipCount = await countUserMemberships(userId, options);
  if (membershipCount > 1) {
    throw forbidden(
      'Нельзя менять профиль пользователя с доступом к нескольким клубам',
    );
  }

  if (membershipCount < 1) {
    throw notFound('Пользователь в текущем клубе не найден');
  }

  const dbClubMembershipCount = await UserClub.count({
    where: { user_id: userId, club_id: clubId },
    ...options,
  });

  if (dbClubMembershipCount !== 1) {
    throw notFound('Пользователь в текущем клубе не найден');
  }

  return membershipCount;
};

const getLockedOwnerMemberships = (clubId, transaction) =>
  UserClub.findAll({
    where: {
      club_id: clubId,
      role: toStorageClubRole(CLUB_ROLES.OWNER),
    },
    attributes: ['id', 'user_id'],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

const assertOwnerMembershipChangeAllowed = async ({
  actorUserId,
  clubId,
  userId,
  currentRole,
  nextRole,
  transaction,
}) => {
  const currentClubRole = normalizeClubRole(currentRole);
  const nextClubRole = nextRole ? normalizeClubRole(nextRole) : null;
  const removesOwner =
    currentClubRole === CLUB_ROLES.OWNER && nextClubRole !== CLUB_ROLES.OWNER;

  if (!removesOwner) return;

  if (Number(actorUserId) === Number(userId)) {
    throw forbidden('Нельзя удалить или понизить собственный доступ владельца');
  }

  const ownerMemberships = await getLockedOwnerMemberships(clubId, transaction);
  if (ownerMemberships.length <= 1) {
    throw forbidden('Нельзя оставить клуб без владельца');
  }
};

const findCurrentClubUserOrThrow = async (clubId, userId, options = {}) => {
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const user = await User.findOne({
    where: { id: dbUserId },
    attributes: USER_PUBLIC_ATTRIBUTES,
    include: getCurrentClubUserInclude(dbClubId),
    ...options,
  });

  if (!user) throw notFound('Пользователь в текущем клубе не найден');

  assertUserIsOwnerManageable(user);

  const plainUser = toPlain(user);
  const plainClub = plainUser.clubs[0];
  return {
    user,
    plainUser,
    club: plainClub,
    membership: plainClub.UserClub,
  };
};

const getDuplicateMembershipMessage = (userId, clubId, memberships) =>
  `Найдено несколько доступов пользователя ${userId} к клубу ${clubId}; ids=${memberships
    .map((membership) => membership.id)
    .join(',')}`;

const assertSingleMembershipRow = (userId, clubId, memberships) => {
  if (memberships.length <= 1) return;
  throw conflict(getDuplicateMembershipMessage(userId, clubId, memberships));
};

const assertEmailAvailable = async (email, currentUserId) => {
  const existingUser = await User.findOne({
    where: { email },
    attributes: ['id'],
  });

  if (existingUser && existingUser.id !== currentUserId) {
    throw conflict('Пользователь с таким email уже существует');
  }
};

const assertSmartshellIdAvailable = async (smartshellCompanyId, currentClubId) => {
  const existingClub = await Club.findOne({
    where: { smartshell_id: smartshellCompanyId },
    attributes: ['id'],
  });

  if (existingClub && existingClub.id !== currentClubId) {
    throw conflict('Клуб с таким Smartshell company id уже существует');
  }
};

const applyNumericSectionPatch = (
  currentSection,
  patchSection,
  sectionName,
  allowedKeys,
) => {
  assertPlainObject(patchSection, `settings.${sectionName}`);

  const nextSection = { ...currentSection };
  Object.entries(patchSection).forEach(([key, value]) => {
    if (!allowedKeys.includes(key)) {
      throw badRequest(`settings.${sectionName}.${key} не поддерживается`);
    }

    nextSection[key] = parseNonNegativeNumber(
      value,
      `settings.${sectionName}.${key}`,
    );
  });

  return nextSection;
};

const validateResponsibilityItems = (items) => {
  if (!Array.isArray(items)) {
    throw badRequest('settings.responsibilities.items должен быть массивом');
  }

  const seenKeys = new Set();

  return items.map((item, index) => {
    if (!isPlainObject(item)) {
      throw badRequest(`settings.responsibilities.items[${index}] должен быть объектом`);
    }

    const key = requiredString(
      item.key,
      `settings.responsibilities.items[${index}].key`,
    );

    if (seenKeys.has(key)) {
      throw badRequest(`Дублирующийся ключ чек-листа: ${key}`);
    }

    seenKeys.add(key);

    if (
      item.enabled !== undefined &&
      item.enabled !== null &&
      typeof item.enabled !== 'boolean'
    ) {
      throw badRequest(
        `settings.responsibilities.items[${index}].enabled должен быть boolean`,
      );
    }

    return {
      key,
      label:
        trimString(
          item.label,
          `settings.responsibilities.items[${index}].label`,
        ) || key,
      enabled:
        item.enabled === undefined || item.enabled === null ? true : item.enabled,
    };
  });
};

const applyResponsibilitiesPatch = (
  currentResponsibilities,
  patchResponsibilities,
  { allowCustomSettings },
) => {
  assertPlainObject(patchResponsibilities, 'settings.responsibilities');

  const nextResponsibilities = allowCustomSettings
    ? { ...currentResponsibilities, ...patchResponsibilities }
    : { ...currentResponsibilities };

  Object.keys(patchResponsibilities).forEach((key) => {
    if (!allowCustomSettings && key !== 'items') {
      throw badRequest(`settings.responsibilities.${key} не поддерживается`);
    }
  });

  if (hasOwn(patchResponsibilities, 'items')) {
    nextResponsibilities.items = validateResponsibilityItems(
      patchResponsibilities.items,
    );
  }

  return nextResponsibilities;
};

const applyNestedNumericPatch = (
  currentSection,
  patchSection,
  sectionName,
  allowedKeys,
  positiveIntegerKeys = [],
) => {
  assertPlainObject(patchSection, `settings.${sectionName}`);

  const nextSection = { ...currentSection };
  Object.entries(patchSection).forEach(([key, value]) => {
    if (!allowedKeys.includes(key)) {
      throw badRequest(`settings.${sectionName}.${key} не поддерживается`);
    }

    nextSection[key] = positiveIntegerKeys.includes(key)
      ? parsePositiveInteger(value, `settings.${sectionName}.${key}`, {
          required: true,
        })
      : parseNonNegativeNumber(value, `settings.${sectionName}.${key}`);
  });

  return nextSection;
};

const applyMotivationPatch = (currentMotivation, patchMotivation) => {
  assertPlainObject(patchMotivation, 'settings.motivation');

  const nextMotivation = {
    ...currentMotivation,
    basePay: { ...currentMotivation.basePay },
    penalties: {
      ...currentMotivation.penalties,
      longMessageResponse: {
        ...currentMotivation.penalties.longMessageResponse,
      },
      uncleanClub: {
        ...currentMotivation.penalties.uncleanClub,
      },
    },
    bonusRates: { ...currentMotivation.bonusRates },
  };

  Object.entries(patchMotivation).forEach(([key, value]) => {
    if (key === 'basePay') {
      nextMotivation.basePay = applyNumericSectionPatch(
        nextMotivation.basePay,
        value,
        'motivation.basePay',
        ['day', 'night'],
      );
      return;
    }

    if (key === 'taskCompletionBonus') {
      nextMotivation.taskCompletionBonus = parseNonNegativeNumber(
        value,
        'settings.motivation.taskCompletionBonus',
      );
      return;
    }

    if (key === 'bonusRates') {
      nextMotivation.bonusRates = applyNumericSectionPatch(
        nextMotivation.bonusRates,
        value,
        'motivation.bonusRates',
        ['bar', 'services', 'planMultiplier'],
      );
      return;
    }

    if (key === 'penalties') {
      assertPlainObject(value, 'settings.motivation.penalties');

      Object.entries(value).forEach(([penaltyKey, penaltyValue]) => {
        if (penaltyKey === 'longMessageResponse') {
          nextMotivation.penalties.longMessageResponse =
            applyNestedNumericPatch(
              nextMotivation.penalties.longMessageResponse,
              penaltyValue,
              'motivation.penalties.longMessageResponse',
              ['perCase', 'escalationCount', 'escalationPenalty'],
              ['escalationCount'],
            );
          return;
        }

        if (penaltyKey === 'uncleanClub') {
          nextMotivation.penalties.uncleanClub = applyNestedNumericPatch(
            nextMotivation.penalties.uncleanClub,
            penaltyValue,
            'motivation.penalties.uncleanClub',
            ['basePenalty', 'thresholdPlaces', 'escalationPenalty'],
            ['thresholdPlaces'],
          );
          return;
        }

        if (
          ![
            'dirtyKitchen',
            'missedCallNoCallback',
            'messyWorkspace',
            'strangersBehindDesk',
            'climateControl',
            'fridgeNotFilled',
            'loudSwearingPerCase',
            'secretGuestFailed',
          ].includes(penaltyKey)
        ) {
          throw badRequest(
            `settings.motivation.penalties.${penaltyKey} не поддерживается`,
          );
        }

        nextMotivation.penalties[penaltyKey] = parseNonNegativeNumber(
          penaltyValue,
          `settings.motivation.penalties.${penaltyKey}`,
        );
      });
      return;
    }

    throw badRequest(`settings.motivation.${key} не поддерживается`);
  });

  return nextMotivation;
};

const parseOptionalSmartshellLogin = (value) =>
  trimString(value, 'settings.smartshell.managerLogin');

const parseManagerPasswordUpdate = (patchSmartshell) => {
  if (!hasOwn(patchSmartshell, 'managerPassword')) return undefined;

  const value = patchSmartshell.managerPassword;
  if (value === undefined || value === null || value === '') return undefined;

  const password = String(value);
  if (!password.trim()) {
    throw badRequest('settings.smartshell.managerPassword не может быть пустым');
  }

  return password;
};

const encryptSmartshellManagerPassword = (password) => {
  try {
    return encryptCredential(password);
  } catch (error) {
    if (error instanceof CredentialsEncryptionError) {
      if (
        [
          'CREDENTIALS_ENCRYPTION_KEY_MISSING',
          'CREDENTIALS_ENCRYPTION_KEY_TOO_SHORT',
        ].includes(error.code)
      ) {
        throw badRequest(
          `${ENCRYPTION_KEY_ENV} не настроен: задайте длинный случайный ключ перед сохранением Smartshell manager password`,
        );
      }

      throw badRequest(error.message);
    }

    throw error;
  }
};

const smartshellTokenCacheFieldsChanged = (
  previousSettings,
  nextSettings,
  previousClub,
  nextClub = previousClub,
) => {
  const previous = normalizeClubSettings(previousSettings, previousClub).smartshell;
  const next = normalizeClubSettings(nextSettings, nextClub).smartshell;

  return (
    previous.companyId !== next.companyId ||
    previous.managerLogin !== next.managerLogin ||
    previous.managerPasswordEncrypted !== next.managerPasswordEncrypted
  );
};

const applySmartshellPatch = (currentSmartshell, patchSmartshell) => {
  assertPlainObject(patchSmartshell, 'settings.smartshell');

  Object.keys(patchSmartshell).forEach((key) => {
    if (!['companyId', 'managerLogin', 'managerPassword'].includes(key)) {
      throw badRequest(`settings.smartshell.${key} не поддерживается`);
    }
  });

  const nextSmartshell = {
    ...currentSmartshell,
    ...(hasOwn(patchSmartshell, 'companyId')
      ? {
          companyId: parsePositiveInteger(
            patchSmartshell.companyId,
            'settings.smartshell.companyId',
            { required: true },
          ),
        }
      : {}),
  };
  let credentialsChanged = hasOwn(patchSmartshell, 'companyId');

  if (hasOwn(patchSmartshell, 'managerLogin')) {
    const managerLogin = parseOptionalSmartshellLogin(
      patchSmartshell.managerLogin,
    );
    credentialsChanged =
      credentialsChanged || managerLogin !== nextSmartshell.managerLogin;
    nextSmartshell.managerLogin = managerLogin;
  }

  const nextManagerPassword = parseManagerPasswordUpdate(patchSmartshell);
  if (nextManagerPassword !== undefined) {
    nextSmartshell.managerPasswordEncrypted =
      encryptSmartshellManagerPassword(nextManagerPassword);
    credentialsChanged = true;
  }

  if (credentialsChanged) {
    nextSmartshell.credentialsUpdatedAt = new Date().toISOString();
  }

  return nextSmartshell;
};

const mergeSettingsPatch = ({
  currentSettings,
  patch,
  club,
  allowSmartshell = false,
  allowCustomSettings = false,
}) => {
  if (patch === undefined) {
    return normalizeClubSettings(currentSettings, club);
  }

  assertPlainObject(patch, 'settings');
  assertNoSensitiveSettingsKeysOutsideSmartshell(patch);

  const currentNormalizedSettings = normalizeClubSettings(currentSettings, club);
  const nextSettings = {
    ...currentNormalizedSettings,
    motivation: {
      ...currentNormalizedSettings.motivation,
      basePay: { ...currentNormalizedSettings.motivation.basePay },
      penalties: {
        ...currentNormalizedSettings.motivation.penalties,
        longMessageResponse: {
          ...currentNormalizedSettings.motivation.penalties.longMessageResponse,
        },
        uncleanClub: {
          ...currentNormalizedSettings.motivation.penalties.uncleanClub,
        },
      },
      bonusRates: { ...currentNormalizedSettings.motivation.bonusRates },
    },
    responsibilities: { ...currentNormalizedSettings.responsibilities },
    smartshell: { ...currentNormalizedSettings.smartshell },
  };

  Object.entries(patch).forEach(([key, value]) => {
    if (key === 'motivation') {
      nextSettings.motivation = applyMotivationPatch(
        nextSettings.motivation,
        value,
      );
      return;
    }

    if (key === 'responsibilities') {
      nextSettings.responsibilities = applyResponsibilitiesPatch(
        nextSettings.responsibilities,
        value,
        { allowCustomSettings },
      );
      return;
    }

    if (key === 'smartshell') {
      if (!allowSmartshell) {
        throw badRequest('settings.smartshell нельзя менять через этот endpoint');
      }

      nextSettings.smartshell = applySmartshellPatch(
        nextSettings.smartshell,
        value,
      );
      return;
    }

    if (!allowCustomSettings) {
      throw badRequest(`settings.${key} не поддерживается`);
    }

    nextSettings[key] = value;
  });

  return toCanonicalSettingsShape(normalizeClubSettings(nextSettings, club));
};

const getClubPayload = (payload) => {
  const name = getFirstDefinedValue(payload, ['name']);
  const address = getFirstDefinedValue(payload, ['address']);
  const openingDate = getFirstDefinedValue(payload, [
    'opening_date',
    'openingDate',
  ]);

  return {
    name,
    address,
    openingDate,
    smartshellCompanyId: getPayloadSmartshellCompanyId(payload),
    settingsPatch: payload.settings,
  };
};

const listClubs = async () => {
  const clubs = await Club.findAll({
    attributes: CLUB_PUBLIC_ATTRIBUTES,
    order: [['id', 'ASC']],
  });

  return clubs.map(serializeClubBase);
};

const getClub = async (clubId) => {
  const club = await findClubOrThrow(clubId, { include: clubInclude });
  return serializeClub(club);
};

const createClub = async (payload = {}) => {
  assertPlainObject(payload, 'body');

  const clubPayload = getClubPayload(payload);
  const smartshellCompanyId = parsePositiveInteger(
    clubPayload.smartshellCompanyId,
    'smartshellCompanyId',
    { required: true },
  );

  await assertSmartshellIdAvailable(smartshellCompanyId);

  const clubDraft = { smartshell_id: smartshellCompanyId };
  const settings = mergeSettingsPatch({
    currentSettings: { smartshell: { companyId: smartshellCompanyId } },
    patch: clubPayload.settingsPatch || {},
    club: clubDraft,
    allowSmartshell: true,
    allowCustomSettings: true,
  });
  settings.smartshell.companyId = smartshellCompanyId;

  const club = await Club.create({
    smartshell_id: smartshellCompanyId,
    name: requiredString(clubPayload.name, 'name'),
    address: trimString(clubPayload.address, 'address'),
    opening_date: parseDateOrNull(clubPayload.openingDate, 'opening_date'),
    settings,
  });

  return serializeClubBase(club);
};

const updateClub = async (clubId, payload = {}) => {
  assertPlainObject(payload, 'body');

  const club = await findClubOrThrow(clubId);
  const plainClub = toPlain(club);
  const clubPayload = getClubPayload(payload);
  const updatePayload = {};

  if (clubPayload.name !== undefined) {
    updatePayload.name = requiredString(clubPayload.name, 'name');
  }

  if (clubPayload.address !== undefined) {
    updatePayload.address = trimString(clubPayload.address, 'address');
  }

  if (clubPayload.openingDate !== undefined) {
    updatePayload.opening_date = parseDateOrNull(
      clubPayload.openingDate,
      'opening_date',
    );
  }

  const smartshellCompanyId =
    clubPayload.smartshellCompanyId === undefined
      ? plainClub.smartshell_id
      : clubPayload.smartshellCompanyId;

  if (clubPayload.smartshellCompanyId !== undefined) {
    await assertSmartshellIdAvailable(smartshellCompanyId, plainClub.id);
    updatePayload.smartshell_id = smartshellCompanyId;
  }

  if (
    clubPayload.settingsPatch !== undefined ||
    clubPayload.smartshellCompanyId !== undefined
  ) {
    const clubForSettings = {
      ...plainClub,
      smartshell_id: smartshellCompanyId,
    };

    updatePayload.settings = mergeSettingsPatch({
      currentSettings: plainClub.settings,
      patch: clubPayload.settingsPatch || {},
      club: clubForSettings,
      allowSmartshell: true,
      allowCustomSettings: true,
    });
    updatePayload.settings.smartshell.companyId = smartshellCompanyId;
  }

  if (!Object.keys(updatePayload).length) {
    return serializeClubBase(club);
  }

  const shouldInvalidateToken =
    updatePayload.settings &&
    smartshellTokenCacheFieldsChanged(
      plainClub.settings,
      updatePayload.settings,
      plainClub,
      {
        ...plainClub,
        smartshell_id: smartshellCompanyId,
      },
    );
  const updatedClub = await club.update(updatePayload);
  if (shouldInvalidateToken) invalidateManagerToken(plainClub.id);

  return serializeClubBase(updatedClub);
};

const updateClubSettings = async (clubId, settingsPatch = {}) => {
  const club = await findClubOrThrow(clubId);
  const plainClub = toPlain(club);
  const smartshellCompanyId =
    getPayloadSmartshellCompanyId({ settings: settingsPatch }) ||
    plainClub.smartshell_id;

  if (smartshellCompanyId !== plainClub.smartshell_id) {
    await assertSmartshellIdAvailable(smartshellCompanyId, plainClub.id);
  }

  const nextSettings = mergeSettingsPatch({
    currentSettings: plainClub.settings,
    patch: settingsPatch,
    club: { ...plainClub, smartshell_id: smartshellCompanyId },
    allowSmartshell: true,
    allowCustomSettings: true,
  });
  nextSettings.smartshell.companyId = smartshellCompanyId;
  const shouldInvalidateToken = smartshellTokenCacheFieldsChanged(
    plainClub.settings,
    nextSettings,
    plainClub,
    { ...plainClub, smartshell_id: smartshellCompanyId },
  );

  const updatedClub = await club.update({
    smartshell_id: smartshellCompanyId,
    settings: nextSettings,
  });
  if (shouldInvalidateToken) invalidateManagerToken(plainClub.id);

  return serializeClubBase(updatedClub);
};

const getCurrentClubSettings = async (clubId, options = {}) => {
  const club = await findClubOrThrow(clubId);
  return serializeClubBase(club, options);
};

const updateCurrentClubSettings = async (
  clubId,
  settingsPatch = {},
  options = {},
) => {
  const club = await findClubOrThrow(clubId);
  const plainClub = toPlain(club);
  const currentNormalizedSettings = normalizeClubSettings(
    plainClub.settings,
    plainClub,
  );
  const smartshellCompanyId =
    getPayloadSmartshellCompanyId({ settings: settingsPatch }) ||
    currentNormalizedSettings.smartshell.companyId ||
    plainClub.smartshell_id;

  if (smartshellCompanyId !== plainClub.smartshell_id) {
    await assertSmartshellIdAvailable(smartshellCompanyId, plainClub.id);
  }

  const nextSettings = mergeSettingsPatch({
    currentSettings: plainClub.settings,
    patch: settingsPatch,
    club: { ...plainClub, smartshell_id: smartshellCompanyId },
    allowSmartshell: true,
    allowCustomSettings: false,
  });
  nextSettings.smartshell.companyId = smartshellCompanyId;
  const shouldInvalidateToken = smartshellTokenCacheFieldsChanged(
    plainClub.settings,
    nextSettings,
    plainClub,
    { ...plainClub, smartshell_id: smartshellCompanyId },
  );

  const updatedClub = await club.update({
    smartshell_id: smartshellCompanyId,
    settings: nextSettings,
  });
  if (shouldInvalidateToken) invalidateManagerToken(plainClub.id);

  return serializeClubBase(updatedClub, options);
};

const listCurrentClubUsers = async (clubId) => {
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const users = await User.findAll({
    attributes: USER_PUBLIC_ATTRIBUTES,
    include: getCurrentClubUserInclude(dbClubId),
    order: [
      ['last_name', 'ASC'],
      ['first_name', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const ownerManageableUsers = users.filter(
    (user) =>
      normalizeSystemRole(toPlain(user).system_role) !==
      SYSTEM_ROLES.PLATFORM_ADMIN,
  );
  const membershipCountsByUserId = await countMembershipsByUserIds(
    ownerManageableUsers.map((user) => user.id),
  );

  return ownerManageableUsers.map((user) => {
    const plainUser = toPlain(user);
    const plainClub = plainUser.clubs[0];
    return serializeCurrentClubUser(plainUser, plainClub.UserClub, plainClub, {
      membershipCount: membershipCountsByUserId.get(Number(plainUser.id)) || 1,
    });
  });
};

const getCurrentClubUser = async (clubId, userId) => {
  const { plainUser, club, membership } = await findCurrentClubUserOrThrow(
    clubId,
    userId,
  );
  const membershipCount = await countUserMemberships(plainUser.id);
  return serializeCurrentClubUser(plainUser, membership, club, {
    membershipCount,
  });
};

const createCurrentClubUser = async (clubId, payload = {}) => {
  assertPlainObject(payload, 'body');
  assertOwnerPayloadDoesNotEditSystemRole(payload);

  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const role = validateClubRole(payload.role);
  const storageRole = toStorageClubRole(role);
  const email = parseEmail(payload.email, { required: true });
  await assertEmailAvailable(email);

  const password = parsePassword(payload, { required: true });
  const passwordHash = await bcrypt.hash(password, 10);
  const club = await findClubOrThrow(dbClubId);

  return sequelize.transaction(async (transaction) => {
    const user = await User.create(
      {
        email,
        password_hash: passwordHash,
        first_name: requiredString(
          payload.first_name ?? payload.firstName,
          'first_name',
        ),
        last_name: requiredString(
          payload.last_name ?? payload.lastName,
          'last_name',
        ),
        system_role: SYSTEM_ROLES.USER,
      },
      { transaction },
    );
    const membership = await UserClub.create(
      {
        user_id: user.id,
        club_id: dbClubId,
        role: storageRole,
      },
      { transaction },
    );

    return serializeCurrentClubUser(user, membership, club, {
      membershipCount: 1,
    });
  });
};

const updateCurrentClubUser = async (clubId, userId, payload = {}) => {
  assertPlainObject(payload, 'body');
  assertOwnerPayloadDoesNotEditSystemRole(payload);
  assertOwnerPayloadDoesNotEditPassword(payload);

  const { user, membership, club } = await findCurrentClubUserOrThrow(
    clubId,
    userId,
  );
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const updatePayload = {};
  let membershipCount = await countUserMemberships(dbUserId);

  if (hasOwnerProfilePatch(payload)) {
    membershipCount = await assertOwnerCanEditProfile(dbUserId, dbClubId);
  }

  if (hasOwn(payload, 'email')) {
    const email = parseEmail(payload.email, { required: true });
    await assertEmailAvailable(email, user.id);
    updatePayload.email = email;
  }

  if (hasOwn(payload, 'first_name') || hasOwn(payload, 'firstName')) {
    updatePayload.first_name = requiredString(
      payload.first_name ?? payload.firstName,
      'first_name',
    );
  }

  if (hasOwn(payload, 'last_name') || hasOwn(payload, 'lastName')) {
    updatePayload.last_name = requiredString(
      payload.last_name ?? payload.lastName,
      'last_name',
    );
  }

  const updatedUser = Object.keys(updatePayload).length
    ? await user.update(updatePayload)
    : user;

  return serializeCurrentClubUser(updatedUser, membership, club, {
    membershipCount,
  });
};

const upsertCurrentClubUserMembership = async (
  clubId,
  userId,
  payload = {},
  { actorUserId } = {},
) => {
  assertPlainObject(payload, 'body');

  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const role = validateClubRole(payload.role);
  const storageRole = toStorageClubRole(role);
  const [user, club] = await Promise.all([
    findUserOrThrow(dbUserId),
    findClubOrThrow(dbClubId),
  ]);

  assertUserIsOwnerManageable(user);

  const membership = await sequelize.transaction(async (transaction) => {
    const memberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    assertSingleMembershipRow(dbUserId, dbClubId, memberships);

    if (memberships[0]) {
      await assertOwnerMembershipChangeAllowed({
        actorUserId,
        clubId: dbClubId,
        userId: dbUserId,
        currentRole: memberships[0].role,
        nextRole: role,
        transaction,
      });
      return memberships[0].update({ role: storageRole }, { transaction });
    }

    return UserClub.create(
      {
        user_id: dbUserId,
        club_id: dbClubId,
        role: storageRole,
      },
      { transaction },
    );
  });

  const membershipCount = await countUserMemberships(dbUserId);
  return serializeCurrentClubUser(user, membership, club, { membershipCount });
};

const updateCurrentClubUserMembership = async (
  clubId,
  userId,
  payload = {},
  { actorUserId } = {},
) => {
  assertPlainObject(payload, 'body');

  const role = validateClubRole(payload.role);
  const storageRole = toStorageClubRole(role);
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const { user, club } = await findCurrentClubUserOrThrow(
    clubId,
    userId,
  );
  const updatedMembership = await sequelize.transaction(async (transaction) => {
    const memberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    assertSingleMembershipRow(dbUserId, dbClubId, memberships);

    if (!memberships[0]) {
      throw notFound('Доступ пользователя к клубу не найден');
    }

    await assertOwnerMembershipChangeAllowed({
      actorUserId,
      clubId: dbClubId,
      userId: dbUserId,
      currentRole: memberships[0].role,
      nextRole: role,
      transaction,
    });

    return memberships[0].update({ role: storageRole }, { transaction });
  });
  const membershipCount = await countUserMemberships(dbUserId);

  return serializeCurrentClubUser(user, updatedMembership, club, {
    membershipCount,
  });
};

const removeCurrentClubUserMembership = async (
  clubId,
  userId,
  { actorUserId } = {},
) => {
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const { user, club } = await findCurrentClubUserOrThrow(
    clubId,
    userId,
  );
  const membershipCount = await countUserMemberships(dbUserId);

  return sequelize.transaction(async (transaction) => {
    const memberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    assertSingleMembershipRow(dbUserId, dbClubId, memberships);

    if (!memberships[0]) {
      throw notFound('Доступ пользователя к клубу не найден');
    }

    await assertOwnerMembershipChangeAllowed({
      actorUserId,
      clubId: dbClubId,
      userId: dbUserId,
      currentRole: memberships[0].role,
      nextRole: null,
      transaction,
    });

    const serializedUser = serializeCurrentClubUser(user, memberships[0], club, {
      membershipCount,
    });
    const deletedCount = await UserClub.destroy({
      where: {
        user_id: dbUserId,
        club_id: dbClubId,
      },
      transaction,
    });

    return {
      ...serializedUser,
      deletedCount,
      deletedMembershipIds: [memberships[0].id],
    };
  });
};

const listUsers = async () => {
  const users = await User.findAll({
    attributes: USER_PUBLIC_ATTRIBUTES,
    include: userInclude,
    order: [['id', 'ASC']],
  });

  return users.map(serializeUser);
};

const getUser = async (userId) => {
  const user = await findUserOrThrow(userId, { include: userInclude });
  return serializeUser(user);
};

const createUser = async (payload = {}) => {
  assertPlainObject(payload, 'body');

  const email = parseEmail(payload.email, { required: true });
  await assertEmailAvailable(email);

  const password = parsePassword(payload, { required: true });
  const passwordHash = await bcrypt.hash(password, 10);
  const systemRole = validateSystemRole(payload.system_role ?? payload.systemRole);

  const user = await User.create({
    email,
    password_hash: passwordHash,
    first_name: requiredString(
      payload.first_name ?? payload.firstName,
      'first_name',
    ),
    last_name: requiredString(payload.last_name ?? payload.lastName, 'last_name'),
    system_role: systemRole || SYSTEM_ROLES.USER,
  });

  return serializeUserBase(user);
};

const updateUser = async (userId, payload = {}, { actorUserId } = {}) => {
  assertPlainObject(payload, 'body');

  if (hasOwn(payload, 'password') || hasOwn(payload, 'initialPassword')) {
    throw badRequest('Изменение пароля не входит в этот endpoint');
  }

  const user = await findUserOrThrow(userId);
  const updatePayload = {};

  if (hasOwn(payload, 'email')) {
    const email = parseEmail(payload.email, { required: true });
    await assertEmailAvailable(email, user.id);
    updatePayload.email = email;
  }

  if (hasOwn(payload, 'first_name') || hasOwn(payload, 'firstName')) {
    updatePayload.first_name = requiredString(
      payload.first_name ?? payload.firstName,
      'first_name',
    );
  }

  if (hasOwn(payload, 'last_name') || hasOwn(payload, 'lastName')) {
    updatePayload.last_name = requiredString(
      payload.last_name ?? payload.lastName,
      'last_name',
    );
  }

  if (hasOwn(payload, 'system_role') || hasOwn(payload, 'systemRole')) {
    const systemRole = validateSystemRole(
      payload.system_role ?? payload.systemRole,
    );

    if (user.id === actorUserId && systemRole !== SYSTEM_ROLES.PLATFORM_ADMIN) {
      throw badRequest('Нельзя убрать platform_admin у текущего пользователя');
    }

    updatePayload.system_role = systemRole;
  }

  if (!Object.keys(updatePayload).length) {
    return serializeUserBase(user);
  }

  const updatedUser = await user.update(updatePayload);
  return serializeUserBase(updatedUser);
};

const upsertUserMembership = async (userId, payload = {}) => {
  assertPlainObject(payload, 'body');

  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const dbClubId = parsePositiveInteger(
    payload.clubId ?? payload.club_id,
    'clubId',
    { required: true },
  );
  const role = validateClubRole(payload.role);
  const storageRole = toStorageClubRole(role);

  const [user, club] = await Promise.all([
    findUserOrThrow(dbUserId),
    findClubOrThrow(dbClubId),
  ]);

  const membership = await sequelize.transaction(async (transaction) => {
    const memberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    assertSingleMembershipRow(dbUserId, dbClubId, memberships);

    if (memberships[0]) {
      return memberships[0].update({ role: storageRole }, { transaction });
    }

    await UserClub.upsert(
      {
        user_id: dbUserId,
        club_id: dbClubId,
        role: storageRole,
      },
      { transaction },
    );

    const upsertedMemberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    assertSingleMembershipRow(dbUserId, dbClubId, upsertedMemberships);

    if (!upsertedMemberships[0]) {
      throw new Error('Membership upsert did not return a persisted row');
    }

    return upsertedMemberships[0];
  });

  return serializeMembership(membership, { user, club });
};

const updateUserMembership = async (userId, clubId, payload = {}) => {
  assertPlainObject(payload, 'body');

  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const role = validateClubRole(payload.role);
  const storageRole = toStorageClubRole(role);
  const [user, club] = await Promise.all([
    findUserOrThrow(dbUserId),
    findClubOrThrow(dbClubId),
  ]);

  const updatedMembership = await sequelize.transaction(async (transaction) => {
    const memberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    assertSingleMembershipRow(dbUserId, dbClubId, memberships);

    if (!memberships[0]) {
      throw notFound('Доступ пользователя к клубу не найден');
    }

    return memberships[0].update({ role: storageRole }, { transaction });
  });
  return serializeMembership(updatedMembership, { user, club });
};

const removeUserMembership = async (userId, clubId) => {
  const dbUserId = parsePositiveInteger(userId, 'userId', { required: true });
  const dbClubId = parsePositiveInteger(clubId, 'clubId', { required: true });
  const [user, club] = await Promise.all([
    findUserOrThrow(dbUserId),
    findClubOrThrow(dbClubId),
  ]);

  return sequelize.transaction(async (transaction) => {
    const memberships = await findMembershipRows(dbUserId, dbClubId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!memberships.length) {
      throw notFound('Доступ пользователя к клубу не найден');
    }

    const serializedMembership = serializeMembership(memberships[0], {
      user,
      club,
    });
    const deletedMembershipIds = memberships.map((membership) => membership.id);

    await UserClub.destroy({
      where: { user_id: dbUserId, club_id: dbClubId },
      transaction,
    });

    return {
      ...serializedMembership,
      deletedCount: memberships.length,
      deletedMembershipIds,
    };
  });
};

module.exports = {
  ApiError,
  listClubs,
  getClub,
  createClub,
  updateClub,
  updateClubSettings,
  getCurrentClubSettings,
  updateCurrentClubSettings,
  listCurrentClubUsers,
  getCurrentClubUser,
  createCurrentClubUser,
  updateCurrentClubUser,
  upsertCurrentClubUserMembership,
  updateCurrentClubUserMembership,
  removeCurrentClubUserMembership,
  listUsers,
  getUser,
  createUser,
  updateUser,
  upsertUserMembership,
  updateUserMembership,
  removeUserMembership,
  __testing: {
    mergeSettingsPatch,
    sanitizeSettingsForResponse,
    smartshellTokenCacheFieldsChanged,
  },
};
