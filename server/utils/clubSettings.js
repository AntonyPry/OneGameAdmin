'use strict';

const DEFAULT_RESPONSIBILITY_ITEMS = [
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

const DEFAULT_MOTIVATION_SETTINGS = Object.freeze({
  basePay: Object.freeze({
    day: 1000,
    night: 1200,
  }),
  taskCompletionBonus: 1200,
  penalties: Object.freeze({
    longMessageResponse: Object.freeze({
      perCase: 300,
      escalationCount: 3,
      escalationPenalty: 1200,
    }),
    uncleanClub: Object.freeze({
      basePenalty: 600,
      thresholdPlaces: 5,
      escalationPenalty: 1200,
    }),
    dirtyKitchen: 1200,
    missedCallNoCallback: 300,
    messyWorkspace: 400,
    strangersBehindDesk: 500,
    climateControl: 200,
    fridgeNotFilled: 300,
    loudSwearingPerCase: 100,
    secretGuestFailed: 1200,
  }),
  bonusRates: Object.freeze({
    bar: 0.05,
    services: 0.1,
    planMultiplier: 2,
  }),
});

const LEGACY_DEFAULT_SALARY_RATES = Object.freeze({
  dayPerMinute: 1.6,
  nightPerMinute: 1.9,
  responsibilityBonus: 500,
});

const LEGACY_DEFAULT_BONUS_RATES = Object.freeze({
  goodsThreshold: 0.05,
  psThreshold: 0.1,
  pcThreshold: 0.03,
});

const DEFAULT_CLUB_SETTINGS = Object.freeze({
  motivation: DEFAULT_MOTIVATION_SETTINGS,
  responsibilities: Object.freeze({
    items: Object.freeze(DEFAULT_RESPONSIBILITY_ITEMS),
  }),
  smartshell: Object.freeze({
    companyId: null,
    managerLogin: null,
    managerPasswordEncrypted: null,
    credentialsUpdatedAt: null,
    hasManagerCredentials: false,
  }),
});

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

const optionalInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const optionalString = (value) => {
  if (value === undefined || value === null) return null;

  const stringValue = String(value).trim();
  return stringValue || null;
};

const getClubValue = (club, key) => {
  if (!club) return undefined;
  if (club[key] !== undefined) return club[key];
  return typeof club.get === 'function' ? club.get(key) : undefined;
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

const normalizeResponsibilityItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return DEFAULT_RESPONSIBILITY_ITEMS.map((item) => ({ ...item }));
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
    : DEFAULT_RESPONSIBILITY_ITEMS.map((item) => ({ ...item }));
};

const normalizeClubSettings = (rawSettings, club = {}) => {
  const settings = parseJsonObject(rawSettings);

  const legacySalaryRates = parseJsonObject(settings.salary_rates);
  const salaryRatesSource = parseJsonObject(settings.salaryRates);
  const legacyBonusRates = parseJsonObject(settings.bonuses);
  const bonusRatesSource = parseJsonObject(settings.bonusRates);
  const motivationSource = parseJsonObject(settings.motivation);
  const motivationBasePaySource = parseJsonObject(motivationSource.basePay);
  const motivationPenaltiesSource = parseJsonObject(motivationSource.penalties);
  const motivationBonusRatesSource = parseJsonObject(
    motivationSource.bonusRates,
  );
  const responsibilitiesSource = parseJsonObject(settings.responsibilities);
  const smartshellSource = parseJsonObject(settings.smartshell);

  const salaryRates = {
    dayPerMinute: numberWithDefault(
      salaryRatesSource.dayPerMinute ?? legacySalaryRates.dayPerMinute,
      LEGACY_DEFAULT_SALARY_RATES.dayPerMinute,
    ),
    nightPerMinute: numberWithDefault(
      salaryRatesSource.nightPerMinute ?? legacySalaryRates.nightPerMinute,
      LEGACY_DEFAULT_SALARY_RATES.nightPerMinute,
    ),
    responsibilityBonus: numberWithDefault(
      salaryRatesSource.responsibilityBonus ??
        salaryRatesSource.additionalBonus ??
        legacySalaryRates.responsibilityBonus ??
        legacySalaryRates.additionalBonus,
      LEGACY_DEFAULT_SALARY_RATES.responsibilityBonus,
    ),
  };

  const bonusRates = {
    goodsThreshold: numberWithDefault(
      bonusRatesSource.goodsThreshold ?? legacyBonusRates.goodsThreshold,
      LEGACY_DEFAULT_BONUS_RATES.goodsThreshold,
    ),
    psThreshold: numberWithDefault(
      bonusRatesSource.psThreshold ?? legacyBonusRates.psThreshold,
      LEGACY_DEFAULT_BONUS_RATES.psThreshold,
    ),
    pcThreshold: numberWithDefault(
      bonusRatesSource.pcThreshold ?? legacyBonusRates.pcThreshold,
      LEGACY_DEFAULT_BONUS_RATES.pcThreshold,
    ),
  };

  const motivation = {
    basePay: {
      day: numberWithDefault(
        motivationBasePaySource.day,
        DEFAULT_MOTIVATION_SETTINGS.basePay.day,
      ),
      night: numberWithDefault(
        motivationBasePaySource.night,
        DEFAULT_MOTIVATION_SETTINGS.basePay.night,
      ),
    },
    taskCompletionBonus: numberWithDefault(
      motivationSource.taskCompletionBonus,
      DEFAULT_MOTIVATION_SETTINGS.taskCompletionBonus,
    ),
    penalties: {
      longMessageResponse: normalizeNestedPenalty(
        motivationPenaltiesSource.longMessageResponse,
        DEFAULT_MOTIVATION_SETTINGS.penalties.longMessageResponse,
      ),
      uncleanClub: normalizeNestedPenalty(
        motivationPenaltiesSource.uncleanClub,
        DEFAULT_MOTIVATION_SETTINGS.penalties.uncleanClub,
      ),
      dirtyKitchen: numberWithDefault(
        motivationPenaltiesSource.dirtyKitchen,
        DEFAULT_MOTIVATION_SETTINGS.penalties.dirtyKitchen,
      ),
      missedCallNoCallback: numberWithDefault(
        motivationPenaltiesSource.missedCallNoCallback,
        DEFAULT_MOTIVATION_SETTINGS.penalties.missedCallNoCallback,
      ),
      messyWorkspace: numberWithDefault(
        motivationPenaltiesSource.messyWorkspace,
        DEFAULT_MOTIVATION_SETTINGS.penalties.messyWorkspace,
      ),
      strangersBehindDesk: numberWithDefault(
        motivationPenaltiesSource.strangersBehindDesk,
        DEFAULT_MOTIVATION_SETTINGS.penalties.strangersBehindDesk,
      ),
      climateControl: numberWithDefault(
        motivationPenaltiesSource.climateControl,
        DEFAULT_MOTIVATION_SETTINGS.penalties.climateControl,
      ),
      fridgeNotFilled: numberWithDefault(
        motivationPenaltiesSource.fridgeNotFilled,
        DEFAULT_MOTIVATION_SETTINGS.penalties.fridgeNotFilled,
      ),
      loudSwearingPerCase: numberWithDefault(
        motivationPenaltiesSource.loudSwearingPerCase,
        DEFAULT_MOTIVATION_SETTINGS.penalties.loudSwearingPerCase,
      ),
      secretGuestFailed: numberWithDefault(
        motivationPenaltiesSource.secretGuestFailed,
        DEFAULT_MOTIVATION_SETTINGS.penalties.secretGuestFailed,
      ),
    },
    bonusRates: {
      bar: numberWithDefault(
        motivationBonusRatesSource.bar ?? bonusRates.goodsThreshold,
        DEFAULT_MOTIVATION_SETTINGS.bonusRates.bar,
      ),
      services: numberWithDefault(
        motivationBonusRatesSource.services ?? bonusRates.psThreshold,
        DEFAULT_MOTIVATION_SETTINGS.bonusRates.services,
      ),
      planMultiplier: numberWithDefault(
        motivationBonusRatesSource.planMultiplier,
        DEFAULT_MOTIVATION_SETTINGS.bonusRates.planMultiplier,
      ),
    },
  };

  const clubSmartshellId = getClubValue(club, 'smartshell_id');
  const smartshellCompanyId = optionalInteger(
    smartshellSource.companyId ?? settings.smartshellCompanyId ?? clubSmartshellId,
  );
  const {
    managerPassword,
    password,
    managerPasswordPlain,
    managerPasswordEncrypted,
    credentialsUpdatedAt,
    hasManagerCredentials,
    ...safeSmartshellSource
  } = smartshellSource;
  const normalizedManagerLogin = optionalString(smartshellSource.managerLogin);
  const normalizedManagerPasswordEncrypted = optionalString(
    managerPasswordEncrypted,
  );
  const normalizedCredentialsUpdatedAt = optionalString(credentialsUpdatedAt);

  void managerPassword;
  void password;
  void managerPasswordPlain;
  void hasManagerCredentials;

  return {
    ...settings,
    motivation,
    salaryRates,
    bonusRates,
    responsibilities: {
      ...responsibilitiesSource,
      items: normalizeResponsibilityItems(responsibilitiesSource.items),
    },
    smartshell: {
      ...safeSmartshellSource,
      companyId: smartshellCompanyId,
      managerLogin: normalizedManagerLogin,
      managerPasswordEncrypted: normalizedManagerPasswordEncrypted,
      credentialsUpdatedAt: normalizedCredentialsUpdatedAt,
      hasManagerCredentials: Boolean(
        smartshellCompanyId &&
          normalizedManagerLogin &&
          normalizedManagerPasswordEncrypted,
      ),
    },
  };
};

const getSmartshellCompanyId = (club) => {
  const settings = normalizeClubSettings(getClubValue(club, 'settings'), club);
  return settings.smartshell.companyId;
};

module.exports = {
  DEFAULT_CLUB_SETTINGS,
  DEFAULT_MOTIVATION_SETTINGS,
  DEFAULT_RESPONSIBILITY_ITEMS,
  LEGACY_DEFAULT_SALARY_RATES,
  LEGACY_DEFAULT_BONUS_RATES,
  normalizeClubSettings,
  getSmartshellCompanyId,
};
