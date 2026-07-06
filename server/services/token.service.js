const axios = require('axios');
const https = require('https');
const cron = require('node-cron');
const { Club } = require('../models'); // Подключаем модель для поиска всех клубов
const { getSmartshellCompanyId } = require('../utils/clubSettings');

// Cache is keyed by Smartshell company id, not by local DB Club.id.
const tokenCache = {};
const errorCache = {};

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const fetchNewManagerToken = async (smartshellCompanyId) => {
  if (!smartshellCompanyId) {
    console.error('fetchNewManagerToken: Не передан Smartshell company id');
    return null;
  }

  const login = process.env.SMARTSHELL_MANAGER_LOGIN;
  const password = process.env.SMARTSHELL_MANAGER_PASSWORD;

  if (!login || !password) {
    errorCache[smartshellCompanyId] = {
      error: true,
      message: 'Smartshell credentials are not configured.',
    };
    return null;
  }

  console.log(
    `Попытка получить токен Smartshell для company ${smartshellCompanyId}...`,
  );

  const dataManagerLogin = {
    query: `mutation Login {
      login(input: { login: ${JSON.stringify(login)}, password: ${JSON.stringify(password)}, company_id: ${smartshellCompanyId} }) {
        access_token
      }
    }`,
  };

  try {
    const res = await axios({
      method: 'post',
      url: `https://billing.smartshell.gg/api/graphql`,
      data: dataManagerLogin,
      httpsAgent: agent,
    });

    if (res.data.errors) {
      const errorMessage = res.data.errors.map((e) => e.message).join(', ');
      console.error(
        `TOKEN_FETCH_ERROR [Smartshell company ${smartshellCompanyId}] ->`,
        errorMessage,
      );
      errorCache[smartshellCompanyId] = {
        error: true,
        message: `Ошибка Smartshell: ${errorMessage}`,
      };
      return null;
    } else {
      console.log(
        `Токен Smartshell для company ${smartshellCompanyId} успешно закэширован.`,
      );
      delete errorCache[smartshellCompanyId];
      return res.data.data.login.access_token;
    }
  } catch (error) {
    console.error(
      `TOKEN_FETCH_AXIOS_ERROR [Smartshell company ${smartshellCompanyId}] ->`,
      error.message,
    );
    errorCache[smartshellCompanyId] = {
      error: true,
      message: 'Внутренняя ошибка сервера при получении токена.',
    };
    return null;
  }
};

const getManagerToken = async (smartshellCompanyId) => {
  // 1. Если токен есть в кэше для этого клуба — отдаем его
  if (tokenCache[smartshellCompanyId]) {
    return tokenCache[smartshellCompanyId];
  }

  // 2. Если кэш пуст — пытаемся получить немедленно
  console.warn(
    `Кэш пуст для Smartshell company ${smartshellCompanyId}. Выполняется запрос по требованию...`,
  );
  const newToken = await fetchNewManagerToken(smartshellCompanyId);

  if (newToken) {
    tokenCache[smartshellCompanyId] = newToken;
    return newToken;
  }

  // 3. Если и сейчас не вышло — отдаем ошибку
  return (
    errorCache[smartshellCompanyId] || {
      error: true,
      message: 'Токен недоступен.',
    }
  );
};

// Функция для массового обновления токенов всех клубов
const refreshAllTokens = async () => {
  try {
    const clubs = await Club.findAll({ attributes: ['smartshell_id', 'settings'] });

    if (clubs.length === 0) {
      console.log('В базе нет клубов для обновления токенов.');
      return;
    }

    for (const club of clubs) {
      const smartshellCompanyId = getSmartshellCompanyId(club);
      const token = await fetchNewManagerToken(smartshellCompanyId);
      if (token) {
        tokenCache[smartshellCompanyId] = token;
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
  initializeTokenService,
};
