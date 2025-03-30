// controllers/admin.controller.js
const axios = require('axios');
const https = require('https');
const { FOOD, CHOCOLATE, DRINKS } = require('../consts/paymentTitles');
const { ADMIN_MONTH_PLAN } = require('../consts/adminMonthPlan');
const { getResultsArray, getSmartshellManagerBearer } = require('./payments.controller');

const agent = new https.Agent({
  rejectUnauthorized: false, // Отключает проверку сертификата
});

const currentStats = async (req, res) => {
  try {
    let { startDate, endDate, clubId } = req.query;
    if (!clubId) clubId = 6816;

    const smena = startDate.split(' ')[1].split(':')[0] === '09' ? 'day' : 'night';
    const planStatsObject = ADMIN_MONTH_PLAN[endDate.split(' ')[0]][smena];

    const resultsArray = await getResultsArray(startDate, endDate, clubId);

    const currentStatsObject = {
      totalRevenue: 0, // общая выручка
      foodRevenue: 0, // выручка за всю еду без шоколада
      chocolateRevenue: 0, // выручка за шоколад
      drinksRevenue: 0, // выручка за напитки
      PsServiceAutosimRevenue: 0, // выручка за PS5 + услуги + автосимулятор
      PCRevenue: 0, // выручка за ПК
    };

    for (let i = 0; i < resultsArray.length; i++) {
      const { type, title, sum, payment_title } = resultsArray[i];
      if (
        (type === 'TARIFF' && title === 'Пополнение по СБП' && payment_title === 'СБП') ||
        (type === 'TARIFF' && payment_title === 'CARD') ||
        (type === 'TARIFF' && payment_title === 'CASH') ||
        type === 'GOOD' ||
        type === 'SERVICE' ||
        type === 'PS'
      ) {
        currentStatsObject.totalRevenue += sum;
      }
      if (FOOD.includes(title) || FOOD.map((el) => 'Отмена ' + el).includes(title)) {
        currentStatsObject.foodRevenue += sum;
      }
      if (CHOCOLATE.includes(title) || CHOCOLATE.map((el) => 'Отмена ' + el).includes(title)) {
        currentStatsObject.chocolateRevenue += sum;
      }
      if (DRINKS.includes(title) || DRINKS.map((el) => 'Отмена ' + el).includes(title)) {
        currentStatsObject.drinksRevenue += sum;
      }
      if (type === 'PS' || type === 'SERVICE' || title === 'Кресло 30мин Будни' || title === 'Кресло 30мин Выходные') {
        currentStatsObject.PsServiceAutosimRevenue += sum;
      }
      if (
        (type === 'TARIFF' && title === 'Пополнение по СБП' && payment_title === 'СБП') ||
        (type === 'TARIFF' && payment_title === 'CARD') ||
        (type === 'TARIFF' && payment_title === 'CASH')
      ) {
        currentStatsObject.PCRevenue += sum;
      }
    }

    const currentAwardsObject = getCurrentAwardsObject(endDate, smena, currentStatsObject, planStatsObject);

    const currentWorkshift = await getActiveWorkshiftStartDate(clubId);

    return res.status(200).send({ currentStatsObject, planStatsObject, currentAwardsObject, currentWorkshift });
  } catch (error) {
    console.log('currentStats ERROR ->', error);
    return res.status(500).send({ error: true, message: error.message });
  }
};

const getCurrentAwardsObject = (endDate, smena, currentStatsObject, planStatsObject) => {
  // Определяем день недели по endDate (0 – воскресенье, 1 – понедельник и т.д.)
  const dayOfWeek = new Date(endDate).getDay();

  // Базовый оклад зависит от смены
  const baseSalary = smena === 'day' ? 1200 : 1400;

  // Выручка по товарам: еда (без шоколада) + шоколад + напитки
  const currentGoodsRevenue =
    currentStatsObject.foodRevenue + currentStatsObject.chocolateRevenue + currentStatsObject.drinksRevenue;
  const planGoodsRevenue =
    planStatsObject.foodRevenue + planStatsObject.chocolateRevenue + planStatsObject.drinksRevenue;

  // Расчёт премии за товары
  let goodsBonus = 0;
  // Если выполнен план по товарам (сравнение с планом, например, goodsTarget)
  if (currentGoodsRevenue >= planGoodsRevenue) {
    // Если выручка по товарам больше 10000 и смена проходит с понедельника по четверг (1–4)
    if (currentGoodsRevenue > 10000 && dayOfWeek >= 1 && dayOfWeek <= 4) {
      goodsBonus = currentGoodsRevenue * 0.2;
    } else {
      goodsBonus = currentGoodsRevenue * 0.1;
    }
  }

  // Расчёт премии по PS5 + услуги + автосимулятор
  let psBonus = 0;
  if (currentStatsObject.PSRevenue >= planStatsObject.PSRevenue) {
    psBonus = currentStatsObject.PSRevenue * 0.1;
  }

  // Формируем awardObject
  const currentAwardsObject = {
    baseSalary, // гарантированный оклад
    goodsBonus, // премия за товары
    psBonus, // премия за PS5 + услуги + автосимулятор
    totalAward: baseSalary + goodsBonus + psBonus + 500, // суммарное вознаграждение + фиксированное за доп обязанности
  };

  return currentAwardsObject;
};

const getActiveWorkshiftStartDate = async (clubId) => {
  const managerBearer = await getSmartshellManagerBearer(clubId);
  if (managerBearer.error) {
    console.log(`Ошибка при получении менеджерского токена для клуба ${clubId}:`, managerBearer.message);
    return res.status(400).send(managerBearer);
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

module.exports = {
  currentStats,
};
