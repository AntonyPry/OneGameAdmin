'use strict';

const assert = require('assert');

const adminServicePath = require.resolve('../services/admin.service');
const smartshellApiPath = require.resolve('../integrations/smartshell.api');
const tokenServicePath = require.resolve('../services/token.service');
const paymentsServicePath = require.resolve('../services/payments.service');
const modelsPath = require.resolve('../models');

const originals = {
  adminService: require.cache[adminServicePath],
  smartshellApi: require.cache[smartshellApiPath],
  tokenService: require.cache[tokenServicePath],
  paymentsService: require.cache[paymentsServicePath],
  models: require.cache[modelsPath],
};

const restore = () => {
  Object.entries(originals).forEach(([key, value]) => {
    const pathByKey = {
      adminService: adminServicePath,
      smartshellApi: smartshellApiPath,
      tokenService: tokenServicePath,
      paymentsService: paymentsServicePath,
      models: modelsPath,
    };

    if (value) {
      require.cache[pathByKey[key]] = value;
    } else {
      delete require.cache[pathByKey[key]];
    }
  });
};

const club = {
  id: 1,
  smartshell_id: 6816,
  settings: {
    motivation: {
      basePay: { day: 1000, night: 1200 },
      taskCompletionBonus: 1200,
      bonusRates: { bar: 0.05, services: 0.1, planMultiplier: 2 },
    },
  },
};

let activeShift = {
  id: 987,
  created_at: '2026-07-10 09:05:00',
  worker: { first_name: 'Test', last_name: 'Admin' },
};
let paymentsResponse = {
  error: false,
  source: 'smartshell_event_list',
  partialData: true,
  warnings: [
    {
      code: 'SMARTSHELL_EVENT_LIST_BRANCH_FAILED',
      category: 'partial_data',
      message: 'Не удалось загрузить часть событий Smartshell: пополнения СБП',
      operationName: 'eventList',
      statusCode: 504,
      retryable: true,
    },
  ],
  result: [
    {
      timestamp: '2026-07-10 10:00:00',
      idForSort: 20260710100000,
      type: 'GOOD',
      title: 'Напиток',
      sum: 100,
      payment_title: 'CARD',
    },
    {
      timestamp: '2026-07-10 10:10:00',
      idForSort: 20260710101000,
      type: 'SERVICE',
      title: 'Услуга',
      sum: 200,
      payment_title: 'CARD',
    },
    {
      timestamp: '2026-07-10 10:20:00',
      idForSort: 20260710102000,
      type: 'PS',
      title: 'PS',
      sum: 300,
      payment_title: 'CARD',
    },
    {
      timestamp: '2026-07-10 10:30:00',
      idForSort: 20260710103000,
      type: 'TARIFF',
      title: 'Пакет ПК',
      sum: 400,
      payment_title: 'CARD',
    },
  ],
};
let paymentCalls = 0;

require.cache[modelsPath] = {
  id: modelsPath,
  filename: modelsPath,
  loaded: true,
  exports: {
    MonthlyPlan: {
      findOne: async () => null,
    },
    ShiftResponsibility: {
      findOne: async () => null,
    },
    Club: {
      findByPk: async () => club,
    },
    sequelize: {
      transaction: async (callback) => callback({}),
    },
  },
};

require.cache[tokenServicePath] = {
  id: tokenServicePath,
  filename: tokenServicePath,
  loaded: true,
  exports: {
    getManagerToken: async () => 'fake-token',
  },
};

require.cache[paymentsServicePath] = {
  id: paymentsServicePath,
  filename: paymentsServicePath,
  loaded: true,
  exports: {
    getResultsArray: async () => {
      paymentCalls += 1;
      return paymentsResponse;
    },
  },
};

require.cache[smartshellApiPath] = {
  id: smartshellApiPath,
  filename: smartshellApiPath,
  loaded: true,
  exports: {
    executeSmartshellQuery: async ({ query }, token, options = {}) => {
      assert.strictEqual(token, 'fake-token');

      if (query.includes('activeWorkShift')) {
        return { error: false, data: { activeWorkShift: activeShift } };
      }

      if (query.includes('getWorkShiftPaymentOverviewData')) {
        return {
          error: false,
          data: {
            getWorkShiftPaymentOverviewData: {
              id: activeShift.id,
              total: '1000',
              goods: [{ __typename: 'WorkShiftPaymentOverviewGoodData' }],
              services: [
                { __typename: 'WorkShiftPaymentOverviewServiceData' },
              ],
            },
          },
          operationName: options.operationName,
        };
      }

      if (query.includes('getDetailedWorkShiftMoneyData')) {
        return {
          error: false,
          data: {
            getDetailedWorkShiftMoneyData: {
              id: activeShift.id,
              total: '1000',
              cash: { __typename: 'MoneyData' },
              card: { __typename: 'MoneyData' },
            },
          },
          operationName: options.operationName,
        };
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  },
};

delete require.cache[adminServicePath];
const adminService = require('../services/admin.service');

(async () => {
  const stats = await adminService.calculateCurrentStats({
    startDate: '2026-07-10 09:05:00',
    endDate: '2026-07-10 21:00:00',
    dbClubId: 1,
    club,
  });

  assert.strictEqual(stats.error, undefined);
  assert.strictEqual(stats.currentStatsObject.totalRevenue, 1000);
  assert.strictEqual(stats.currentStatsObject.barRevenue, 100);
  assert.strictEqual(stats.currentStatsObject.servicesRevenue, 200);
  assert.strictEqual(stats.currentStatsObject.psRevenue, 300);
  assert.strictEqual(stats.currentStatsObject.pcRevenue, 400);
  assert(stats.planStatsObject, 'legacy planStatsObject field should exist');
  assert(stats.currentAwardsObject, 'legacy currentAwardsObject field should exist');
  assert.strictEqual(stats.source, 'smartshell_event_list');
  assert.strictEqual(stats.dataSource, 'smartshell_event_list');
  assert.strictEqual(stats.partialData, true);
  assert(stats.generatedAt, 'generatedAt should be returned');
  assert.strictEqual(stats.shiftWindow.shiftType, 'day');
  assert.strictEqual(stats.shiftWindow.normalizedStart, '2026-07-10 09:05:00');
  assert.strictEqual(stats.metadata.status, 'partial');
  assert.strictEqual(stats.metadata.supportingSources.length, 2);

  const warningCodes = stats.warnings.map((warning) => warning.code);
  assert(warningCodes.includes('SMARTSHELL_EVENT_LIST_BRANCH_FAILED'));
  assert(warningCodes.includes('SMARTSHELL_SHIFT_SPECIFIC_SOURCE_NOT_PRIMARY'));

  activeShift = null;
  paymentCalls = 0;
  const noShift = await adminService.calculateCurrentStats({
    startDate: '2026-07-10 09:05:00',
    endDate: '2026-07-10 21:00:00',
    dbClubId: 1,
    club,
  });

  assert.strictEqual(noShift.error, true);
  assert.strictEqual(noShift.code, 'NO_ACTIVE_WORKSHIFT');
  assert.strictEqual(noShift.statusCode, 409);
  assert.strictEqual(noShift.metadata.status, 'no_active_shift');
  assert.strictEqual(paymentCalls, 0);

  activeShift = {
    id: 987,
    created_at: '2026-07-10 09:05:00',
    worker: { first_name: 'Test', last_name: 'Admin' },
  };
  paymentsResponse = {
    error: true,
    code: 'SMARTSHELL_TIMEOUT',
    category: 'timeout',
    message: 'Истек timeout запроса к Smartshell',
    statusCode: 504,
    operationName: 'eventList',
    retryable: true,
  };
  const primaryError = await adminService.calculateCurrentStats({
    startDate: '2026-07-10 09:05:00',
    endDate: '2026-07-10 21:00:00',
    dbClubId: 1,
    club,
  });

  assert.strictEqual(primaryError.error, true);
  assert.strictEqual(primaryError.code, 'SMARTSHELL_TIMEOUT');
  assert.strictEqual(primaryError.statusCode, 504);
  assert.strictEqual(primaryError.source, 'smartshell_event_list');
  assert.strictEqual(primaryError.warnings[0].code, 'SMARTSHELL_TIMEOUT');

  console.log('current shift reliability smoke passed');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restore);
