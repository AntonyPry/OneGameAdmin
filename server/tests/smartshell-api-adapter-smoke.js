'use strict';

const assert = require('assert');
const {
  __testing,
  getSmartshellOperationName,
  getSmartshellOperationType,
} = require('../integrations/smartshell.api');

const createLogger = () => {
  const records = [];
  return {
    records,
    info: (label, payload) => records.push({ level: 'info', label, payload }),
    warn: (label, payload) => records.push({ level: 'warn', label, payload }),
    error: (label, payload) => records.push({ level: 'error', label, payload }),
  };
};

const createClient = (handlers, logger = createLogger()) => {
  const calls = [];
  const httpClient = async (config) => {
    calls.push(config);
    const handler = handlers.shift();
    assert(handler, 'unexpected Smartshell http call');

    if (handler instanceof Error) throw handler;
    if (typeof handler === 'function') return handler(config);
    return handler;
  };

  return {
    calls,
    logger,
    client: __testing.createSmartshellGraphQLClient({
      httpClient,
      logger,
      sleep: async () => {},
    }),
  };
};

const createHttpError = (status) => {
  const error = new Error(`HTTP ${status}`);
  error.response = {
    status,
    headers: { 'x-request-id': `http-${status}-trace` },
    data: { message: `HTTP ${status}` },
  };
  return error;
};

assert.strictEqual(
  getSmartshellOperationName(
    'query ActiveWorkShift { activeWorkShift { id created_at } }',
  ),
  'ActiveWorkShift',
);
assert.strictEqual(
  getSmartshellOperationName('query { eventList { data { id } } }'),
  'eventList',
);
assert.strictEqual(
  getSmartshellOperationType('mutation Login { login { access_token } }'),
  'mutation',
);
assert.strictEqual(getSmartshellOperationType('{ currentClub { id } }'), 'query');

(async () => {
  const timeoutError = new Error('timeout of 5ms exceeded');
  timeoutError.code = 'ECONNABORTED';

  const retryLogger = createLogger();
  const retryHarness = createClient(
    [
      timeoutError,
      {
        status: 200,
        headers: { 'x-request-id': 'trace-123' },
        data: {
          data: {
            eventList: {
              paginatorInfo: { hasMorePages: false },
              data: [
                {
                  client: {
                    phone: '79000000000',
                    email: 'client@example.test',
                    nickname: 'private-nickname',
                  },
                },
              ],
            },
          },
        },
      },
    ],
    retryLogger,
  );

  const retryResult = await retryHarness.client.executeSmartshellGraphQL({
    query: 'query { eventList { paginatorInfo { hasMorePages } data { client { phone email nickname } } } }',
    token: 'fake-token-value',
    clubId: 42,
    retries: 1,
    timeoutMs: 5,
  });

  assert.strictEqual(retryResult.error, false);
  assert.strictEqual(retryHarness.calls.length, 2);
  assert.strictEqual(retryHarness.calls[0].timeout, 5);
  assert.strictEqual(
    retryHarness.calls[0].headers.authorization,
    'Bearer fake-token-value',
  );
  assert.deepStrictEqual(
    retryLogger.records.map((record) => record.payload.status),
    ['retry', 'ok'],
  );

  const serializedRetryLogs = JSON.stringify(retryLogger.records);
  assert.strictEqual(serializedRetryLogs.includes('fake-token-value'), false);
  assert.strictEqual(serializedRetryLogs.includes('79000000000'), false);
  assert.strictEqual(serializedRetryLogs.includes('client@example.test'), false);
  assert.strictEqual(serializedRetryLogs.includes('private-nickname'), false);

  const mutationTimeout = new Error('timeout of 5ms exceeded');
  mutationTimeout.code = 'ECONNABORTED';
  const mutationHarness = createClient([mutationTimeout]);
  const mutationResult = await mutationHarness.client.executeSmartshellGraphQL({
    query: 'mutation Login($login: String!, $password: String!, $companyId: Int!) { login(input: { login: $login, password: $password, company_id: $companyId }) { access_token } }',
    variables: {
      login: 'manager@example.test',
      password: 'fake-manager-password',
      companyId: 1,
    },
    operationName: 'Login',
    operationType: 'mutation',
    readOnly: false,
    requiresAuth: false,
    retries: 5,
  });

  assert.strictEqual(mutationHarness.calls.length, 1);
  assert.strictEqual(mutationResult.error, true);
  assert.strictEqual(mutationResult.code, 'SMARTSHELL_TIMEOUT');
  assert.strictEqual(mutationResult.retryable, false);
  assert.strictEqual(
    JSON.stringify(mutationHarness.logger.records).includes(
      'fake-manager-password',
    ),
    false,
  );

  const permissionHarness = createClient([
    {
      status: 200,
      headers: {},
      data: {
        errors: [
          {
            message: 'not permitted',
            extensions: { code: '401', traceId: 'gql-trace-401' },
          },
        ],
      },
    },
  ]);
  const permissionResult =
    await permissionHarness.client.executeSmartshellGraphQL({
      query: 'query ActiveWorkShift { activeWorkShift { id } }',
      token: 'token',
      clubId: 42,
    });

  assert.strictEqual(permissionResult.error, true);
  assert.strictEqual(permissionResult.code, 'SMARTSHELL_PERMISSION_DENIED');
  assert.strictEqual(permissionResult.category, 'permission');
  assert.strictEqual(permissionResult.traceId, 'gql-trace-401');
  assert.deepStrictEqual(permissionResult.graphQLErrorCodes, ['401']);
  assert.strictEqual(
    JSON.stringify(permissionHarness.logger.records).includes('not permitted'),
    false,
  );

  const graphQLHarness = createClient([
    {
      status: 200,
      data: {
        errors: [{ message: 'validation failed', extensions: { code: 'BAD' } }],
      },
    },
  ]);
  const graphQLResult = await graphQLHarness.client.executeSmartshellGraphQL({
    query: 'query { currentClub { id } }',
    token: 'token',
    retries: 2,
  });

  assert.strictEqual(graphQLHarness.calls.length, 1);
  assert.strictEqual(graphQLResult.code, 'SMARTSHELL_GRAPHQL_ERROR');
  assert.deepStrictEqual(graphQLResult.graphQLErrorCodes, ['BAD']);

  const badRequestHarness = createClient([createHttpError(400)]);
  const badRequestResult =
    await badRequestHarness.client.executeSmartshellGraphQL({
      query: 'query { currentClub { id } }',
      token: 'token',
      retries: 2,
    });

  assert.strictEqual(badRequestHarness.calls.length, 1);
  assert.strictEqual(badRequestResult.code, 'SMARTSHELL_HTTP_ERROR');
  assert.strictEqual(badRequestResult.upstreamStatus, 400);
  assert.strictEqual(badRequestResult.retryable, false);

  const notFoundHarness = createClient([createHttpError(404)]);
  const notFoundResult = await notFoundHarness.client.executeSmartshellGraphQL({
    query: 'query { currentClub { id } }',
    token: 'token',
    retries: 2,
  });

  assert.strictEqual(notFoundHarness.calls.length, 1);
  assert.strictEqual(notFoundResult.code, 'SMARTSHELL_HTTP_ERROR');
  assert.strictEqual(notFoundResult.upstreamStatus, 404);
  assert.strictEqual(notFoundResult.retryable, false);

  const rateLimitHarness = createClient([
    createHttpError(429),
    { status: 200, data: { data: { currentClub: { id: 1 } } } },
  ]);
  const rateLimitResult =
    await rateLimitHarness.client.executeSmartshellGraphQL({
      query: 'query { currentClub { id } }',
      token: 'token',
      retries: 1,
    });

  assert.strictEqual(rateLimitHarness.calls.length, 2);
  assert.strictEqual(rateLimitResult.error, false);

  const serverErrorHarness = createClient([
    createHttpError(500),
    { status: 200, data: { data: { currentClub: { id: 1 } } } },
  ]);
  const serverErrorResult =
    await serverErrorHarness.client.executeSmartshellGraphQL({
      query: 'query { currentClub { id } }',
      token: 'token',
      retries: 1,
    });

  assert.strictEqual(serverErrorHarness.calls.length, 2);
  assert.strictEqual(serverErrorResult.error, false);

  const shapeHarness = createClient([{ status: 200, data: { ok: true } }]);
  const shapeResult = await shapeHarness.client.executeSmartshellGraphQL({
    query: 'query { currentClub { id } }',
    token: 'token',
  });

  assert.strictEqual(shapeResult.code, 'SMARTSHELL_UNEXPECTED_RESPONSE');
  assert.strictEqual(shapeResult.category, 'unexpected_response');

  const missingTokenHarness = createClient([]);
  const missingTokenResult =
    await missingTokenHarness.client.executeSmartshellGraphQL({
      query: 'query { currentClub { id } }',
    });

  assert.strictEqual(missingTokenHarness.calls.length, 0);
  assert.strictEqual(missingTokenResult.code, 'SMARTSHELL_TOKEN_MISSING');
  assert.strictEqual(missingTokenResult.category, 'credentials');

  console.log('smartshell api adapter smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
