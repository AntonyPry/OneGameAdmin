export const SYSTEM_ROLES = Object.freeze({
  USER: 'user',
  PLATFORM_ADMIN: 'platform_admin',
});

export const CLUB_ROLES = Object.freeze({
  OWNER: 'owner',
  MANAGER: 'manager',
  CLUB_ADMIN: 'club_admin',
});

export const AUTH_STORAGE_KEYS = Object.freeze({
  SESSION: 'onegame.auth.session',
});

export const AUTH_EVENTS = Object.freeze({
  UNAUTHORIZED: 'onegame.auth.unauthorized',
  FORBIDDEN: 'onegame.auth.forbidden',
  SESSION_CHANGED: 'onegame.auth.session_changed',
});

const LEGACY_LOCAL_STORAGE_KEYS = [
  'accessToken',
  'accessLevel',
  'activeClubId',
  'onegame.auth.token',
];
const CLUB_ROLE_VALUES = Object.values(CLUB_ROLES);
const SYSTEM_ROLE_VALUES = Object.values(SYSTEM_ROLES);

export const ROLE_LABELS = Object.freeze({
  [SYSTEM_ROLES.PLATFORM_ADMIN]: 'Платформенный админ',
  [CLUB_ROLES.OWNER]: 'Владелец',
  [CLUB_ROLES.MANAGER]: 'Менеджер',
  [CLUB_ROLES.CLUB_ADMIN]: 'Админ клуба',
});

const isBrowser = () => typeof window !== 'undefined' && window.localStorage;

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

export const normalizeSystemRole = (role) => {
  const value = role ? String(role).trim() : SYSTEM_ROLES.USER;
  return SYSTEM_ROLE_VALUES.includes(value) ? value : SYSTEM_ROLES.USER;
};

export const normalizeClubRole = (role) => {
  if (!role) return null;

  const value = String(role).trim();
  const normalized = value === 'admin' ? CLUB_ROLES.CLUB_ADMIN : value;
  return CLUB_ROLE_VALUES.includes(normalized) ? normalized : null;
};

const compactObject = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );

const normalizeClub = (rawClub, fallbackClubId = null) => {
  const club = rawClub || {};
  const id = normalizeId(
    club.id ?? club.clubId ?? club.club_id ?? fallbackClubId,
  );

  return compactObject({
    id,
    smartshellId: club.smartshellId ?? club.smartshell_id ?? null,
    smartshell_id: club.smartshell_id ?? club.smartshellId ?? null,
    name: club.name || (id ? `Клуб #${id}` : 'Клуб'),
    address: club.address || '',
    openingDate: club.openingDate ?? club.opening_date ?? null,
    opening_date: club.opening_date ?? club.openingDate ?? null,
  });
};

const getMembershipRole = (raw) =>
  normalizeClubRole(
    raw?.role ??
      raw?.dbRole ??
      raw?.db_role ??
      raw?.membership?.role ??
      raw?.membership?.dbRole ??
      raw?.membership?.db_role ??
      raw?.UserClub?.canonicalRole ??
      raw?.UserClub?.role,
  );

export const normalizeMembership = (raw) => {
  if (!raw) return null;

  const rawClub = raw.club || raw;
  const clubId = normalizeId(
    raw.clubId ??
      raw.club_id ??
      rawClub.id ??
      raw.membership?.clubId ??
      raw.membership?.club_id ??
      raw.UserClub?.club_id,
  );
  const role = getMembershipRole(raw);

  if (!clubId || !role) return null;

  return {
    id: normalizeId(raw.id ?? raw.membership?.id ?? raw.UserClub?.id),
    userId: normalizeId(
      raw.userId ??
        raw.user_id ??
        raw.membership?.userId ??
        raw.membership?.user_id ??
        raw.UserClub?.user_id,
    ),
    clubId,
    role,
    dbRole:
      raw.dbRole ??
      raw.db_role ??
      raw.membership?.dbRole ??
      raw.membership?.db_role ??
      raw.UserClub?.role ??
      role,
    club: normalizeClub(rawClub, clubId),
  };
};

const normalizeMemberships = (payload) => {
  const memberships = Array.isArray(payload?.memberships)
    ? payload.memberships
    : [];
  const clubs = Array.isArray(payload?.clubs)
    ? payload.clubs
    : Array.isArray(payload?.user?.clubs)
      ? payload.user.clubs
      : [];

  const normalized = [...memberships, ...clubs]
    .map(normalizeMembership)
    .filter(Boolean);
  const byClubId = new Map();

  normalized.forEach((membership) => {
    byClubId.set(membership.clubId, membership);
  });

  return Array.from(byClubId.values());
};

const pickActiveClubId = (
  memberships,
  preferredClubId,
  { allowUnassignedClub = false } = {},
) => {
  const preferred = normalizeId(preferredClubId);
  if (preferred && allowUnassignedClub) return preferred;

  if (
    preferred &&
    memberships.some((membership) => membership.clubId === preferred)
  ) {
    return preferred;
  }

  return memberships[0]?.clubId || null;
};

export const createEmptySession = () => ({
  token: null,
  user: null,
  memberships: [],
  activeClubId: null,
  activeClubRole: null,
  systemRole: SYSTEM_ROLES.USER,
});

export const buildAuthSession = (payload = {}, options = {}) => {
  const previous = options.previous || createEmptySession();
  const token = payload.token || options.token || previous.token || null;
  const user = payload.user || previous.user || null;
  const systemRole = normalizeSystemRole(
    payload.systemRole ??
      payload.system_role ??
      user?.systemRole ??
      user?.system_role ??
      previous.systemRole,
  );
  const memberships = normalizeMemberships(payload);
  const effectiveMemberships =
    memberships.length > 0 ? memberships : previous.memberships || [];
  const activeClubId = pickActiveClubId(
    effectiveMemberships,
    options.activeClubId ?? payload.activeClubId ?? previous.activeClubId,
    { allowUnassignedClub: systemRole === SYSTEM_ROLES.PLATFORM_ADMIN },
  );
  const activeMembership =
    effectiveMemberships.find(
      (membership) => membership.clubId === activeClubId,
    ) || null;

  return {
    token,
    user: user
      ? {
          ...user,
          systemRole,
          system_role: systemRole,
        }
      : null,
    memberships: effectiveMemberships,
    activeClubId,
    activeClubRole: activeMembership?.role || null,
    systemRole,
  };
};

export const readAuthSession = () => {
  if (!isBrowser()) return createEmptySession();

  try {
    const serialized = window.localStorage.getItem(AUTH_STORAGE_KEYS.SESSION);
    const parsed = serialized ? JSON.parse(serialized) : {};
    const token =
      parsed.token ||
      window.localStorage.getItem('accessToken') ||
      window.localStorage.getItem('onegame.auth.token') ||
      null;

    return buildAuthSession(
      {
        ...parsed,
        token,
      },
      {
        activeClubId:
          parsed.activeClubId || window.localStorage.getItem('activeClubId'),
      },
    );
  } catch (error) {
    return createEmptySession();
  }
};

export const writeAuthSession = (session) => {
  if (!isBrowser()) return session;

  const nextSession = buildAuthSession(session, {
    previous: readAuthSession(),
  });

  window.localStorage.setItem(
    AUTH_STORAGE_KEYS.SESSION,
    JSON.stringify(nextSession),
  );

  LEGACY_LOCAL_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });

  window.dispatchEvent(
    new CustomEvent(AUTH_EVENTS.SESSION_CHANGED, { detail: nextSession }),
  );

  return nextSession;
};

export const clearAuthSession = () => {
  if (!isBrowser()) return createEmptySession();

  window.localStorage.removeItem(AUTH_STORAGE_KEYS.SESSION);
  LEGACY_LOCAL_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });

  const emptySession = createEmptySession();
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENTS.SESSION_CHANGED, { detail: emptySession }),
  );

  return emptySession;
};

export const getAccessToken = () => readAuthSession().token;

export const getActiveClubId = () => readAuthSession().activeClubId;

export const isAuthenticatedSession = (session) => Boolean(session?.token);

export const isPlatformAdminSession = (session) =>
  normalizeSystemRole(session?.systemRole) === SYSTEM_ROLES.PLATFORM_ADMIN;

export const hasActiveClub = (session) => Boolean(session?.activeClubId);

export const setSessionActiveClub = (session, clubId) =>
  buildAuthSession(
    {
      ...session,
      activeClubId: clubId,
    },
    {
      previous: session,
      activeClubId: clubId,
    },
  );

export const hasRouteAccess = (
  session,
  { requiredSystemRoles = [], requiredClubRoles = [], allowPlatformAdmin = true },
) => {
  if (!isAuthenticatedSession(session)) return false;

  const systemRoles = Array.isArray(requiredSystemRoles)
    ? requiredSystemRoles
    : [requiredSystemRoles];
  const clubRoles = Array.isArray(requiredClubRoles)
    ? requiredClubRoles
    : [requiredClubRoles];

  if (
    systemRoles.length > 0 &&
    systemRoles
      .map(normalizeSystemRole)
      .includes(normalizeSystemRole(session.systemRole))
  ) {
    return true;
  }

  if (allowPlatformAdmin && isPlatformAdminSession(session)) {
    return true;
  }

  if (clubRoles.length === 0) return systemRoles.length === 0;

  const normalizedActiveRole = normalizeClubRole(session.activeClubRole);
  return clubRoles.map(normalizeClubRole).includes(normalizedActiveRole);
};

export const getDefaultAuthorizedPath = (session) => {
  if (!isAuthenticatedSession(session)) return '/login';
  if (isPlatformAdminSession(session)) return '/dashboard';

  const activeRole = normalizeClubRole(session.activeClubRole);
  if ([CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER].includes(activeRole)) {
    return '/export';
  }
  if (activeRole === CLUB_ROLES.CLUB_ADMIN) return '/admin';

  return null;
};

export const getActiveMembership = (session) =>
  (session?.memberships || []).find(
    (membership) => membership.clubId === session?.activeClubId,
  ) || null;
