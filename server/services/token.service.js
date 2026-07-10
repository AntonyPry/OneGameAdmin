const cron = require('node-cron');
const { Club } = require('../models'); // Подключаем модель для поиска всех клубов
const { executeSmartshellMutation } = require('../integrations/smartshell.api');
const { normalizeClubSettings } = require('../utils/clubSettings');
const {
  CredentialsEncryptionError,
  decryptCredential,
} = require('../utils/credentialsCrypto');

const tokenCache = {};
const errorCache = {};

const toPlainClub = (club) =>
  club?.get ? club.get({ plain: true }) : club || null;

const getClubValue = (club, key) => {
  if (!club) return undefined;
  if (club[key] !== undefined) return club[key];
  return typeof club.get === 'function' ? club.get(key) : undefined;
};

const normalizeDbClubId = (value) => {
  const parsedValue = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const resolveClub = async (clubOrId) => {
  const candidate = clubOrId?.club || clubOrId;
  const dbClubId =
    normalizeDbClubId(clubOrId?.dbClubId) ||
    normalizeDbClubId(getClubValue(candidate, 'id'));

  if (candidate && getClubValue(candidate, 'settings') !== undefined && dbClubId) {
    return candidate;
  }

  if (!dbClubId) return null;

  return Club.findByPk(dbClubId, {
    attributes: ['id', 'smartshell_id', 'settings'],
  });
};

const setTokenError = (dbClubId, payload) => {
  if (dbClubId) errorCache[dbClubId] = payload;
  return payload;
};

const getCredentialsError = (dbClubId, code, message, statusCode = 400) =>
  setTokenError(dbClubId, {
    error: true,
    code,
    message,
    statusCode,
  });

const decryptManagerPassword = (encryptedPassword, dbClubId) => {
  try {
    return decryptCredential(encryptedPassword);
  } catch (error) {
    if (error instanceof CredentialsEncryptionError) {
      const missingOrInvalidKey = [
        'CREDENTIALS_ENCRYPTION_KEY_MISSING',
        'CREDENTIALS_ENCRYPTION_KEY_TOO_SHORT',
      ].includes(error.code);

      return getCredentialsError(
        dbClubId,
        missingOrInvalidKey
          ? 'SMARTSHELL_CREDENTIALS_ENCRYPTION_KEY_MISSING'
          : 'SMARTSHELL_CREDENTIALS_DECRYPT_FAILED',
        missingOrInvalidKey
          ? 'Не настроен CREDENTIALS_ENCRYPTION_KEY для Smartshell credentials'
          : 'Не удалось расшифровать Smartshell manager password',
        500,
      );
    }

    throw error;
  }
};

const getManagerCredentials = async (clubOrId) => {
  const club = await resolveClub(clubOrId);

  if (!club) {
    return getCredentialsError(
      null,
      'SMARTSHELL_CLUB_NOT_FOUND',
      'Клуб для Smartshell credentials не найден',
      404,
    );
  }

  const plainClub = toPlainClub(club);
  const dbClubId = normalizeDbClubId(plainClub.id);
  const settings = normalizeClubSettings(plainClub.settings, plainClub);
  const {
    companyId: smartshellCompanyId,
    managerLogin,
    managerPasswordEncrypted,
  } = settings.smartshell;

  if (!smartshellCompanyId) {
    return getCredentialsError(
      dbClubId,
      'SMARTSHELL_COMPANY_ID_MISSING',
      'В настройках клуба не указан Smartshell company id',
    );
  }

  if (!managerLogin) {
    return getCredentialsError(
      dbClubId,
      'SMARTSHELL_MANAGER_LOGIN_MISSING',
      'В настройках клуба не указан Smartshell manager login',
    );
  }

  if (!managerPasswordEncrypted) {
    return getCredentialsError(
      dbClubId,
      'SMARTSHELL_MANAGER_PASSWORD_MISSING',
      'В настройках клуба не указан Smartshell manager password',
    );
  }

  const managerPassword = decryptManagerPassword(
    managerPasswordEncrypted,
    dbClubId,
  );

  if (managerPassword?.error) return managerPassword;

  return {
    error: false,
    dbClubId,
    smartshellCompanyId,
    managerLogin,
    managerPassword,
  };
};

const fetchNewManagerToken = async (clubOrId) => {
  const credentials = await getManagerCredentials(clubOrId);
  if (credentials.error) return credentials;

  const { dbClubId, smartshellCompanyId, managerLogin, managerPassword } =
    credentials;

  console.log(`Попытка получить токен Smartshell для club ${dbClubId}...`);

  const dataManagerLogin = {
    query: `mutation Login($login: String!, $password: String!, $companyId: Int!) {
      login(input: { login: $login, password: $password, company_id: $companyId }) {
        access_token
      }
    }`,
    variables: {
      login: managerLogin,
      password: managerPassword,
      companyId: smartshellCompanyId,
    },
  };

  try {
    const response = await executeSmartshellMutation(dataManagerLogin, {
      operationName: 'Login',
      clubId: dbClubId,
      requiresAuth: false,
    });

    if (response.error) {
      errorCache[dbClubId] = {
        ...response,
        error: true,
        code: response.code || 'SMARTSHELL_TOKEN_FETCH_FAILED',
        message:
          response.message || 'Внутренняя ошибка сервера при получении токена.',
        statusCode: response.statusCode || 502,
      };
      return errorCache[dbClubId];
    }

    const accessToken = response.data?.login?.access_token;
    if (typeof accessToken !== 'string' || !accessToken) {
      errorCache[dbClubId] = {
        error: true,
        code: 'SMARTSHELL_UNEXPECTED_RESPONSE',
        category: 'unexpected_response',
        message: 'Smartshell вернул неожиданный формат ответа авторизации',
        statusCode: 502,
        operationName: 'Login',
      };
      return errorCache[dbClubId];
    }

    console.log(`Токен Smartshell для club ${dbClubId} успешно закэширован.`);
    delete errorCache[dbClubId];
    return accessToken;
  } catch (error) {
    console.error(
      `TOKEN_FETCH_ERROR [club ${dbClubId}] ->`,
      error.message,
    );
    errorCache[dbClubId] = {
      error: true,
      code: 'SMARTSHELL_TOKEN_FETCH_FAILED',
      message: 'Внутренняя ошибка сервера при получении токена.',
      statusCode: 502,
    };
    return errorCache[dbClubId];
  }
};

const getManagerToken = async (clubOrId) => {
  const club = await resolveClub(clubOrId);
  const dbClubId = normalizeDbClubId(getClubValue(club, 'id'));

  if (!dbClubId) {
    return {
      error: true,
      code: 'SMARTSHELL_CLUB_NOT_FOUND',
      message: 'Клуб для Smartshell credentials не найден',
      statusCode: 404,
    };
  }

  // 1. Если токен есть в кэше для этого клуба — отдаем его
  if (tokenCache[dbClubId]) {
    return tokenCache[dbClubId];
  }

  // 2. Если кэш пуст — пытаемся получить немедленно
  console.warn(
    `Кэш пуст для club ${dbClubId}. Выполняется запрос по требованию...`,
  );
  const newToken = await fetchNewManagerToken(club);

  if (typeof newToken === 'string') {
    tokenCache[dbClubId] = newToken;
    return newToken;
  }

  // 3. Если и сейчас не вышло — отдаем ошибку
  return (
    errorCache[dbClubId] ||
    newToken || {
      error: true,
      message: 'Токен недоступен.',
    }
  );
};

const invalidateManagerToken = (clubOrId) => {
  const dbClubId = normalizeDbClubId(getClubValue(clubOrId, 'id')) ||
    normalizeDbClubId(clubOrId?.dbClubId) ||
    normalizeDbClubId(clubOrId);

  if (!dbClubId) return;

  delete tokenCache[dbClubId];
  delete errorCache[dbClubId];
};

// Функция для массового обновления токенов всех клубов
const refreshAllTokens = async () => {
  try {
    const clubs = await Club.findAll({
      attributes: ['id', 'smartshell_id', 'settings'],
    });

    if (clubs.length === 0) {
      console.log('В базе нет клубов для обновления токенов.');
      return;
    }

    for (const club of clubs) {
      const dbClubId = normalizeDbClubId(club.id);
      const token = await fetchNewManagerToken(club);
      if (typeof token === 'string') {
        tokenCache[dbClubId] = token;
      }
    }
  } catch (error) {
    console.error('Ошибка при массовом обновлении токенов:', error.message);
  }
};

const initializeTokenService = () => {
  cron.schedule('0 8,20 * * *', refreshAllTokens, {
    scheduled: true,
    timezone: 'Europe/Chisinau',
  });

  console.log('Инициализация SaaS сервиса токенов...');
  refreshAllTokens();
};

module.exports = {
  getManagerToken,
  invalidateManagerToken,
  initializeTokenService,
};
