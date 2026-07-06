// services/admin.service.js
const { executeSmartshellQuery } = require('../integrations/smartshell.api');
const { getManagerToken } = require('./token.service');
const { getResultsArray } = require('./payments.service');
const { MonthlyPlan, ShiftResponsibility, Club, sequelize } = require('../models');
const { normalizeClubSettings } = require('../utils/clubSettings');
const {
  MOTIVATION_RULES_VERSION,
  SHIFT_CHECK_LABELS,
  normalizeShiftCheckPayload,
  calculateMotivationPayout,
  calculatePenalties,
  getShiftCheckNotPassed,
} = require('../utils/motivation');
const { Op } = require('sequelize');

const formatDate = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const numberWithDefault = (value, fallback = 0) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(0, Math.round(numberValue));
};

const sumPlanBarRevenue = (plan = {}) =>
  numberWithDefault(plan.foodRevenue) +
  numberWithDefault(plan.drinksRevenue) +
  numberWithDefault(plan.chocolateRevenue);

const normalizeMonthlyPlanPayload = (planData = {}) => {
  const foodRevenue = numberWithDefault(planData.foodRevenue);
  const chocolateRevenue = numberWithDefault(planData.chocolateRevenue);
  const drinksRevenue = numberWithDefault(planData.drinksRevenue);
  const barRevenue =
    planData.barRevenue === undefined ||
    planData.barRevenue === null ||
    planData.barRevenue === ''
      ? foodRevenue + drinksRevenue + chocolateRevenue
      : numberWithDefault(planData.barRevenue);
  const psRevenue = numberWithDefault(planData.psRevenue);
  const servicesRevenue = numberWithDefault(planData.servicesRevenue);
  const psServiceRevenue =
    planData.psServiceRevenue === undefined ||
    planData.psServiceRevenue === null ||
    planData.psServiceRevenue === ''
      ? psRevenue + servicesRevenue
      : numberWithDefault(planData.psServiceRevenue);

  return {
    totalRevenue: numberWithDefault(planData.totalRevenue),
    foodRevenue,
    chocolateRevenue,
    drinksRevenue,
    barRevenue,
    psServiceRevenue,
    psRevenue,
    servicesRevenue,
    pcRevenue: numberWithDefault(planData.pcRevenue),
  };
};

const normalizeMonthlyPlanRecord = (plan) => {
  const raw = plan?.toJSON ? plan.toJSON() : plan || {};
  const legacyBarRevenue = sumPlanBarRevenue(raw);
  const explicitBarRevenue = numberWithDefault(raw.barRevenue);
  const servicesRevenue = numberWithDefault(raw.servicesRevenue);
  const explicitPsRevenue = numberWithDefault(raw.psRevenue);
  const legacyPsServiceRevenue = numberWithDefault(raw.psServiceRevenue);
  const psRevenue =
    explicitPsRevenue > 0 || servicesRevenue > 0
      ? explicitPsRevenue
      : legacyPsServiceRevenue;
  const barRevenue =
    explicitBarRevenue > 0 || legacyBarRevenue === 0
      ? explicitBarRevenue
      : legacyBarRevenue;

  return {
    ...raw,
    totalRevenue: numberWithDefault(raw.totalRevenue),
    foodRevenue: numberWithDefault(raw.foodRevenue),
    chocolateRevenue: numberWithDefault(raw.chocolateRevenue),
    drinksRevenue: numberWithDefault(raw.drinksRevenue),
    barRevenue,
    goodsRevenue: barRevenue,
    psServiceRevenue: legacyPsServiceRevenue || psRevenue + servicesRevenue,
    psRevenue,
    servicesRevenue,
    pcRevenue: numberWithDefault(raw.pcRevenue),
    categorySchemaVersion: 2,
    hasLegacyPsServiceRevenue:
      legacyPsServiceRevenue > 0 &&
      explicitPsRevenue === 0 &&
      servicesRevenue === 0,
  };
};

const getActiveWorkshiftStartDate = async (club) => {
  const managerBearer = await getManagerToken(club);
  if (managerBearer.error) return managerBearer;

  const queryData = {
    query: `query ActiveWorkShift {
      activeWorkShift { created_at worker { last_name first_name } }
    }`,
  };

  const response = await executeSmartshellQuery(queryData, managerBearer);
  if (response.error) return response;

  return response.data.activeWorkShift;
};

function getEnabledResponsibilityItems(clubSettings) {
  return (clubSettings?.responsibilities?.items || [])
    .filter((item) => item?.key && item.enabled !== false)
    .map((item) => ({
      key: String(item.key),
      label: item.label ? String(item.label) : String(item.key),
    }));
}

function normalizeResponsibilitiesPayload(adminResponsibilities, clubSettings) {
  const enabledItems = getEnabledResponsibilityItems(clubSettings);
  const normalized = normalizeShiftCheckPayload(adminResponsibilities, {
    responsibilityItems: enabledItems,
  });

  if (normalized.errors.length) {
    return {
      error: true,
      message: `Проверьте поля проверки смены: ${normalized.errors.join(', ')}`,
    };
  }

  const penaltyResult = calculatePenalties(
    normalized.normalizedCheck,
    clubSettings.motivation,
  );
  const notPassedItems = getShiftCheckNotPassed({
    normalizedCheck: normalized.normalizedCheck,
    penaltiesBreakdown: penaltyResult.items,
    legacyNotPassed: normalized.legacyNotPassed,
  });

  return {
    error: false,
    normalizedChecklist: normalized.normalizedCheck,
    penaltiesTotal: penaltyResult.total,
    penaltiesBreakdown: penaltyResult.items,
    notPassedItems,
    isPassed: notPassedItems.length === 0,
    isLegacy: normalized.isLegacy,
  };
}

const getResponsibilitiesCheck = async (
  workshiftStart,
  dbClubId,
  clubSettings,
) => {
  if (!workshiftStart)
    return { status: 'notChecked', notPassed: [], alreadyChecked: false };

  const shiftRecord = await ShiftResponsibility.findOne({
    where: { club_id: dbClubId, shift_created_at: workshiftStart.created_at },
  });

  if (!shiftRecord) {
    return { status: 'notChecked', notPassed: [], alreadyChecked: false };
  }

  // ФИКС: Парсим JSON, если Sequelize вернул его как строку
  let checklist = shiftRecord.checklist || {};
  if (typeof checklist === 'string') {
    try {
      checklist = JSON.parse(checklist);
    } catch (error) {
      checklist = {};
    }
  }

  const dbClub = clubSettings ? null : await Club.findByPk(dbClubId);
  const effectiveClubSettings =
    clubSettings || normalizeClubSettings(dbClub?.settings, dbClub);
  const validation = normalizeResponsibilitiesPayload(
    checklist,
    effectiveClubSettings,
  );

  if (validation.error) {
    return {
      alreadyChecked: false,
      status: 'notChecked',
      notPassed: [],
      invalid: true,
      message: validation.message,
    };
  }

  return {
    alreadyChecked: true,
    status: validation.isPassed ? 'ok' : 'fail',
    notPassed: validation.notPassedItems.map((item) => item.key),
    notPassedItems: validation.notPassedItems,
    checklist: validation.normalizedChecklist,
    penaltiesTotal: validation.penaltiesTotal,
    penaltiesBreakdown: validation.penaltiesBreakdown,
    motivationRulesVersion: MOTIVATION_RULES_VERSION,
    isLegacy: validation.isLegacy,
  };
};

const getCurrentAwardsObject = async (
  smena,
  currentStatsObject,
  planStatsObject,
  checkedResponsibilities,
  clubSettings,
  workshiftStart,
) => {
  if (!workshiftStart) return { error: true, message: 'Смена не найдена' };

  const startTime = new Date(
    workshiftStart.created_at.replace(' ', 'T') + '+03:00',
  );
  const endTime = new Date();
  const workedMinutes = Math.floor((endTime - startTime) / 1000 / 60);

  const checkItems = Object.entries(SHIFT_CHECK_LABELS).map(([key, label]) => ({
    key,
    label,
    enabled: true,
  }));
  const payout = calculateMotivationPayout({
    shiftType: smena,
    currentStatsObject,
    planStatsObject,
    motivation: clubSettings.motivation,
    shiftCheck: checkedResponsibilities,
    workedMinutes,
  });

  return {
    ...payout,
    responsibilitiesCheck: checkedResponsibilities,
    payoutBreakdown: {
      ...payout.payoutBreakdown,
      motivationSettings: clubSettings.motivation,
      checkItems,
      responsibilityItems: checkItems,
    },
  };
};

const calculateCurrentStats = async ({
  startDate,
  endDate,
  dbClubId,
  club,
}) => {
  const smena = endDate.split(' ')[1].split(':')[0] === '09' ? 'night' : 'day';
  const queryDate = endDate.split(' ')[0];

  const planStatsRecord = await MonthlyPlan.findOne({
    where: { club_id: dbClubId, date: queryDate, shift_type: smena },
  });

  const planStatsObject = planStatsRecord
    ? { ...normalizeMonthlyPlanRecord(planStatsRecord), isConfigured: true }
    : {
        totalRevenue: 0,
        foodRevenue: 0,
        chocolateRevenue: 0,
        drinksRevenue: 0,
        barRevenue: 0,
        goodsRevenue: 0,
        psServiceRevenue: 0,
        psRevenue: 0,
        servicesRevenue: 0,
        pcRevenue: 0,
        isConfigured: false,
      };
  const planBarRevenue =
    (planStatsObject.foodRevenue || 0) +
    (planStatsObject.chocolateRevenue || 0) +
    (planStatsObject.drinksRevenue || 0);
  planStatsObject.barRevenue = planStatsObject.barRevenue || planBarRevenue;
  planStatsObject.goodsRevenue = planStatsObject.goodsRevenue || planBarRevenue;

  const createdAt = new Date(startDate.replace(' ', 'T') + '+03:00');
  const start = new Date(createdAt);
  if (createdAt.getHours() >= 6 && createdAt.getHours() < 9)
    start.setHours(9, 0, 0, 0);
  else if (createdAt.getHours() >= 18 && createdAt.getHours() < 21)
    start.setHours(21, 0, 0, 0);

  const startSmena = formatDate(start);
  const resultsArray = await getResultsArray(
    startSmena,
    endDate,
    club || dbClubId,
  );

  if (resultsArray.error) {
    return {
      ...resultsArray,
      code: resultsArray.code || 'SMARTSHELL_STATS_ERROR',
      statusCode: resultsArray.statusCode || 502,
    };
  }

  const currentStatsObject = {
    totalRevenue: 0,
    barRevenue: 0,
    goodsRevenue: 0,
    servicesRevenue: 0,
    psRevenue: 0,
    psServiceRevenue: 0,
    pcRevenue: 0,
  };

  for (let i = 0; i < resultsArray.length; i++) {
    const { type, title, sum, payment_title } = resultsArray[i];
    if (
      payment_title === 'СБП' ||
      (type === 'TARIFF' &&
        ['CARD', 'CASH', 'COMPOSITE'].includes(payment_title)) ||
      ['GOOD', 'SERVICE', 'PS'].includes(type)
    ) {
      currentStatsObject.totalRevenue += sum;
    }
    if (type === 'GOOD') {
      currentStatsObject.barRevenue += sum;
      currentStatsObject.goodsRevenue += sum;
    }
    if (type === 'SERVICE') currentStatsObject.servicesRevenue += sum;
    if (type === 'PS') currentStatsObject.psRevenue += sum;
    if (type === 'PS' || type === 'SERVICE') {
      currentStatsObject.psServiceRevenue += sum;
    }
    if (
      (type === 'TARIFF' &&
        title === 'Пополнение по СБП' &&
        payment_title === 'СБП') ||
      (type === 'TARIFF' && ['CARD', 'CASH'].includes(payment_title))
    ) {
      currentStatsObject.pcRevenue += sum;
    }
  }

  const dbClub = club || (await Club.findByPk(dbClubId));
  const clubSettings = normalizeClubSettings(dbClub?.settings, dbClub);
  const workshiftStart = await getActiveWorkshiftStartDate(club || dbClubId);

  if (workshiftStart?.error) {
    return {
      ...workshiftStart,
      code: workshiftStart.code || 'SMARTSHELL_WORKSHIFT_ERROR',
      statusCode: workshiftStart.statusCode || 502,
    };
  }

  if (!workshiftStart) {
    return {
      error: true,
      code: 'NO_ACTIVE_WORKSHIFT',
      message: 'Смена не найдена',
      statusCode: 400,
    };
  }

  const responsibilitiesCheck = await getResponsibilitiesCheck(
    workshiftStart,
    dbClubId,
    clubSettings,
  );

  const currentAwardsObject = await getCurrentAwardsObject(
    smena,
    currentStatsObject,
    planStatsObject,
    responsibilitiesCheck,
    clubSettings,
    workshiftStart,
  );

  return { currentStatsObject, planStatsObject, currentAwardsObject };
};

const saveAdminResponsibilities = async ({
  adminResponsibilities,
  dbClubId,
  club,
  clubSettings,
}) => {
  const dbClub = clubSettings ? null : await Club.findByPk(dbClubId);
  const effectiveClubSettings =
    clubSettings || normalizeClubSettings(dbClub?.settings, dbClub);
  const validation = normalizeResponsibilitiesPayload(
    adminResponsibilities,
    effectiveClubSettings,
  );

  if (validation.error) return validation;

  const currentWorkshift = await getActiveWorkshiftStartDate(club || dbClubId);
  if (currentWorkshift?.error) {
    return {
      ...currentWorkshift,
      code: currentWorkshift.code || 'SMARTSHELL_WORKSHIFT_ERROR',
      statusCode: currentWorkshift.statusCode || 502,
    };
  }

  if (!currentWorkshift)
    return { error: true, message: 'Не удалось получить активную смену' };

  const { normalizedChecklist } = validation;

  await ShiftResponsibility.upsert({
    club_id: dbClubId,
    shift_created_at: currentWorkshift.created_at,
    checklist: normalizedChecklist,
    is_passed: validation.isPassed,
  });

  return {
    error: false,
    message: 'Проверка смены успешно сохранена',
    responsibilitiesCheck: {
      alreadyChecked: true,
      status: validation.isPassed ? 'ok' : 'fail',
      notPassed: validation.notPassedItems.map((item) => item.key),
      notPassedItems: validation.notPassedItems,
      checklist: normalizedChecklist,
      penaltiesTotal: validation.penaltiesTotal,
      penaltiesBreakdown: validation.penaltiesBreakdown,
      motivationRulesVersion: MOTIVATION_RULES_VERSION,
      isLegacy: validation.isLegacy,
    },
  };
};

const getMonthlyPlans = async (yearMonth, dbClubId) => {
  // yearMonth ожидается в формате 'YYYY-MM', например '2026-02'
  const plans = await MonthlyPlan.findAll({
    where: {
      club_id: dbClubId,
      date: {
        [Op.like]: `${yearMonth}-%`, // Ищем все даты, начинающиеся с этого месяца
      },
    },
    order: [['date', 'ASC']],
  });

  return plans.map(normalizeMonthlyPlanRecord);
};

const saveDailyPlan = async (planData, dbClubId, options = {}) => {
  const { date, shift_type } = planData;
  const { transaction } = options;

  // 1. Ищем существующий план на эту дату и смену
  let plan = await MonthlyPlan.findOne({
    where: {
      club_id: dbClubId,
      date,
      shift_type,
    },
    transaction,
  });

  const payload = normalizeMonthlyPlanPayload(planData);

  // 2. Если нашли — обновляем, если нет — создаем новый
  if (plan) {
    plan = await plan.update(payload, { transaction });
  } else {
    plan = await MonthlyPlan.create(
      {
        club_id: dbClubId,
        date,
        shift_type,
        ...payload,
      },
      { transaction },
    );
  }

  return normalizeMonthlyPlanRecord(plan);
};

const saveDailyPlans = async (plansData, dbClubId) => {
  return sequelize.transaction(async (transaction) => {
    const savedPlans = [];

    for (const planData of plansData) {
      savedPlans.push(await saveDailyPlan(planData, dbClubId, { transaction }));
    }

    return savedPlans;
  });
};

module.exports = {
  calculateCurrentStats,
  getActiveWorkshiftStartDate,
  saveAdminResponsibilities,
  getResponsibilitiesCheck,
  getMonthlyPlans,
  saveDailyPlan,
  saveDailyPlans,
  normalizeMonthlyPlanPayload,
  normalizeMonthlyPlanRecord,
};
