'use strict';

const { QueryTypes } = require('sequelize');

const DEFAULT_MOTIVATION = {
  basePay: {
    day: 1000,
    night: 1200,
  },
  taskCompletionBonus: 1200,
  penalties: {
    longMessageResponse: {
      perCase: 300,
      escalationCount: 3,
      escalationPenalty: 1200,
    },
    uncleanClub: {
      basePenalty: 600,
      thresholdPlaces: 5,
      escalationPenalty: 1200,
    },
    dirtyKitchen: 1200,
    missedCallNoCallback: 300,
    messyWorkspace: 400,
    strangersBehindDesk: 500,
    climateControl: 200,
    fridgeNotFilled: 300,
    loudSwearingPerCase: 100,
    secretGuestFailed: 1200,
  },
  bonusRates: {
    bar: 0.05,
    services: 0.1,
    planMultiplier: 2,
  },
};

const RESPONSIBILITY_ITEMS = [
  { key: 'clubCleanliness', label: 'Чистота клуба', enabled: true },
  { key: 'kitchenCleanliness', label: 'Чистота кухни', enabled: true },
  { key: 'quickVkAnswers', label: 'Ответы ВК', enabled: true },
  { key: 'quickPhoneAnswers', label: 'Ответы телефон', enabled: true },
  { key: 'workspaceCleanliness', label: 'Чистота рабочего места', enabled: true },
  {
    key: 'noStrangersNearTheWorkspace',
    label: 'Посторонние за стойкой',
    enabled: true,
  },
  { key: 'clubClimateControl', label: 'Климат-контроль', enabled: true },
  {
    key: 'refrigeratorOccupancy',
    label: 'Холодильник заполнен',
    enabled: true,
  },
  { key: 'foulLanguage', label: 'Нет мата', enabled: true },
  { key: 'reportsDuringDay', label: 'Отчеты в течение дня', enabled: true },
];

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

const numberWithDefault = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const positiveIntegerOrNull = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const normalizeResponsibilityItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return RESPONSIBILITY_ITEMS.map((item) => ({ ...item }));
  }

  const normalizedItems = items
    .filter((item) => item && item.key)
    .map((item) => ({
      key: String(item.key),
      label: item.label ? String(item.label) : String(item.key),
      enabled: item.enabled !== false,
    }));

  return normalizedItems.length
    ? normalizedItems
    : RESPONSIBILITY_ITEMS.map((item) => ({ ...item }));
};

const normalizeNestedPenalty = (source, defaults) => {
  const section = parseJsonObject(source);

  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      numberWithDefault(section[key], fallback),
    ]),
  );
};

const normalizeMotivation = (settings) => {
  const legacyBonusRates = parseJsonObject(settings.bonuses);
  const bonusRatesSource = parseJsonObject(settings.bonusRates);
  const motivationSource = parseJsonObject(settings.motivation);
  const motivationBasePaySource = parseJsonObject(motivationSource.basePay);
  const motivationPenaltiesSource = parseJsonObject(motivationSource.penalties);
  const motivationBonusRatesSource = parseJsonObject(
    motivationSource.bonusRates,
  );
  const legacyGoodsRate = numberWithDefault(
    bonusRatesSource.goodsThreshold ?? legacyBonusRates.goodsThreshold,
    DEFAULT_MOTIVATION.bonusRates.bar,
  );
  const legacyServicesRate = numberWithDefault(
    bonusRatesSource.psThreshold ?? legacyBonusRates.psThreshold,
    DEFAULT_MOTIVATION.bonusRates.services,
  );

  return {
    basePay: {
      day: numberWithDefault(
        motivationBasePaySource.day,
        DEFAULT_MOTIVATION.basePay.day,
      ),
      night: numberWithDefault(
        motivationBasePaySource.night,
        DEFAULT_MOTIVATION.basePay.night,
      ),
    },
    taskCompletionBonus: numberWithDefault(
      motivationSource.taskCompletionBonus,
      DEFAULT_MOTIVATION.taskCompletionBonus,
    ),
    penalties: {
      longMessageResponse: normalizeNestedPenalty(
        motivationPenaltiesSource.longMessageResponse,
        DEFAULT_MOTIVATION.penalties.longMessageResponse,
      ),
      uncleanClub: normalizeNestedPenalty(
        motivationPenaltiesSource.uncleanClub,
        DEFAULT_MOTIVATION.penalties.uncleanClub,
      ),
      dirtyKitchen: numberWithDefault(
        motivationPenaltiesSource.dirtyKitchen,
        DEFAULT_MOTIVATION.penalties.dirtyKitchen,
      ),
      missedCallNoCallback: numberWithDefault(
        motivationPenaltiesSource.missedCallNoCallback,
        DEFAULT_MOTIVATION.penalties.missedCallNoCallback,
      ),
      messyWorkspace: numberWithDefault(
        motivationPenaltiesSource.messyWorkspace,
        DEFAULT_MOTIVATION.penalties.messyWorkspace,
      ),
      strangersBehindDesk: numberWithDefault(
        motivationPenaltiesSource.strangersBehindDesk,
        DEFAULT_MOTIVATION.penalties.strangersBehindDesk,
      ),
      climateControl: numberWithDefault(
        motivationPenaltiesSource.climateControl,
        DEFAULT_MOTIVATION.penalties.climateControl,
      ),
      fridgeNotFilled: numberWithDefault(
        motivationPenaltiesSource.fridgeNotFilled,
        DEFAULT_MOTIVATION.penalties.fridgeNotFilled,
      ),
      loudSwearingPerCase: numberWithDefault(
        motivationPenaltiesSource.loudSwearingPerCase,
        DEFAULT_MOTIVATION.penalties.loudSwearingPerCase,
      ),
      secretGuestFailed: numberWithDefault(
        motivationPenaltiesSource.secretGuestFailed,
        DEFAULT_MOTIVATION.penalties.secretGuestFailed,
      ),
    },
    bonusRates: {
      bar: numberWithDefault(motivationBonusRatesSource.bar, legacyGoodsRate),
      services: numberWithDefault(
        motivationBonusRatesSource.services,
        legacyServicesRate,
      ),
      planMultiplier: numberWithDefault(
        motivationBonusRatesSource.planMultiplier,
        DEFAULT_MOTIVATION.bonusRates.planMultiplier,
      ),
    },
  };
};

const normalizeClubSettings = (rawSettings, smartshellId) => {
  const settings = parseJsonObject(rawSettings);
  const responsibilitiesSource = parseJsonObject(settings.responsibilities);
  const smartshellSource = parseJsonObject(settings.smartshell);
  const smartshellCompanyId = positiveIntegerOrNull(
    smartshellSource.companyId ?? settings.smartshellCompanyId ?? smartshellId,
  );
  const {
    salary_rates,
    bonuses,
    salaryRates,
    bonusRates,
    motivation,
    responsibilities,
    smartshell,
    smartshellCompanyId: previousSmartshellCompanyId,
    ...otherSettings
  } = settings;

  void salary_rates;
  void bonuses;
  void salaryRates;
  void bonusRates;
  void motivation;
  void responsibilities;
  void smartshell;
  void previousSmartshellCompanyId;

  return {
    ...otherSettings,
    motivation: normalizeMotivation(settings),
    responsibilities: {
      ...responsibilitiesSource,
      items: normalizeResponsibilityItems(responsibilitiesSource.items),
    },
    smartshell: {
      ...smartshellSource,
      companyId: smartshellCompanyId,
    },
  };
};

const backfillClubMotivationSettings = async (sequelize) => {
  const clubs = await sequelize.query(
    'SELECT id, smartshell_id, settings FROM Clubs',
    { type: QueryTypes.SELECT },
  );

  for (const club of clubs) {
    const normalizedSettings = normalizeClubSettings(
      club.settings,
      club.smartshell_id,
    );

    await sequelize.query(
      'UPDATE Clubs SET settings = :settings, updatedAt = CURRENT_TIMESTAMP WHERE id = :id',
      {
        replacements: {
          id: club.id,
          settings: JSON.stringify(normalizedSettings),
        },
      },
    );
  }
};

module.exports = {
  async up(queryInterface) {
    await backfillClubMotivationSettings(queryInterface.sequelize);
  },

  async down() {
    // Data migration is intentionally non-destructive.
  },
};
