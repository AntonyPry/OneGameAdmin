'use strict';

const assert = require('assert');

const smartshellApiPath = require.resolve('../integrations/smartshell.api');
const tokenServicePath = require.resolve('../services/token.service');
const reportsServicePath = require.resolve('../services/reports.service');
const paymentsServicePath = require.resolve('../services/payments.service');
const excelServicePath = require.resolve('../services/excel.service');
const exportHistoryServicePath = require.resolve('../services/exportHistory.service');
const paymentsControllerPath = require.resolve('../controllers/payments.controller');

const originals = {
  smartshellApi: require.cache[smartshellApiPath],
  tokenService: require.cache[tokenServicePath],
  reportsService: require.cache[reportsServicePath],
  paymentsService: require.cache[paymentsServicePath],
  excelService: require.cache[excelServicePath],
  exportHistoryService: require.cache[exportHistoryServicePath],
  paymentsController: require.cache[paymentsControllerPath],
};

const restore = () => {
  const paths = {
    smartshellApi: smartshellApiPath,
    tokenService: tokenServicePath,
    reportsService: reportsServicePath,
    paymentsService: paymentsServicePath,
    excelService: excelServicePath,
    exportHistoryService: exportHistoryServicePath,
    paymentsController: paymentsControllerPath,
  };

  Object.entries(paths).forEach(([key, path]) => {
    if (originals[key]) {
      require.cache[path] = originals[key];
    } else {
      delete require.cache[path];
    }
  });
};

const unifiedReport = ({ title, labels, keys, data, summary }) => ({
  title,
  labels,
  extraLabels: [],
  extraLabels2: [],
  extraLabels3: [],
  keys,
  points: data.length,
  data: data.map((values) => ({ values })),
  summary: summary || [],
});

const successResponse = (operationName) => {
  if (operationName === 'overviewReport') {
    return {
      error: false,
      data: {
        overviewReport: {
          data: [
            unifiedReport({
              title: 'Итоги периода',
              labels: ['Выручка'],
              keys: ['sum', 'count'],
              data: [[15000, 12]],
              summary: [{ title: 'Итого выручка', value: '15000' }],
            }),
          ],
        },
      },
    };
  }

  if (operationName === 'salesReport') {
    return {
      error: false,
      data: {
        salesReport: unifiedReport({
          title: 'Продажи',
          labels: ['Кола', 'Тариф 3 часа'],
          keys: ['sum', 'amount'],
          data: [
            [1200, 6],
            [9000, 3],
          ],
        }),
      },
    };
  }

  if (operationName === 'topSoldOverviewItemsReport') {
    return {
      error: false,
      data: {
        topSoldOverviewItemsReport: unifiedReport({
          title: 'Топ продаж',
          labels: ['Пополнение бара', 'client@example.test +79000000000'],
          keys: ['sum', 'amount'],
          data: [
            [3000, 10],
            [500, 1],
          ],
          summary: [
            {
              title: 'token password phone email nickname',
              value: 1,
              extraString: 'manager@example.test +79001112233',
            },
          ],
        }),
      },
    };
  }

  if (operationName === 'sessionsMoneyReport') {
    return {
      error: false,
      data: {
        sessionsMoneyReport: unifiedReport({
          title: 'Сессии',
          labels: ['День'],
          keys: ['sum', 'sessions_count'],
          data: [[7000, 8]],
        }),
      },
    };
  }

  return {
    error: false,
    data: {
      boughtTariffsReport: unifiedReport({
        title: 'Купленные тарифы',
        labels: ['Пакет ночь'],
        keys: ['sum', 'amount'],
        data: [[4500, 2]],
      }),
    },
  };
};

const installReportsServiceMocks = ({ failOperations = [], failAll = false } = {}) => {
  const calls = [];

  require.cache[smartshellApiPath] = {
    id: smartshellApiPath,
    filename: smartshellApiPath,
    loaded: true,
    exports: {
      executeSmartshellQuery: async ({ query, variables }, token, options = {}) => {
        calls.push({ query, variables, token, options });

        if (failAll || failOperations.includes(options.operationName)) {
          return {
            error: true,
            code: 'SMARTSHELL_PERMISSION_DENIED',
            category: 'permission',
            message: 'Недостаточно прав для запроса к Smartshell',
            statusCode: 502,
            operationName: options.operationName,
            retryable: false,
          };
        }

        return successResponse(options.operationName);
      },
    },
  };

  require.cache[tokenServicePath] = {
    id: tokenServicePath,
    filename: tokenServicePath,
    loaded: true,
    exports: {
      getManagerToken: async () => 'fake-token-value',
    },
  };

  delete require.cache[reportsServicePath];
  return { calls, reportsService: require('../services/reports.service') };
};

const createMockResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

(async () => {
  const { calls, reportsService } = installReportsServiceMocks();
  const result = await reportsService.getPeriodOverview({
    startDate: '2026-07-10 00:00:00',
    endDate: '2026-07-10 23:59:59',
    club: { id: 7 },
    dbClubId: 7,
  });

  assert.strictEqual(result.error, false);
  assert.strictEqual(result.report.status, 'ok');
  assert.deepStrictEqual(result.report.availableSources.sort(), [
    'boughtTariffsReport',
    'overviewReport',
    'salesReport',
    'sessionsMoneyReport',
    'topSoldOverviewItemsReport',
  ]);
  assert(result.report.totals.length > 0, 'totals should be normalized');
  assert(result.report.sections.length > 0, 'sections should be normalized');
  assert(result.report.topItems.length > 0, 'top items should be normalized');
  assert(
    calls.every((call) => !call.query.includes('clientsPaymentReport')),
    'clientsPaymentReport must not be queried',
  );
  assert(
    calls.every((call) => !/(phone|email|nickname|client\s*\{)/i.test(call.query)),
    'report queries must not request client PII fields',
  );

  const serialized = JSON.stringify(result);
  assert.strictEqual(serialized.includes('fake-token-value'), false);
  assert.strictEqual(serialized.includes('manager@example.test'), false);
  assert.strictEqual(serialized.includes('client@example.test'), false);
  assert.strictEqual(serialized.includes('79000000000'), false);
  assert.strictEqual(serialized.includes('79001112233'), false);
  assert.strictEqual(serialized.includes('"client"'), false);
  assert.strictEqual(serialized.includes('"phone"'), false);
  assert.strictEqual(serialized.includes('"email"'), false);
  assert.strictEqual(serialized.includes('"nickname"'), false);

  restore();
  const degradedHarness = installReportsServiceMocks({
    failOperations: ['sessionsMoneyReport'],
  });
  const degradedResult = await degradedHarness.reportsService.getPeriodOverview({
    startDate: '2026-07-10 00:00:00',
    endDate: '2026-07-10 23:59:59',
    club: { id: 7 },
    dbClubId: 7,
  });

  assert.strictEqual(degradedResult.error, false);
  assert.strictEqual(degradedResult.report.status, 'degraded');
  assert.strictEqual(degradedResult.report.partialData, true);
  assert.strictEqual(degradedResult.report.warnings.length, 1);
  assert.strictEqual(
    degradedResult.report.warnings[0].operationName,
    'sessionsMoneyReport',
  );

  restore();
  const failedHarness = installReportsServiceMocks({ failAll: true });
  const failedResult = await failedHarness.reportsService.getPeriodOverview({
    startDate: '2026-07-10 00:00:00',
    endDate: '2026-07-10 23:59:59',
    club: { id: 7 },
    dbClubId: 7,
  });

  assert.strictEqual(failedResult.error, true);
  assert.strictEqual(failedResult.code, 'SMARTSHELL_PERMISSION_DENIED');
  assert.strictEqual(failedResult.statusCode, 502);
  assert.strictEqual(failedResult.failures.length, 5);
  assert.strictEqual(JSON.stringify(failedResult).includes('fake-token-value'), false);

  restore();
  let controllerServiceCalled = false;
  require.cache[paymentsServicePath] = {
    id: paymentsServicePath,
    filename: paymentsServicePath,
    loaded: true,
    exports: {},
  };
  require.cache[excelServicePath] = {
    id: excelServicePath,
    filename: excelServicePath,
    loaded: true,
    exports: {},
  };
  require.cache[exportHistoryServicePath] = {
    id: exportHistoryServicePath,
    filename: exportHistoryServicePath,
    loaded: true,
    exports: { REPORT_TYPES: {} },
  };
  require.cache[tokenServicePath] = {
    id: tokenServicePath,
    filename: tokenServicePath,
    loaded: true,
    exports: { getManagerToken: async () => 'fake-token-value' },
  };
  require.cache[reportsServicePath] = {
    id: reportsServicePath,
    filename: reportsServicePath,
    loaded: true,
    exports: {
      getPeriodOverview: async () => {
        controllerServiceCalled = true;
        return { error: false, report: {} };
      },
    },
  };
  delete require.cache[paymentsControllerPath];
  const paymentsController = require('../controllers/payments.controller');
  const response = createMockResponse();

  await paymentsController.periodOverview(
    {
      body: {
        startDate: '2026-01-01 00:00:00',
        endDate: '2026-01-01 23:59:59',
      },
      user: { id: 1, free_trial_expires_at: '2099-01-01T00:00:00.000Z' },
      currentClub: { id: 7 },
      dbClubId: 7,
    },
    response,
  );

  assert.strictEqual(controllerServiceCalled, false);
  assert.strictEqual(response.statusCode, 403);
  assert.strictEqual(response.body.code, 'FREE_TRIAL_WINDOW_EXCEEDED');

  console.log('reports period overview smoke passed');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restore);
