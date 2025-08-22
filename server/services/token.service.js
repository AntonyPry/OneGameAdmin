const axios = require('axios');
const https = require('https');
const cron = require('node-cron');

// Мы используем переменную в памяти для кэширования токена.
// Это простое и эффективное решение для приложения с одним экземпляром.
let managerToken = null;
let lastError = null;

const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Эта функция содержит основную логику для получения токена.
 * Она вызывается только самим сервисом, а не контроллерами.
 */
const fetchNewManagerToken = async (clubId = 6816) => {
  console.log('Попытка получить новый токен Smartshell...');
  const dataManagerLogin = {
    query: `mutation Login {
      login(input: { login: "79216855543", password: "Toshka3g39!", company_id: ${clubId} }) {
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
      console.error('TOKEN_FETCH_ERROR ->', errorMessage);
      lastError = { error: true, message: `Не удалось получить токен от Smartshell: ${errorMessage}` };
      return null;
    } else {
      console.log('✅ Токен Smartshell успешно получен и закэширован.');
      lastError = null; // Очищаем последнюю ошибку при успехе
      return res.data.data.login.access_token;
    }
  } catch (error) {
    console.error('TOKEN_FETCH_AXIOS_ERROR ->', error.message);
    lastError = { error: true, message: 'Внутренняя ошибка сервера при получении токена.' };
    return null;
  }
};

/**
 * Это основная функция, которую будут использовать контроллеры.
 * Она возвращает кэшированный токен или пытается получить новый, если кэш пуст.
 */
const getManagerToken = async (clubId = 6816) => {
  if (managerToken) {
    return managerToken;
  }

  // Если токен отсутствует (например, при запуске сервера или после сбоя cron),
  // пытаемся получить его немедленно в качестве запасного варианта.
  console.warn('Кэшированный токен не найден. Выполняется запрос по требованию...');
  const newToken = await fetchNewManagerToken(clubId);
  if (newToken) {
    managerToken = newToken;
    return managerToken;
  }

  // Если получить новый токен не удалось, возвращаем последнюю известную ошибку.
  return lastError || { error: true, message: 'Токен недоступен.' };
};

/**
 * Задача, которую будет выполнять cron.
 */
const refreshTokenTask = async () => {
  const token = await fetchNewManagerToken();
  if (token) {
    managerToken = token;
  }
};

/**
 * Инициализация сервиса: запуск cron-задачи и первоначальное получение токена.
 */
const initializeTokenService = () => {
  // Запускаем задачу дважды в день: в 8:00 и 20:00.
  // '0 8,20 * * *' означает "в 0 минут, в 8 и 20 часов, каждый день".
  cron.schedule('0 8,20 * * *', refreshTokenTask, {
    scheduled: true,
    timezone: 'Europe/Chisinau', // Укажите ваш часовой пояс
  });

  // Также получаем токен один раз при запуске приложения,
  // чтобы не ждать первого запроса от пользователя.
  console.log('Инициализация сервиса токенов...');
  refreshTokenTask();
};

module.exports = {
  getManagerToken,
  initializeTokenService,
};
