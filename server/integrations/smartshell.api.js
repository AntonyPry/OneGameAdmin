'use strict';

// integrations/smartshell.api.js
const axios = require('axios');
const https = require('https');

const SMARTSHELL_GRAPHQL_URL = 'https://billing.smartshell.gg/api/graphql';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_READ_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInteger = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const getTimeoutMs = () =>
  parsePositiveInteger(process.env.SMARTSHELL_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);

const getReadRetries = () =>
  parseNonNegativeInteger(
    process.env.SMARTSHELL_API_READ_RETRIES,
    DEFAULT_READ_RETRIES,
  );

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSmartshellOperationType = (query) => {
  if (typeof query !== 'string') return null;

  const trimmedQuery = query.trim();
  const explicitOperation = trimmedQuery.match(
    /^(query|mutation|subscription)\b/i,
  );

  if (explicitOperation) return explicitOperation[1].toLowerCase();
  if (trimmedQuery.startsWith('{')) return 'query';
  return null;
};

const getSmartshellOperationName = (query) => {
  if (typeof query !== 'string') return 'UnknownOperation';

  const trimmedQuery = query.trim();
  const namedOperation = trimmedQuery.match(
    /^(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)\b/i,
  );

  if (namedOperation) return namedOperation[1];

  const rootField = trimmedQuery.match(/\{\s*([A-Za-z_][A-Za-z0-9_]*)\b/);
  return rootField ? rootField[1] : 'UnknownOperation';
};

const getHeaderValue = (headers = {}, names = []) => {
  for (const name of names) {
    if (headers[name] !== undefined) return headers[name];
    const lowerName = name.toLowerCase();
    if (headers[lowerName] !== undefined) return headers[lowerName];
  }

  return null;
};

const safeString = (value, maxLength = 200) => {
  if (value === null || value === undefined) return null;
  const stringValue = String(value);
  return stringValue.length > maxLength
    ? `${stringValue.slice(0, maxLength)}...`
    : stringValue;
};

const extractSmartshellTraceId = (source = {}) => {
  const response = source.response || source;
  const headerTraceId = getHeaderValue(response.headers || {}, [
    'x-request-id',
    'x-trace-id',
    'x-correlation-id',
    'traceparent',
    'cf-ray',
  ]);

  if (headerTraceId) return safeString(headerTraceId);

  const data = response.data || source.data || {};
  const extensionTraceId =
    data.extensions?.traceId ||
    data.extensions?.requestId ||
    data.extensions?.request_id;

  if (extensionTraceId) return safeString(extensionTraceId);

  const graphQLErrors = data.errors || [];
  const errorTraceId = graphQLErrors.find(
    (error) => error?.extensions?.traceId || error?.extensions?.requestId,
  );

  return safeString(
    errorTraceId?.extensions?.traceId || errorTraceId?.extensions?.requestId,
  );
};

const getGraphQLErrorCode = (error = {}) =>
  error.extensions?.code ||
  error.extensions?.status ||
  error.extensions?.statusCode ||
  error.code ||
  error.status ||
  null;

const getGraphQLErrorCodes = (errors = []) =>
  Array.from(
    new Set(
      errors
        .map((error) => safeString(getGraphQLErrorCode(error), 80))
        .filter(Boolean),
    ),
  );

const hasPermissionError = (errors = []) =>
  errors.some((error) => {
    const code = String(getGraphQLErrorCode(error) || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();

    return (
      ['401', '403', 'UNAUTHENTICATED', 'FORBIDDEN'].includes(code) ||
      message.includes('not permitted') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    );
  });

const isLoginOperation = (operationName) =>
  String(operationName || '').toLowerCase() === 'login';

const createSmartshellError = ({
  code,
  category,
  message,
  statusCode = 502,
  upstreamStatus,
  operationName,
  operationType,
  traceId,
  retryable = false,
  graphQLErrorCodes,
}) => {
  const error = {
    error: true,
    code,
    category,
    message,
    statusCode,
    operationName,
    operationType,
    retryable,
  };

  if (upstreamStatus) error.upstreamStatus = upstreamStatus;
  if (traceId) error.traceId = traceId;
  if (graphQLErrorCodes?.length) {
    error.graphQLErrorCodes = graphQLErrorCodes;
  }

  return error;
};

const normalizeGraphQLErrors = ({
  errors,
  operationName,
  operationType,
  traceId,
}) => {
  const graphQLErrorCodes = getGraphQLErrorCodes(errors);

  if (isLoginOperation(operationName)) {
    return createSmartshellError({
      code: 'SMARTSHELL_CREDENTIALS_REJECTED',
      category: 'credentials',
      message: 'Smartshell отклонил credentials менеджера',
      statusCode: 502,
      operationName,
      operationType,
      traceId,
      graphQLErrorCodes,
    });
  }

  if (hasPermissionError(errors)) {
    return createSmartshellError({
      code: 'SMARTSHELL_PERMISSION_DENIED',
      category: 'permission',
      message: 'Недостаточно прав для запроса к Smartshell',
      statusCode: 502,
      upstreamStatus: 403,
      operationName,
      operationType,
      traceId,
      graphQLErrorCodes,
    });
  }

  return createSmartshellError({
    code: 'SMARTSHELL_GRAPHQL_ERROR',
    category: 'graphql',
    message: 'Smartshell вернул ошибку GraphQL',
    statusCode: 502,
    operationName,
    operationType,
    traceId,
    graphQLErrorCodes,
  });
};

const normalizeHttpError = ({
  error,
  operationName,
  operationType,
  traceId,
  retryable,
}) => {
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return createSmartshellError({
      code: 'SMARTSHELL_TIMEOUT',
      category: 'timeout',
      message: 'Истек timeout запроса к Smartshell',
      statusCode: 504,
      operationName,
      operationType,
      traceId,
      retryable,
    });
  }

  const upstreamStatus = error.response?.status;
  const responseErrors = error.response?.data?.errors;
  if (Array.isArray(responseErrors) && responseErrors.length) {
    return normalizeGraphQLErrors({
      errors: responseErrors,
      operationName,
      operationType,
      traceId,
    });
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return createSmartshellError({
      code: isLoginOperation(operationName)
        ? 'SMARTSHELL_CREDENTIALS_REJECTED'
        : 'SMARTSHELL_PERMISSION_DENIED',
      category: isLoginOperation(operationName) ? 'credentials' : 'permission',
      message: isLoginOperation(operationName)
        ? 'Smartshell отклонил credentials менеджера'
        : 'Недостаточно прав для запроса к Smartshell',
      statusCode: 502,
      upstreamStatus,
      operationName,
      operationType,
      traceId,
      retryable: false,
    });
  }

  if (!error.response) {
    return createSmartshellError({
      code: 'SMARTSHELL_NETWORK_ERROR',
      category: 'network',
      message: 'Сетевая ошибка при запросе к Smartshell',
      statusCode: 502,
      operationName,
      operationType,
      traceId,
      retryable,
    });
  }

  return createSmartshellError({
    code: 'SMARTSHELL_HTTP_ERROR',
    category: 'network',
    message: 'Smartshell вернул HTTP ошибку',
    statusCode: upstreamStatus >= 500 || upstreamStatus === 429 ? 502 : 502,
    upstreamStatus,
    operationName,
    operationType,
    traceId,
    retryable: retryable && isRetryableHttpStatus(upstreamStatus),
  });
};

const normalizeUnexpectedResponse = ({
  operationName,
  operationType,
  traceId,
}) =>
  createSmartshellError({
    code: 'SMARTSHELL_UNEXPECTED_RESPONSE',
    category: 'unexpected_response',
    message: 'Smartshell вернул неожиданный формат ответа',
    statusCode: 502,
    operationName,
    operationType,
    traceId,
  });

const getLogPayload = ({
  event = 'smartshell.graphql.request',
  operationName,
  operationType,
  clubId,
  status,
  durationMs,
  traceId,
  attempt,
  maxAttempts,
  code,
  category,
  upstreamStatus,
}) => {
  const payload = {
    event,
    operationName,
    operationType,
    status,
    durationMs,
  };

  if (clubId !== undefined && clubId !== null) payload.clubId = clubId;
  if (traceId) payload.traceId = traceId;
  if (attempt) payload.attempt = attempt;
  if (maxAttempts) payload.maxAttempts = maxAttempts;
  if (code) payload.code = code;
  if (category) payload.category = category;
  if (upstreamStatus) payload.upstreamStatus = upstreamStatus;

  return payload;
};

const logRequest = (logger, level, payload) => {
  const targetLogger = logger || console;
  const log = targetLogger[level] || targetLogger.log || console.log;
  log.call(targetLogger, 'smartshell.graphql', getLogPayload(payload));
};

const shouldRetryError = (error) =>
  ['timeout', 'network'].includes(error.category) &&
  error.code !== 'SMARTSHELL_PERMISSION_DENIED' &&
  error.code !== 'SMARTSHELL_CREDENTIALS_REJECTED';

const isRetryableHttpStatus = (status) =>
  status === 408 || status === 429 || (status >= 500 && status <= 599);

const createSmartshellGraphQLClient = ({
  httpClient = axios,
  logger = console,
  sleep = wait,
} = {}) => {
  const executeSmartshellGraphQL = async ({
    query,
    variables,
    token,
    operationName,
    operationType,
    readOnly,
    requiresAuth,
    clubId,
    timeoutMs,
    retries,
  } = {}) => {
    const resolvedOperationType =
      operationType || getSmartshellOperationType(query) || 'query';
    const resolvedOperationName =
      operationName || getSmartshellOperationName(query);
    const isReadOnlyQuery =
      resolvedOperationType === 'query' && readOnly !== false;
    const maxRetries = isReadOnlyQuery
      ? parseNonNegativeInteger(retries, getReadRetries())
      : 0;
    const maxAttempts = maxRetries + 1;
    const requestTimeoutMs = parsePositiveInteger(timeoutMs, getTimeoutMs());
    const authRequired =
      requiresAuth === undefined ? resolvedOperationType === 'query' : requiresAuth;

    if (typeof query !== 'string' || !query.trim()) {
      return normalizeUnexpectedResponse({
        operationName: resolvedOperationName,
        operationType: resolvedOperationType,
      });
    }

    if (authRequired && !token) {
      return createSmartshellError({
        code: 'SMARTSHELL_TOKEN_MISSING',
        category: 'credentials',
        message: 'Не удалось получить токен Smartshell',
        statusCode: 502,
        operationName: resolvedOperationName,
        operationType: resolvedOperationType,
      });
    }

    const requestData = { query };
    if (variables !== undefined) requestData.variables = variables;

    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = Date.now();
      let normalizedError = null;

      try {
        const response = await httpClient({
          method: 'post',
          url: SMARTSHELL_GRAPHQL_URL,
          data: requestData,
          headers,
          timeout: requestTimeoutMs,
          httpsAgent: agent,
        });

        const durationMs = Date.now() - startedAt;
        const traceId = extractSmartshellTraceId(response);

        if (!response.data || typeof response.data !== 'object') {
          normalizedError = normalizeUnexpectedResponse({
            operationName: resolvedOperationName,
            operationType: resolvedOperationType,
            traceId,
          });
        } else if (
          Array.isArray(response.data.errors) &&
          response.data.errors.length
        ) {
          normalizedError = normalizeGraphQLErrors({
            errors: response.data.errors,
            operationName: resolvedOperationName,
            operationType: resolvedOperationType,
            traceId,
          });
        } else if (!Object.prototype.hasOwnProperty.call(response.data, 'data')) {
          normalizedError = normalizeUnexpectedResponse({
            operationName: resolvedOperationName,
            operationType: resolvedOperationType,
            traceId,
          });
        } else {
          logRequest(logger, 'info', {
            operationName: resolvedOperationName,
            operationType: resolvedOperationType,
            clubId,
            status: 'ok',
            durationMs,
            traceId,
            attempt,
            maxAttempts,
          });

          return {
            error: false,
            data: response.data.data,
            operationName: resolvedOperationName,
            traceId,
          };
        }

        normalizedError.retryable =
          isReadOnlyQuery && shouldRetryError(normalizedError);
        normalizedError.durationMs = durationMs;
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const traceId = extractSmartshellTraceId(error);

        normalizedError = normalizeHttpError({
          error,
          operationName: resolvedOperationName,
          operationType: resolvedOperationType,
          traceId,
          retryable: isReadOnlyQuery,
        });
        normalizedError.durationMs = durationMs;
      }

      if (
        isReadOnlyQuery &&
        normalizedError.retryable &&
        shouldRetryError(normalizedError) &&
        attempt < maxAttempts
      ) {
        logRequest(logger, 'warn', {
          operationName: resolvedOperationName,
          operationType: resolvedOperationType,
          clubId,
          status: 'retry',
          durationMs: normalizedError.durationMs,
          traceId: normalizedError.traceId,
          attempt,
          maxAttempts,
          code: normalizedError.code,
          category: normalizedError.category,
          upstreamStatus: normalizedError.upstreamStatus,
        });

        await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
        continue;
      }

      logRequest(logger, 'error', {
        operationName: resolvedOperationName,
        operationType: resolvedOperationType,
        clubId,
        status: 'error',
        durationMs: normalizedError.durationMs,
        traceId: normalizedError.traceId,
        attempt,
        maxAttempts,
        code: normalizedError.code,
        category: normalizedError.category,
        upstreamStatus: normalizedError.upstreamStatus,
      });

      delete normalizedError.durationMs;
      return normalizedError;
    }

    return normalizeUnexpectedResponse({
      operationName: resolvedOperationName,
      operationType: resolvedOperationType,
    });
  };

  return {
    executeSmartshellGraphQL,
  };
};

const defaultClient = createSmartshellGraphQLClient();

const executeSmartshellGraphQL = (requestOptions) =>
  defaultClient.executeSmartshellGraphQL(requestOptions);

const executeSmartshellQuery = (queryData, token, options = {}) =>
  executeSmartshellGraphQL({
    ...queryData,
    ...options,
    token,
    operationType: 'query',
    readOnly: true,
  });

const executeSmartshellMutation = (queryData, options = {}) =>
  executeSmartshellGraphQL({
    ...queryData,
    ...options,
    operationType: 'mutation',
    readOnly: false,
    retries: 0,
    requiresAuth: options.requiresAuth ?? queryData.requiresAuth ?? false,
  });

module.exports = {
  executeSmartshellGraphQL,
  executeSmartshellQuery,
  executeSmartshellMutation,
  getSmartshellOperationName,
  getSmartshellOperationType,
  extractSmartshellTraceId,
  __testing: {
    createSmartshellGraphQLClient,
    normalizeGraphQLErrors,
    normalizeHttpError,
    normalizeUnexpectedResponse,
  },
};
