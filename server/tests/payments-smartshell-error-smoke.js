'use strict';

const assert = require('assert');

const smartshellApiPath = require.resolve('../integrations/smartshell.api');
const tokenServicePath = require.resolve('../services/token.service');
const paymentsServicePath = require.resolve('../services/payments.service');

const originalSmartshellApi = require.cache[smartshellApiPath];
const originalTokenService = require.cache[tokenServicePath];
const originalPaymentsService = require.cache[paymentsServicePath];

const paginatedResponse = (dataPath, data = []) => ({
  error: false,
  data: {
    [dataPath]: {
      paginatorInfo: { currentPage: 1, lastPage: 1, hasMorePages: false },
      data,
    },
  },
});

const paymentCreatedEvent = {
  timestamp: '2026-07-10 10:00:00',
  client: null,
  payment: { id: 101, value: 500, title: 'CASH' },
  payment_items: [{ title: 'Поминутный', amount: 1, sum: 500, entity_type: 'TARIFF' }],
  value1: 0,
  operator: null,
};

(async () => {
  const calls = [];
  let failedEventType = 'DEPOSIT_ADDED_ONLINE';

  require.cache[smartshellApiPath] = {
    id: smartshellApiPath,
    filename: smartshellApiPath,
    loaded: true,
    exports: {
      executeSmartshellQuery: async ({ query }, token, options = {}) => {
        calls.push({ query, token, options });

        if (
          failedEventType &&
          query.includes(`types: "${failedEventType}"`)
        ) {
          return {
            error: true,
            code: 'SMARTSHELL_TIMEOUT',
            category: 'timeout',
            message: 'Истек timeout запроса к Smartshell',
            statusCode: 504,
            operationName: options.operationName,
            traceId: 'trace-payment-timeout',
            retryable: true,
          };
        }

        if (query.includes('workShifts')) {
          return paginatedResponse('workShifts');
        }

        if (query.includes('types: "PAYMENT_CREATED"')) {
          return paginatedResponse('eventList', [paymentCreatedEvent]);
        }

        return paginatedResponse('eventList');
      },
    },
  };

  require.cache[tokenServicePath] = {
    id: tokenServicePath,
    filename: tokenServicePath,
    loaded: true,
    exports: {
      getManagerToken: async () => 'fake-manager-token',
    },
  };

  delete require.cache[paymentsServicePath];
  const paymentsService = require('../services/payments.service');

  const result = await paymentsService.getResultsArray(
    '2026-07-10 09:00:00',
    '2026-07-10 21:00:00',
    { id: 7 },
  );

  assert.strictEqual(Array.isArray(result), false);
  assert.strictEqual(result.error, true);
  assert.strictEqual(result.code, 'SMARTSHELL_TIMEOUT');
  assert.strictEqual(result.category, 'timeout');
  assert.strictEqual(result.statusCode, 504);
  assert.strictEqual(result.operationName, 'eventList');
  assert.strictEqual(result.traceId, 'trace-payment-timeout');
  assert.strictEqual(result.retryable, true);
  assert(
    calls.some((call) => call.query.includes('PAYMENT_CREATED')),
    'successful payment branch should have been called',
  );
  assert(
    calls.some((call) => call.query.includes('DEPOSIT_ADDED_ONLINE')),
    'failed payment branch should have been called',
  );

  const partialResult = await paymentsService.getResultsArray(
    '2026-07-10 09:00:00',
    '2026-07-10 21:00:00',
    { id: 7 },
    { allowPartial: true, includeMetadata: true },
  );

  assert.strictEqual(partialResult.error, false);
  assert.strictEqual(partialResult.source, 'smartshell_event_list');
  assert.strictEqual(partialResult.partialData, true);
  assert(partialResult.result.length > 0);
  assert.strictEqual(partialResult.warnings.length, 1);
  assert.strictEqual(partialResult.warnings[0].code, 'SMARTSHELL_TIMEOUT');

  failedEventType = 'PAYMENT_CREATED';
  const criticalFailureResult = await paymentsService.getResultsArray(
    '2026-07-10 09:00:00',
    '2026-07-10 21:00:00',
    { id: 7 },
    { allowPartial: true, includeMetadata: true },
  );

  assert.strictEqual(criticalFailureResult.error, true);
  assert.strictEqual(criticalFailureResult.code, 'SMARTSHELL_TIMEOUT');
  assert.strictEqual(criticalFailureResult.category, 'timeout');
  assert.strictEqual(criticalFailureResult.statusCode, 504);
  assert.strictEqual(criticalFailureResult.operationName, 'eventList');
  assert.strictEqual(criticalFailureResult.retryable, true);
  assert.strictEqual(criticalFailureResult.result, undefined);

  console.log('payments smartshell error smoke passed');
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (originalSmartshellApi) {
      require.cache[smartshellApiPath] = originalSmartshellApi;
    } else {
      delete require.cache[smartshellApiPath];
    }

    if (originalTokenService) {
      require.cache[tokenServicePath] = originalTokenService;
    } else {
      delete require.cache[tokenServicePath];
    }

    if (originalPaymentsService) {
      require.cache[paymentsServicePath] = originalPaymentsService;
    } else {
      delete require.cache[paymentsServicePath];
    }
  });
