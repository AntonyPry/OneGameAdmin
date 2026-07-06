// integrations/smartshell.api.js
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const executeSmartshellQuery = async (queryData, token) => {
  try {
    const res = await axios({
      method: 'post',
      url: `https://billing.smartshell.gg/api/graphql`,
      data: queryData,
      headers: {
        authorization: `Bearer ${token}`,
      },
      httpsAgent: agent,
    });

    if (res.data.errors) {
      res.data.errors.forEach((error) =>
        console.log('Smartshell API ERROR ->', error.message),
      );
      return {
        error: true,
        message: 'Не удалось получить данные от smartshell',
      };
    }

    return { error: false, data: res.data.data };
  } catch (error) {
    console.log('Smartshell Network ERROR ->', error.message);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

module.exports = {
  executeSmartshellQuery,
};
