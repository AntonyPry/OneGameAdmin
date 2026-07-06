'use strict';

const { QueryTypes } = require('sequelize');

const MONTHLY_PLAN_UNIQUE = 'monthly_plans_club_date_shift_unique';
const SHIFT_RESPONSIBILITY_UNIQUE =
  'shift_responsibilities_club_shift_unique';

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

const normalizeClubSettings = (rawSettings, smartshellId) => {
  const settings = parseJsonObject(rawSettings);
  const legacySalaryRates = parseJsonObject(settings.salary_rates);
  const salaryRatesSource = parseJsonObject(settings.salaryRates);
  const legacyBonusRates = parseJsonObject(settings.bonuses);
  const bonusRatesSource = parseJsonObject(settings.bonusRates);
  const responsibilitiesSource = parseJsonObject(settings.responsibilities);
  const smartshellSource = parseJsonObject(settings.smartshell);

  const salaryRates = {
    dayPerMinute: numberWithDefault(
      salaryRatesSource.dayPerMinute ?? legacySalaryRates.dayPerMinute,
      1.6,
    ),
    nightPerMinute: numberWithDefault(
      salaryRatesSource.nightPerMinute ?? legacySalaryRates.nightPerMinute,
      1.9,
    ),
    responsibilityBonus: numberWithDefault(
      salaryRatesSource.responsibilityBonus ??
        salaryRatesSource.additionalBonus ??
        legacySalaryRates.responsibilityBonus ??
        legacySalaryRates.additionalBonus,
      500,
    ),
  };

  const bonusRates = {
    goodsThreshold: numberWithDefault(
      bonusRatesSource.goodsThreshold ?? legacyBonusRates.goodsThreshold,
      0.05,
    ),
    psThreshold: numberWithDefault(
      bonusRatesSource.psThreshold ?? legacyBonusRates.psThreshold,
      0.1,
    ),
    pcThreshold: numberWithDefault(
      bonusRatesSource.pcThreshold ?? legacyBonusRates.pcThreshold,
      0.03,
    ),
  };

  const smartshellCompanyId = positiveIntegerOrNull(
    smartshellSource.companyId ?? settings.smartshellCompanyId ?? smartshellId,
  );

  const {
    salary_rates,
    bonuses,
    salaryRates: previousSalaryRates,
    bonusRates: previousBonusRates,
    responsibilities: previousResponsibilities,
    smartshell: previousSmartshell,
    smartshellCompanyId: previousSmartshellCompanyId,
    ...otherSettings
  } = settings;

  void salary_rates;
  void bonuses;
  void previousSalaryRates;
  void previousBonusRates;
  void previousResponsibilities;
  void previousSmartshell;
  void previousSmartshellCompanyId;

  return {
    ...otherSettings,
    salaryRates,
    bonusRates,
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

const sameColumns = (fields, columns) => {
  const fieldNames = fields.map((field) => field.attribute || field.name);
  return (
    fieldNames.length === columns.length &&
    fieldNames.every((fieldName, index) => fieldName === columns[index])
  );
};

const hasUniqueIndex = async (queryInterface, tableName, columns, indexName) => {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some(
    (index) =>
      index.unique === true &&
      (index.name === indexName || sameColumns(index.fields || [], columns)),
  );
};

const hasNamedIndex = async (queryInterface, tableName, indexName) => {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
};

const addUniqueConstraintIfMissing = async (
  queryInterface,
  tableName,
  columns,
  constraintName,
) => {
  const exists = await hasUniqueIndex(
    queryInterface,
    tableName,
    columns,
    constraintName,
  );

  if (exists) return;

  await queryInterface.addConstraint(tableName, {
    fields: columns,
    type: 'unique',
    name: constraintName,
  });
};

const removeConstraintIfExists = async (
  queryInterface,
  tableName,
  constraintName,
) => {
  const exists = await hasNamedIndex(queryInterface, tableName, constraintName);

  if (!exists) return;
  await queryInterface.removeConstraint(tableName, constraintName);
};

const formatDuplicateRows = (rows, label) => {
  if (!rows.length) return null;

  const sample = rows
    .slice(0, 5)
    .map((row) => {
      if (label === 'MonthlyPlans') {
        return `club_id=${row.club_id}, date=${row.date}, shift_type=${row.shift_type}, ids=${row.duplicate_ids}`;
      }

      return `club_id=${row.club_id}, shift_created_at=${row.shift_created_at}, ids=${row.duplicate_ids}`;
    })
    .join('; ');

  return `${label} has duplicate tenant keys. Resolve duplicates before adding unique constraint. Sample: ${sample}`;
};

const assertNoDuplicateTenantRows = async (sequelize) => {
  const monthlyPlanDuplicates = await sequelize.query(
    `
      SELECT
        club_id,
        date,
        shift_type,
        COUNT(*) AS duplicate_count,
        GROUP_CONCAT(id ORDER BY id) AS duplicate_ids
      FROM MonthlyPlans
      GROUP BY club_id, date, shift_type
      HAVING COUNT(*) > 1
      LIMIT 10
    `,
    { type: QueryTypes.SELECT },
  );

  const shiftResponsibilityDuplicates = await sequelize.query(
    `
      SELECT
        club_id,
        shift_created_at,
        COUNT(*) AS duplicate_count,
        GROUP_CONCAT(id ORDER BY id) AS duplicate_ids
      FROM ShiftResponsibilities
      GROUP BY club_id, shift_created_at
      HAVING COUNT(*) > 1
      LIMIT 10
    `,
    { type: QueryTypes.SELECT },
  );

  const duplicateMessages = [
    formatDuplicateRows(monthlyPlanDuplicates, 'MonthlyPlans'),
    formatDuplicateRows(shiftResponsibilityDuplicates, 'ShiftResponsibilities'),
  ].filter(Boolean);

  if (duplicateMessages.length) {
    throw new Error(duplicateMessages.join(' | '));
  }
};

const backfillClubSettings = async (sequelize) => {
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
    const sequelize = queryInterface.sequelize;

    await backfillClubSettings(sequelize);
    await assertNoDuplicateTenantRows(sequelize);

    await addUniqueConstraintIfMissing(
      queryInterface,
      'MonthlyPlans',
      ['club_id', 'date', 'shift_type'],
      MONTHLY_PLAN_UNIQUE,
    );

    await addUniqueConstraintIfMissing(
      queryInterface,
      'ShiftResponsibilities',
      ['club_id', 'shift_created_at'],
      SHIFT_RESPONSIBILITY_UNIQUE,
    );
  },

  async down(queryInterface) {
    await removeConstraintIfExists(
      queryInterface,
      'ShiftResponsibilities',
      SHIFT_RESPONSIBILITY_UNIQUE,
    );

    await removeConstraintIfExists(
      queryInterface,
      'MonthlyPlans',
      MONTHLY_PLAN_UNIQUE,
    );
  },
};
