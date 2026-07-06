'use strict';

const MOTIVATION_RULES_VERSION = '2026-07-04';

const SECRET_GUEST_FAILURE_REASONS = Object.freeze({
  noTour: 'Не провели экскурсию по клубу',
  promotionsNotExplained: 'Не рассказали об акциях',
  scriptNotFollowed: 'Не соблюден скрипт',
  noUpsellAttempt: 'Не предложили более дорогую зону',
  noFoodDrinkOrServiceOffer: 'Не предложили еду, напитки или услуги',
});

const SHIFT_CHECK_LABELS = Object.freeze({
  allTasksCompleted: 'Все задачи выполнены',
  longMessageResponseCount: 'Долгие или неотвеченные сообщения',
  uncleanClubPlacesCount: 'Неприбранные места в клубе',
  dirtyKitchen: 'Беспорядок или грязь на кухне',
  missedCallNoCallbackCount: 'Пропущенные звонки без перезвона',
  messyWorkspace: 'Беспорядок на рабочем месте',
  strangersBehindDesk: 'Посторонние за стойкой',
  climateControlIssue: 'Проблема с климат-контролем',
  fridgeNotFilled: 'Холодильники не заполнены',
  loudSwearingCount: 'Громкий мат',
  secretGuestFailed: 'Провал тайного гостя',
});

const DEFAULT_SHIFT_CHECK = Object.freeze({
  allTasksCompleted: false,
  longMessageResponseCount: 0,
  uncleanClubPlacesCount: 0,
  dirtyKitchen: false,
  missedCallNoCallbackCount: 0,
  messyWorkspace: false,
  strangersBehindDesk: false,
  climateControlIssue: false,
  fridgeNotFilled: false,
  loudSwearingCount: 0,
  secretGuestFailed: false,
  secretGuestFailureReasons: Object.freeze(
    Object.fromEntries(
      Object.keys(SECRET_GUEST_FAILURE_REASONS).map((key) => [key, false]),
    ),
  ),
});

const NEW_SHIFT_CHECK_KEYS = Object.freeze(Object.keys(DEFAULT_SHIFT_CHECK));

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const isPlainObject = (value) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    return {};
  }
};

const toMoney = (value) => Math.floor(Number(value) || 0);

const readBoolean = (source, key, errors) => {
  if (!hasOwn(source, key)) return DEFAULT_SHIFT_CHECK[key];
  if (typeof source[key] !== 'boolean') {
    errors.push(`${key} должен быть boolean`);
    return DEFAULT_SHIFT_CHECK[key];
  }

  return source[key];
};

const readNonNegativeInteger = (source, key, errors) => {
  if (!hasOwn(source, key)) return DEFAULT_SHIFT_CHECK[key];

  const value = source[key];
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    errors.push(`${key} должен быть неотрицательным целым числом`);
    return DEFAULT_SHIFT_CHECK[key];
  }

  return number;
};

const normalizeSecretGuestReasons = (
  sourceReasons = {},
  errors = [],
  { requireFullContract = false } = {},
) => {
  if (!isPlainObject(sourceReasons)) {
    errors.push('secretGuestFailureReasons должен быть объектом');
  }

  const reasons = parseJsonObject(sourceReasons);
  const allowedReasonKeys = new Set(Object.keys(SECRET_GUEST_FAILURE_REASONS));
  const unknownReasonKeys = Object.keys(reasons).filter(
    (key) => !allowedReasonKeys.has(key),
  );

  unknownReasonKeys.forEach((key) => {
    errors.push(`secretGuestFailureReasons.${key} не поддерживается`);
  });

  return Object.fromEntries(
    Object.keys(SECRET_GUEST_FAILURE_REASONS).map((key) => {
      if (!hasOwn(reasons, key)) {
        if (requireFullContract) {
          errors.push(`secretGuestFailureReasons.${key} обязателен`);
        }

        return [key, false];
      }

      if (typeof reasons[key] !== 'boolean') {
        errors.push(`secretGuestFailureReasons.${key} должен быть boolean`);
        return [key, false];
      }

      return [key, reasons[key]];
    }),
  );
};

const normalizeLegacyChecklist = (payload, responsibilityItems) => {
  const items = Array.isArray(responsibilityItems) ? responsibilityItems : [];
  const knownItems = items.filter((item) => item?.key);
  const legacyNotPassed = knownItems
    .filter((item) => payload[item.key] === false)
    .map((item) => ({
      key: item.key,
      label: item.label || item.key,
    }));

  return {
    normalizedCheck: {
      ...DEFAULT_SHIFT_CHECK,
      secretGuestFailureReasons: {
        ...DEFAULT_SHIFT_CHECK.secretGuestFailureReasons,
      },
      allTasksCompleted: knownItems.length
        ? knownItems.every((item) => payload[item.key] === true)
        : false,
    },
    errors: [],
    isLegacy: true,
    legacyNotPassed,
  };
};

const normalizeShiftCheckPayload = (payload = {}, { responsibilityItems } = {}) => {
  const source = parseJsonObject(payload);
  const hasNewPayloadShape = NEW_SHIFT_CHECK_KEYS.some((key) =>
    hasOwn(source, key),
  );

  if (!hasNewPayloadShape) {
    return normalizeLegacyChecklist(source, responsibilityItems);
  }

  const errors = [];
  const allowedTopLevelKeys = new Set(NEW_SHIFT_CHECK_KEYS);
  const unknownTopLevelKeys = Object.keys(source).filter(
    (key) => !allowedTopLevelKeys.has(key),
  );

  unknownTopLevelKeys.forEach((key) => {
    errors.push(`${key} не поддерживается`);
  });

  NEW_SHIFT_CHECK_KEYS.forEach((key) => {
    if (!hasOwn(source, key)) {
      errors.push(`${key} обязателен`);
    }
  });

  const secretGuestFailureReasons = normalizeSecretGuestReasons(
    source.secretGuestFailureReasons,
    errors,
    { requireFullContract: true },
  );
  const hasSecretGuestReasonFailure = Object.values(
    secretGuestFailureReasons,
  ).some(Boolean);

  return {
    normalizedCheck: {
      allTasksCompleted: readBoolean(source, 'allTasksCompleted', errors),
      longMessageResponseCount: readNonNegativeInteger(
        source,
        'longMessageResponseCount',
        errors,
      ),
      uncleanClubPlacesCount: readNonNegativeInteger(
        source,
        'uncleanClubPlacesCount',
        errors,
      ),
      dirtyKitchen: readBoolean(source, 'dirtyKitchen', errors),
      missedCallNoCallbackCount: readNonNegativeInteger(
        source,
        'missedCallNoCallbackCount',
        errors,
      ),
      messyWorkspace: readBoolean(source, 'messyWorkspace', errors),
      strangersBehindDesk: readBoolean(source, 'strangersBehindDesk', errors),
      climateControlIssue: readBoolean(source, 'climateControlIssue', errors),
      fridgeNotFilled: readBoolean(source, 'fridgeNotFilled', errors),
      loudSwearingCount: readNonNegativeInteger(
        source,
        'loudSwearingCount',
        errors,
      ),
      secretGuestFailed:
        readBoolean(source, 'secretGuestFailed', errors) ||
        hasSecretGuestReasonFailure,
      secretGuestFailureReasons,
    },
    errors,
    isLegacy: false,
    legacyNotPassed: [],
  };
};

const addPenalty = (items, key, amount, meta = {}) => {
  const moneyAmount = toMoney(amount);
  if (moneyAmount <= 0) return;

  items.push({
    key,
    label: SHIFT_CHECK_LABELS[key] || key,
    amount: moneyAmount,
    ...meta,
  });
};

const calculatePenalties = (shiftCheck, motivation) => {
  const check = shiftCheck || DEFAULT_SHIFT_CHECK;
  const penalties = motivation?.penalties || {};
  const items = [];

  const longMessageRules = penalties.longMessageResponse || {};
  const longMessageCount = check.longMessageResponseCount || 0;
  if (longMessageCount > 0) {
    const escalationCount = Number(longMessageRules.escalationCount) || 3;
    const amount =
      longMessageCount >= escalationCount
        ? longMessageRules.escalationPenalty
        : longMessageCount * longMessageRules.perCase;
    addPenalty(items, 'longMessageResponseCount', amount, {
      count: longMessageCount,
    });
  }

  const uncleanRules = penalties.uncleanClub || {};
  const uncleanPlacesCount = check.uncleanClubPlacesCount || 0;
  if (uncleanPlacesCount > 0) {
    const thresholdPlaces = Number(uncleanRules.thresholdPlaces) || 5;
    const amount =
      uncleanPlacesCount > thresholdPlaces
        ? uncleanRules.escalationPenalty
        : uncleanRules.basePenalty;
    addPenalty(items, 'uncleanClubPlacesCount', amount, {
      count: uncleanPlacesCount,
    });
  }

  if (check.dirtyKitchen) {
    addPenalty(items, 'dirtyKitchen', penalties.dirtyKitchen);
  }

  if ((check.missedCallNoCallbackCount || 0) > 0) {
    addPenalty(
      items,
      'missedCallNoCallbackCount',
      check.missedCallNoCallbackCount * penalties.missedCallNoCallback,
      { count: check.missedCallNoCallbackCount },
    );
  }

  if (check.messyWorkspace) {
    addPenalty(items, 'messyWorkspace', penalties.messyWorkspace);
  }

  if (check.strangersBehindDesk) {
    addPenalty(items, 'strangersBehindDesk', penalties.strangersBehindDesk);
  }

  if (check.climateControlIssue) {
    addPenalty(items, 'climateControlIssue', penalties.climateControl);
  }

  if (check.fridgeNotFilled) {
    addPenalty(items, 'fridgeNotFilled', penalties.fridgeNotFilled);
  }

  if ((check.loudSwearingCount || 0) > 0) {
    addPenalty(
      items,
      'loudSwearingCount',
      check.loudSwearingCount * penalties.loudSwearingPerCase,
      { count: check.loudSwearingCount },
    );
  }

  const failedSecretGuestReasons = Object.entries(
    check.secretGuestFailureReasons || {},
  )
    .filter(([, failed]) => failed === true)
    .map(([key]) => ({
      key,
      label: SECRET_GUEST_FAILURE_REASONS[key] || key,
    }));

  if (check.secretGuestFailed || failedSecretGuestReasons.length > 0) {
    addPenalty(items, 'secretGuestFailed', penalties.secretGuestFailed, {
      reasons: failedSecretGuestReasons,
    });
  }

  return {
    total: items.reduce((sum, item) => sum + item.amount, 0),
    items,
  };
};

const getShiftCheckNotPassed = ({
  normalizedCheck,
  penaltiesBreakdown,
  legacyNotPassed = [],
}) => {
  const items = [];

  if (normalizedCheck && normalizedCheck.allTasksCompleted !== true) {
    items.push({
      key: 'allTasksCompleted',
      label: SHIFT_CHECK_LABELS.allTasksCompleted,
    });
  }

  (penaltiesBreakdown || []).forEach((penalty) => {
    items.push({
      key: penalty.key,
      label: penalty.label,
    });
  });

  legacyNotPassed.forEach((item) => items.push(item));

  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

const getRevenue = (stats, preferredKey, fallbackKey = null) => {
  const preferred = Number(stats?.[preferredKey]);
  if (Number.isFinite(preferred)) return preferred;

  const fallback = Number(stats?.[fallbackKey]);
  return Number.isFinite(fallback) ? fallback : 0;
};

const calculateMotivationPayout = ({
  shiftType,
  currentStatsObject,
  planStatsObject,
  motivation,
  shiftCheck,
  workedMinutes = 0,
}) => {
  const currentStats = currentStatsObject || {};
  const planStats = planStatsObject || {};
  const motivationSettings = motivation || {};
  const basePay = motivationSettings.basePay || {};
  const bonusRates = motivationSettings.bonusRates || {};
  const isNight = shiftType === 'night';
  const baseSalary = toMoney(isNight ? basePay.night : basePay.day);
  const isPlanConfigured = planStats.isConfigured === true || Boolean(planStats.id);
  const planTotalRevenue = Number(planStats.totalRevenue) || 0;
  const currentTotalRevenue = getRevenue(currentStats, 'totalRevenue');
  const planMultiplier = Number(bonusRates.planMultiplier) || 1;
  const planMultiplierApplied =
    isPlanConfigured &&
    planTotalRevenue > 0 &&
    currentTotalRevenue >= planTotalRevenue;
  const rateMultiplier = planMultiplierApplied ? planMultiplier : 1;
  const barRevenue = getRevenue(currentStats, 'barRevenue', 'goodsRevenue');
  const servicesRevenue = getRevenue(currentStats, 'servicesRevenue');
  const barBonusRate = (Number(bonusRates.bar) || 0) * rateMultiplier;
  const servicesBonusRate = (Number(bonusRates.services) || 0) * rateMultiplier;
  const barBonus = toMoney(barRevenue * barBonusRate);
  const servicesBonus = toMoney(servicesRevenue * servicesBonusRate);

  const normalizedCheck = shiftCheck?.checklist || shiftCheck || null;
  const isChecked = shiftCheck?.alreadyChecked === true || Boolean(shiftCheck);
  const penaltyResult =
    isChecked && normalizedCheck
      ? calculatePenalties(normalizedCheck, motivationSettings)
      : { total: 0, items: [] };
  const taskCompletionBonus =
    isChecked &&
    normalizedCheck?.allTasksCompleted === true &&
    penaltyResult.total === 0
      ? toMoney(motivationSettings.taskCompletionBonus)
      : 0;

  const totalAward =
    baseSalary +
    taskCompletionBonus +
    barBonus +
    servicesBonus -
    penaltyResult.total;

  return {
    baseSalary,
    taskCompletionBonus,
    additionalBonus: taskCompletionBonus,
    penaltiesTotal: penaltyResult.total,
    penaltiesBreakdown: penaltyResult.items,
    barBonus,
    servicesBonus,
    goodsBonus: barBonus,
    psBonus: servicesBonus,
    pcBonus: 0,
    planMultiplierApplied,
    totalAward,
    payoutBreakdown: {
      motivationRulesVersion: MOTIVATION_RULES_VERSION,
      workedMinutes,
      shiftType,
      baseSalary: {
        amount: baseSalary,
        shiftType,
      },
      taskCompletionBonus: {
        configured: toMoney(motivationSettings.taskCompletionBonus),
        amount: taskCompletionBonus,
        allTasksCompleted: normalizedCheck?.allTasksCompleted === true,
        status: isChecked ? shiftCheck?.status || 'checked' : 'notChecked',
      },
      penalties: {
        total: penaltyResult.total,
        items: penaltyResult.items,
      },
      plan: {
        isConfigured: isPlanConfigured,
        totalRevenue: planTotalRevenue,
        currentTotalRevenue,
        isCompleted: planMultiplierApplied,
        multiplier: planMultiplier,
        multiplierApplied: planMultiplierApplied,
      },
      bonuses: {
        bar: {
          revenue: barRevenue,
          baseRate: Number(bonusRates.bar) || 0,
          rate: barBonusRate,
          amount: barBonus,
        },
        services: {
          revenue: servicesRevenue,
          baseRate: Number(bonusRates.services) || 0,
          rate: servicesBonusRate,
          amount: servicesBonus,
        },
      },
    },
  };
};

module.exports = {
  MOTIVATION_RULES_VERSION,
  SECRET_GUEST_FAILURE_REASONS,
  SHIFT_CHECK_LABELS,
  DEFAULT_SHIFT_CHECK,
  normalizeShiftCheckPayload,
  calculatePenalties,
  calculateMotivationPayout,
  getShiftCheckNotPassed,
};
