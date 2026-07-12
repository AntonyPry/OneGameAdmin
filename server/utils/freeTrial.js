'use strict';

const TRIAL_STATS_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const TRIAL_DATE_FORMAT_MESSAGE =
  'freeTrialExpiresAt должен быть датой YYYY-MM-DD или ISO datetime';

const pad = (value) => String(value).padStart(2, '0');

const formatDateTime = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );

const addDays = (date, amount) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );

const getRawTrialExpiresAt = (user = {}) =>
  user.free_trial_expires_at ?? user.freeTrialExpiresAt ?? null;

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(String(value).trim().replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

const assertValidCalendarDate = (year, month, day, fieldName) => {
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${fieldName} должен быть корректной календарной датой`);
  }

  return date;
};

const parseFreeTrialExpiresAt = (
  value,
  { fieldName = 'freeTrialExpiresAt' } = {},
) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} должен быть корректной датой`);
    }
    return value;
  }

  const stringValue = String(value).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stringValue);

  if (dateOnlyMatch) {
    const [, rawYear, rawMonth, rawDay] = dateOnlyMatch;
    return assertValidCalendarDate(
      Number(rawYear),
      Number(rawMonth),
      Number(rawDay),
      fieldName,
    );
  }

  const dateTimePattern =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

  if (!dateTimePattern.test(stringValue)) {
    throw new Error(TRIAL_DATE_FORMAT_MESSAGE);
  }

  const date = new Date(stringValue.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} должен быть корректной датой`);
  }

  return date;
};

const getFreeTrialExpiresAtIso = (user = {}) => {
  const expiresAt = toDate(getRawTrialExpiresAt(user));
  return expiresAt ? expiresAt.toISOString() : null;
};

const isFreeTrialActive = (user = {}, now = new Date()) => {
  const expiresAt = toDate(getRawTrialExpiresAt(user));
  return Boolean(expiresAt && expiresAt.getTime() >= now.getTime());
};

const getFreeTrialDaysLeft = (user = {}, now = new Date()) => {
  const expiresAt = toDate(getRawTrialExpiresAt(user));
  if (!expiresAt || expiresAt.getTime() < now.getTime()) return 0;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
};

const getFreeTrialFields = (user = {}, now = new Date()) => {
  const freeTrialExpiresAt = getFreeTrialExpiresAtIso(user);
  const isFreeTrial = isFreeTrialActive(user, now);

  return {
    freeTrialExpiresAt,
    free_trial_expires_at: freeTrialExpiresAt,
    isFreeTrial,
    is_free_trial: isFreeTrial,
    freeTrialDaysLeft: getFreeTrialDaysLeft(user, now),
  };
};

const getTrialStatsWindow = (now = new Date()) => {
  const maxEnd = endOfDay(now);
  const minStart = startOfDay(addDays(now, -(TRIAL_STATS_WINDOW_DAYS - 1)));

  return { minStart, maxEnd };
};

const getTrialWindowDetails = (user = {}, now = new Date()) => {
  const { minStart, maxEnd } = getTrialStatsWindow(now);

  return {
    days: TRIAL_STATS_WINDOW_DAYS,
    minStart,
    maxEnd,
    minStartFormatted: formatDateTime(minStart),
    maxEndFormatted: formatDateTime(maxEnd),
    freeTrialExpiresAt: getFreeTrialExpiresAtIso(user),
  };
};

const validateTrialDateRange = (
  user,
  { startDate, endDate, now = new Date(), reportName = 'статистика' } = {},
) => {
  if (!isFreeTrialActive(user, now)) return { ok: true };

  const parsedStartDate = toDate(startDate);
  const parsedEndDate = toDate(endDate);

  if (!parsedStartDate || !parsedEndDate) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_DATE_RANGE',
      message: 'Необходим корректный период startDate и endDate',
    };
  }

  if (parsedStartDate.getTime() > parsedEndDate.getTime()) {
    return {
      ok: false,
      statusCode: 400,
      code: 'INVALID_DATE_RANGE',
      message: 'startDate не может быть позже endDate',
    };
  }

  const details = getTrialWindowDetails(user, now);
  if (
    parsedStartDate.getTime() < details.minStart.getTime() ||
    parsedEndDate.getTime() > details.maxEnd.getTime()
  ) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FREE_TRIAL_WINDOW_EXCEEDED',
      message: `В бесплатном периоде ${reportName} доступна только за последние ${details.days} дней: ${details.minStartFormatted} - ${details.maxEndFormatted}`,
      details: {
        days: details.days,
        minStart: details.minStartFormatted,
        maxEnd: details.maxEndFormatted,
        freeTrialExpiresAt: details.freeTrialExpiresAt,
      },
    };
  }

  return { ok: true, details };
};

module.exports = {
  TRIAL_STATS_WINDOW_DAYS,
  formatDateTime,
  getFreeTrialFields,
  getFreeTrialDaysLeft,
  getFreeTrialExpiresAtIso,
  getRawTrialExpiresAt,
  getTrialStatsWindow,
  getTrialWindowDetails,
  isFreeTrialActive,
  parseFreeTrialExpiresAt,
  validateTrialDateRange,
};
