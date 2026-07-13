'use strict';

const { executeSmartshellQuery } = require('../integrations/smartshell.api');
const { getManagerToken } = require('./token.service');

const REPORT_OPERATION_NAMES = Object.freeze([
  'overviewReport',
  'salesReport',
  'sessionsMoneyReport',
  'topSoldOverviewItemsReport',
  'boughtTariffsReport',
]);

const REPORT_FIELDS = `
  title
  labels
  extraLabels
  extraLabels2
  extraLabels3
  keys
  points
  data { values }
  summary { title value extraValue extraString }
`;

const REPORT_QUERIES = Object.freeze({
  overviewReport: {
    source: 'overviewReport',
    query: `query PeriodOverviewReport($input: ReportInput!) {
      overviewReport(input: $input) {
        data { ${REPORT_FIELDS} }
      }
    }`,
    variables: (startDate, endDate) => ({
      input: { start: startDate, end: endDate },
    }),
  },
  salesReport: {
    source: 'salesReport',
    query: `query PeriodSalesReport($input: PaymentsReport!) {
      salesReport(input: $input) { ${REPORT_FIELDS} }
    }`,
    variables: (startDate, endDate) => ({
      input: { from: startDate, to: endDate },
    }),
  },
  sessionsMoneyReport: {
    source: 'sessionsMoneyReport',
    query: `query PeriodSessionsMoneyReport($input: SessionsMoneyReport!) {
      sessionsMoneyReport(input: $input) { ${REPORT_FIELDS} }
    }`,
    variables: (startDate, endDate) => ({
      input: { from: startDate, to: endDate, slice: 'DAY' },
    }),
  },
  topSoldOverviewItemsReport: {
    source: 'topSoldOverviewItemsReport',
    query: `query PeriodTopSoldItemsReport($input: ReportInput!) {
      topSoldOverviewItemsReport(input: $input) { ${REPORT_FIELDS} }
    }`,
    variables: (startDate, endDate) => ({
      input: { start: startDate, end: endDate },
    }),
  },
  boughtTariffsReport: {
    source: 'boughtTariffsReport',
    query: `query PeriodBoughtTariffsReport($input: BoughtTariffsReport!) {
      boughtTariffsReport(input: $input) { ${REPORT_FIELDS} }
    }`,
    variables: (startDate, endDate) => ({
      input: { from: startDate, to: endDate },
    }),
  },
});

const MONEY_KEY_RE =
  /(sum|total|revenue|money|cash|card|deposit|bonus|refund|payment|sale|profit|выруч|сумм|руб|оплат|продаж|налич|карта|депозит)/i;
const COUNT_KEY_RE = /(count|qty|quantity|amount|items|sessions|кол|штук|сесс)/i;
const PERCENT_KEY_RE = /(percent|rate|share|%|процент|дол[яи])/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized =
    typeof value === 'string' ? value.replace(/\s/g, '').replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeText = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;

  return String(value)
    .replace(EMAIL_RE, '[email скрыт]')
    .replace(PHONE_RE, '[телефон скрыт]')
    .slice(0, 160);
};

const isMoneyKey = (value) => MONEY_KEY_RE.test(String(value || ''));
const isCountKey = (value) => COUNT_KEY_RE.test(String(value || ''));
const isPercentKey = (value) => PERCENT_KEY_RE.test(String(value || ''));

const inferUnit = (key, label) => {
  const text = `${key || ''} ${label || ''}`;
  if (isPercentKey(text)) return 'percent';
  if (isMoneyKey(text)) return 'rub';
  if (isCountKey(text)) return 'count';
  return 'count';
};

const createWarning = (result, operationName) => ({
  code: result?.code || 'SMARTSHELL_REPORT_UNAVAILABLE',
  category: result?.category || 'partial_data',
  message:
    result?.message ||
    `Отчет Smartshell ${operationName} временно недоступен`,
  operationName: result?.operationName || operationName,
  statusCode: result?.statusCode || null,
  retryable: Boolean(result?.retryable),
});

const buildValueMap = (keys = [], values = []) => {
  const valueMap = {};
  values.forEach((value, index) => {
    const key = sanitizeText(keys[index], `value${index + 1}`);
    valueMap[key] = toNumber(value);
  });
  return valueMap;
};

const firstNumberByMatcher = (valueMap, matcher) => {
  const entry = Object.entries(valueMap).find(
    ([key, value]) => value !== null && matcher(key),
  );
  return entry ? entry[1] : null;
};

const firstNumber = (valueMap) => {
  const entry = Object.values(valueMap).find((value) => value !== null);
  return entry === undefined ? null : entry;
};

const getRowLabel = (report = {}, index, source) => {
  const labels = [
    report.labels?.[index],
    report.extraLabels?.[index],
    report.extraLabels2?.[index],
    report.extraLabels3?.[index],
  ].filter(Boolean);

  return sanitizeText(labels[0], `${sanitizeText(report.title, source)} #${index + 1}`);
};

const normalizeRows = (report = {}, source) => {
  const keys = Array.isArray(report.keys) ? report.keys : [];
  const points = Array.isArray(report.data) ? report.data : [];

  return points
    .map((point, index) => {
      const valueMap = buildValueMap(keys, point?.values || []);
      const amount = firstNumberByMatcher(valueMap, isCountKey);
      const sum = firstNumberByMatcher(valueMap, isMoneyKey);
      const percent = firstNumberByMatcher(valueMap, isPercentKey);
      const value = firstNumber(valueMap);

      return {
        label: getRowLabel(report, index, source),
        value,
        amount,
        sum,
        percent,
        source,
      };
    })
    .filter((row) =>
      [row.value, row.amount, row.sum, row.percent].some((value) => value !== null),
    );
};

const normalizeSummaryTotals = (report = {}, source) => {
  const summary = Array.isArray(report.summary) ? report.summary : [];

  return summary
    .map((item, index) => {
      const label = sanitizeText(item?.title, `${source} summary ${index + 1}`);
      return {
        key: `${source}_summary_${index}`,
        label,
        value: toNumber(item?.value),
        extraValue: toNumber(item?.extraValue),
        extraLabel: sanitizeText(item?.extraString, ''),
        unit: inferUnit(label, label),
        source,
      };
    })
    .filter((item) => item.value !== null);
};

const normalizeReportSections = (payload, source) => {
  const isUnifiedReport =
    payload &&
    typeof payload === 'object' &&
    (Array.isArray(payload.keys) ||
      Array.isArray(payload.labels) ||
      Array.isArray(payload.summary));
  const reports = isUnifiedReport
    ? [payload]
    : Array.isArray(payload?.data)
      ? payload.data
      : payload && typeof payload === 'object'
        ? [payload]
        : [];

  const sections = [];
  const totals = [];

  reports.forEach((report, index) => {
    const rows = normalizeRows(report, source);
    totals.push(...normalizeSummaryTotals(report, source));

    if (rows.length) {
      sections.push({
        key: `${source}_${index}`,
        title: sanitizeText(report.title, source),
        rows,
        source,
      });
    }
  });

  return { sections, totals };
};

const createTopItems = (sections) =>
  sections
    .filter((section) =>
      ['salesReport', 'topSoldOverviewItemsReport', 'boughtTariffsReport'].includes(
        section.source,
      ),
    )
    .flatMap((section) =>
      section.rows.map((row) => ({
        title: row.label,
        category: section.title,
        amount: row.amount,
        sum: row.sum ?? row.value,
        source: row.source,
      })),
    )
    .filter((item) => item.title && item.sum !== null)
    .sort((a, b) => (b.sum || 0) - (a.sum || 0))
    .slice(0, 10);

const createFallbackTotals = (sections) =>
  sections
    .map((section) => {
      const rowsWithMoney = section.rows.filter((row) => row.sum !== null);
      if (!rowsWithMoney.length) return null;

      return {
        key: `${section.key}_sum`,
        label: section.title,
        value: rowsWithMoney.reduce((sum, row) => sum + (row.sum || 0), 0),
        unit: 'rub',
        source: section.source,
      };
    })
    .filter(Boolean);

const fetchReport = async ({
  operationName,
  startDate,
  endDate,
  managerBearer,
  clubId,
}) => {
  const definition = REPORT_QUERIES[operationName];
  const response = await executeSmartshellQuery(
    {
      query: definition.query,
      variables: definition.variables(startDate, endDate),
    },
    managerBearer,
    {
      operationName,
      clubId,
    },
  );

  if (response.error) return { operationName, response };

  return {
    operationName,
    response,
    payload: response.data?.[operationName],
  };
};

const createAllFailedError = (failures) => {
  const primary = failures[0]?.response || {};

  return {
    error: true,
    code: primary.code || 'SMARTSHELL_REPORTS_UNAVAILABLE',
    category: primary.category || 'reports_unavailable',
    message:
      primary.message ||
      'Smartshell reports недоступны для выбранного периода',
    statusCode: primary.statusCode || 502,
    operationName: primary.operationName || 'periodOverview',
    retryable: failures.some((failure) => Boolean(failure.response?.retryable)),
    failures: failures.map((failure) => ({
      operationName: failure.operationName,
      code: failure.response?.code || 'SMARTSHELL_REPORT_UNAVAILABLE',
      category: failure.response?.category || null,
      statusCode: failure.response?.statusCode || null,
      retryable: Boolean(failure.response?.retryable),
    })),
  };
};

const getPeriodOverview = async ({ startDate, endDate, club, dbClubId }) => {
  const managerBearer = await getManagerToken(club);
  if (managerBearer?.error) return managerBearer;

  const results = await Promise.all(
    REPORT_OPERATION_NAMES.map((operationName) =>
      fetchReport({
        operationName,
        startDate,
        endDate,
        managerBearer,
        clubId: dbClubId,
      }),
    ),
  );

  const failures = results.filter((result) => result.response?.error);
  const successes = results.filter((result) => !result.response?.error);

  if (!successes.length) return createAllFailedError(failures);

  const normalized = successes.map((result) => ({
    operationName: result.operationName,
    ...normalizeReportSections(result.payload, result.operationName),
  }));
  const sections = normalized.flatMap((item) => item.sections);
  const summaryTotals = normalized.flatMap((item) => item.totals);
  const totals = summaryTotals.length ? summaryTotals : createFallbackTotals(sections);
  const warnings = failures.map((failure) =>
    createWarning(failure.response, failure.operationName),
  );

  return {
    error: false,
    report: {
      period: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      source: 'smartshell_reports',
      status: warnings.length ? 'degraded' : 'ok',
      partialData: warnings.length > 0,
      warnings,
      totals,
      sections,
      topItems: createTopItems(sections),
      availableSources: successes.map((result) => result.operationName),
    },
  };
};

module.exports = {
  getPeriodOverview,
  __testing: {
    createAllFailedError,
    createTopItems,
    normalizeReportSections,
    sanitizeText,
  },
};
