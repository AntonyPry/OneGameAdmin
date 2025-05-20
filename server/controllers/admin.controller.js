// controllers/admin.controller.js
const axios = require('axios');
const https = require('https');
const { ADMIN_MONTH_PLAN } = require('../consts/adminMonthPlan');
const { getResultsArray, getSmartshellManagerBearer } = require('./payments.controller');

const agent = new https.Agent({
  rejectUnauthorized: false, // Отключает проверку сертификата
});

const formatDate = (date) => {
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
};

const currentStats = async (req, res) => {
  try {
    let { startDate, endDate, clubId } = req.query;
    if (!clubId) clubId = 6816;

    const smena = endDate.split(' ')[1].split(':')[0] === '09' ? 'night' : 'day';
    const planStatsObject = ADMIN_MONTH_PLAN[endDate.split(' ')[0]]
      ? ADMIN_MONTH_PLAN[endDate.split(' ')[0]][smena]
      : {
          totalRevenue: 0, // общая выручка
          foodRevenue: 0, // выручка за всю еду без шоколада
          chocolateRevenue: 0, // выручка за шоколад
          drinksRevenue: 0, // выручка за напитки
          psServiceRevenue: 0, // выручка за PS5 + услуги
          pcRevenue: 0,
        };

    // получаем данные строго с 9 до 9, а оклад с начала смены до ее конца, поэтому по времени начала работы ищем время начала смены (строгое)
    const createdAt = new Date(startDate.replace(' ', 'T') + '+03:00');
    const hours = createdAt.getHours();

    let startSmena;
    const start = new Date(createdAt);
    if (hours >= 6 && hours < 9) {
      start.setHours(9, 0, 0, 0);
    } else if (hours >= 18 && hours < 21) {
      start.setHours(21, 0, 0, 0);
    }
    startSmena = formatDate(start);

    // получаем данные с начла СМЕНЫ (а не работы) до конца смены (считается на фронте)
    const resultsArray = await getResultsArray(startSmena, endDate, clubId);

    const currentStatsObject = {
      totalRevenue: 0, // общая выручка
      goodsRevenue: 0, // выручка за все продукты
      psServiceRevenue: 0, // выручка за PS5 + услуги
      pcRevenue: 0, // выручка за ПК
    };

    for (let i = 0; i < resultsArray.length; i++) {
      const { type, title, sum, payment_title } = resultsArray[i];
      if (
        payment_title === 'СБП' ||
        (type === 'TARIFF' && payment_title === 'CARD') ||
        (type === 'TARIFF' && payment_title === 'CASH') ||
        (type === 'TARIFF' && payment_title === 'COMPOSITE') ||
        type === 'GOOD' ||
        type === 'SERVICE' ||
        type === 'PS'
      ) {
        currentStatsObject.totalRevenue += sum;
      }
      if (type === 'GOOD') {
        currentStatsObject.goodsRevenue += sum;
      }
      if (type === 'PS' || type === 'SERVICE') {
        currentStatsObject.psServiceRevenue += sum;
      }
      if (
        (type === 'TARIFF' && title === 'Пополнение по СБП' && payment_title === 'СБП') ||
        (type === 'TARIFF' && payment_title === 'CARD') ||
        (type === 'TARIFF' && payment_title === 'CASH')
      ) {
        currentStatsObject.pcRevenue += sum;
      }
    }

    const managerComment = await getManagerComment(clubId);
    const responsibilitiesCheck = getResponsibilitiesCheck(await getActiveWorkshiftStartDate(clubId), managerComment);

    const currentAwardsObject = await getCurrentAwardsObject(
      endDate,
      smena,
      currentStatsObject,
      planStatsObject,
      responsibilitiesCheck
    );

    return res.status(200).send({ currentStatsObject, planStatsObject, currentAwardsObject });
  } catch (error) {
    console.log('currentStats ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const getCurrentAwardsObject = async (endDate, smena, currentStatsObject, planStatsObject, checkedResponsibilities) => {
  const workshiftStart = await getActiveWorkshiftStartDate();
  if (workshiftStart.error) {
    console.log(`getCurrentAwardsObject ERROR ->`, workshiftStart.message);
    return { workshiftStart };
  }

  // Рассчитываем проработанное время в минутах
  const startTime = new Date(workshiftStart.created_at.replace(' ', 'T') + '+03:00');
  const endTime = new Date();
  const workedMinutes = Math.floor((endTime - startTime) / 1000 / 60);

  // Коэффициенты для расчета оклада
  const DAY_RATE_PER_MINUTE = 1.6;
  const NIGHT_RATE_PER_MINUTE = 1.9;

  // Рассчитываем базовый оклад на основе проработанного времени
  let baseSalary;
  if (smena === 'day') {
    baseSalary = Math.floor(DAY_RATE_PER_MINUTE * workedMinutes);
  } else {
    baseSalary = Math.floor(NIGHT_RATE_PER_MINUTE * workedMinutes);
  }

  const currentGoodsRevenue = currentStatsObject.goodsRevenue;
  const planGoodsRevenue =
    planStatsObject.foodRevenue + planStatsObject.chocolateRevenue + planStatsObject.drinksRevenue;

  let goodsBonus = 0;
  if (currentGoodsRevenue >= planGoodsRevenue) {
    goodsBonus = currentGoodsRevenue * 0.05;
  }

  let psBonus = 0;
  if (currentStatsObject.psServiceRevenue >= planStatsObject.psServiceRevenue) {
    psBonus = currentStatsObject.psServiceRevenue * 0.1;
  }

  let pcBonus = 0;
  if (currentStatsObject.pcRevenue >= planStatsObject.pcRevenue) {
    pcBonus = currentStatsObject.pcRevenue * 0.03;
  }

  let additionalBonus = 0;
  if (checkedResponsibilities?.status === 'ok') {
    additionalBonus = 500;
  }

  const currentAwardsObject = {
    baseSalary,
    goodsBonus,
    psBonus,
    pcBonus,
    additionalBonus,
    totalAward: baseSalary + goodsBonus + psBonus + additionalBonus,
    responsibilitiesCheck: checkedResponsibilities,
  };

  return currentAwardsObject;
};

const getActiveWorkshift = async (req, res) => {
  let { clubId } = req.query;
  if (!clubId) clubId = 6816;
  const currentWorkshift = await getActiveWorkshiftStartDate(clubId);
  if (currentWorkshift?.error || !currentWorkshift) {
    console.log('getActiveWorkshift ERROR ->', currentWorkshift.message);
    return res.status(400).send({ currentWorkshift });
  }
  const managerComment = await getManagerComment(clubId);
  if (managerComment.error) {
    console.log('getActiveWorkshift ERROR ->', managerComment.message);
    return res.status(400).send({ managerComment });
  }

  return res.status(200).send({ currentWorkshift, managerComment });
};

const getActiveWorkshiftStartDate = async (clubId = 6816) => {
  const managerBearer = await getSmartshellManagerBearer(clubId);
  if (managerBearer.error) {
    console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
    return { managerBearer };
  }

  const dataActiveWorkshift = {
    query: `query ActiveWorkShift {
                activeWorkShift {
                    comment
                    created_at
                    worker {
                      last_name
                      first_name
                  }
                }
            }`,
  };

  try {
    const res = await axios({
      method: 'post',
      url: `https://billing.smartshell.gg/api/graphql`,
      data: dataActiveWorkshift,
      headers: {
        authorization: `Bearer ${managerBearer}`,
      },
      httpsAgent: agent,
    });

    if (res.data.errors) {
      res.data.errors.map((error) => console.log('getActiveWorkshiftStartDate ERROR ->', error.message));
      return { error: true, message: 'Не удалось получить данные от smartshell' };
    } else {
      return res.data.data.activeWorkShift;
    }
  } catch (error) {
    console.log('getActiveWorkshiftStartDate ERROR ->', error.message);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};
const getManagerComment = async (clubId = 6816) => {
  const managerBearer = await getSmartshellManagerBearer(clubId);
  if (managerBearer.error) {
    console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
    return { managerBearer };
  }

  const dataManagerComment = {
    query: `query Comments {
                comments(input: { entity_id: 1372015, type: CLIENT }, page: 1, first: 1) {
                    data {
                        text
                    }
                }
            }`,
  };

  try {
    const res = await axios({
      method: 'post',
      url: `https://billing.smartshell.gg/api/graphql`,
      data: dataManagerComment,
      headers: {
        authorization: `Bearer ${managerBearer}`,
      },
      httpsAgent: agent,
    });

    if (res.data.errors) {
      res.data.errors.map((error) => console.log('getManagerComment ERROR ->', error.message));
      return { error: true, message: 'Не удалось получить данные от smartshell' };
    } else {
      return res.data.data.comments.data[0].text;
    }
  } catch (error) {
    console.log('getManagerComment ERROR ->', error.message);
    return { error: true, message: 'Ошибка на стороне сервера' };
  }
};

const responsibilityOrder = [
  'clubCleanliness',
  'kitchenCleanliness',
  'quickVkAnswers',
  'quickPhoneAnswers',
  'workspaceCleanliness',
  'noStrangersNearTheWorkspace',
  'clubClimateControl',
  'refrigeratorOccupancy',
  'foulLanguage',
];

const getResponsibilitiesCheck = (workshiftStart, managerComment) => {
  if (!managerComment) {
    return { status: 'notChecked', notPassed: [], alreadyChecked: false };
  }

  const parts = managerComment.split(' ');
  const commentDate = parts[0] + ' ' + parts[1];

  if (!commentDate || (!managerComment.includes('0') && !managerComment.includes('1'))) {
    return { status: 'notChecked', notPassed: [], alreadyChecked: false };
  }

  const matchesDate = commentDate === workshiftStart.created_at;
  const bitString = parts[2] || '';
  const notPassed = [];

  for (let i = 0; i < responsibilityOrder.length; i++) {
    if (bitString[i] === '0') {
      notPassed.push(responsibilityOrder[i]);
    }
  }

  return {
    alreadyChecked: matchesDate,
    status: !matchesDate ? 'notChecked' : notPassed.length ? 'fail' : 'ok',
    notPassed,
  };
};

const approveAdminResponsibilities = async (req, res) => {
  const { password, adminResponsibilities } = req.body;

  if (password !== 'timuradminpassword07896') {
    return res.status(400).send({ error: true, message: 'Неверный пароль' });
  }

  const managerBearer = await getSmartshellManagerBearer();
  if (managerBearer.error) {
    console.log('Ошибка при получении токена:', managerBearer.message);
    return res.status(400).send({ error: true, message: 'Ошибка при получении менеджерского токена' });
  }

  const currentWorkshift = await getActiveWorkshiftStartDate();
  if (currentWorkshift.error) {
    console.log('Ошибка при получении смены:', currentWorkshift.message);
    return res.status(400).send({ error: true, message: 'Не удалось получить активную смену' });
  }

  // Фиксированный порядок обязанностей:
  const responsibilityOrder = [
    'clubCleanliness',
    'kitchenCleanliness',
    'quickVkAnswers',
    'quickPhoneAnswers',
    'workspaceCleanliness',
    'noStrangersNearTheWorkspace',
    'clubClimateControl',
    'refrigeratorOccupancy',
    'foulLanguage',
  ];

  // Формируем строку "010110..."
  const responsibilitiesBits = responsibilityOrder.map((key) => (adminResponsibilities[key] ? '1' : '0')).join('');

  const commentText = `${currentWorkshift.created_at} ${responsibilitiesBits}`;
  const dataComment = {
    query: `mutation CreateComment {
      createComment(input: { entity_id: 1372015, text: "${commentText}", type: CLIENT }) {
        id
      }
    }`,
  };

  try {
    const response = await axios({
      method: 'post',
      url: `https://billing.smartshell.gg/api/graphql`,
      data: dataComment,
      headers: {
        authorization: `Bearer ${managerBearer}`,
      },
      httpsAgent: agent,
    });

    if (response.data.errors) {
      response.data.errors.map((error) => console.log('approveAdminResponsibilities ERROR ->', error.message));
      return res.status(400).send({ error: true, message: 'Не удалось сохранить комментарий' });
    }

    return res.status(200).send({ error: false, message: 'Обязанности успешно подтверждены' });
  } catch (error) {
    console.log('approveAdminResponsibilities ERROR ->', error.message);
    return res.status(400).send({ error: true, message: 'Ошибка на стороне сервера' });
  }
};

module.exports = {
  currentStats,
  getActiveWorkshift,
  approveAdminResponsibilities,
};
