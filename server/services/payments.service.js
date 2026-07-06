// services/payments.service.js
const { executeSmartshellQuery } = require('../integrations/smartshell.api');
const { getManagerToken } = require('./token.service');

const makeIdForSort = (timestamp) =>
  parseInt(
    timestamp.split(' ')[0].split('-').join('') +
      timestamp.split(' ')[1].split(':').join(''),
  );
const parseDate = (timestamp) =>
  `${timestamp.split(' ')[0].split('-')[2]}.${timestamp.split(' ')[0].split('-')[1]}.${timestamp.split(' ')[0].split('-')[0]}`;
const parseTime = (timestamp) => timestamp.split(' ')[1];
const formatOperator = (operator) =>
  operator ? `${operator.first_name} ${operator.last_name}` : '';
const getPaymentItemType = (item = {}) => {
  if (['GOOD', 'SERVICE', 'PS'].includes(item.entity_type)) {
    return item.entity_type;
  }

  if (item?.title?.includes('PS')) return 'PS';
  if (item?.title?.includes('Кресло')) return 'RACEZONE';

  return item.entity_type || 'TARIFF';
};

const fetchPaginatedData = async (
  queryFactory,
  managerBearer,
  dataPath = 'eventList',
) => {
  let page = 1;
  let allData = [];
  let hasMorePages = true;

  while (hasMorePages) {
    const query = queryFactory(page);
    const response = await executeSmartshellQuery({ query }, managerBearer);

    if (response.error) {
      console.error(
        `fetchPaginatedData ERROR on page ${page}:`,
        response.message,
      );
      return {
        error: true,
        message: 'Ошибка при получении данных от Smartshell',
      };
    }

    const rootData = response.data[dataPath];
    if (!rootData || !rootData.data) break;

    allData.push(...rootData.data);

    if (rootData.paginatorInfo.lastPage) {
      hasMorePages = rootData.paginatorInfo.lastPage > page;
    } else if (rootData.paginatorInfo.hasMorePages !== undefined) {
      hasMorePages = rootData.paginatorInfo.hasMorePages;
    } else {
      hasMorePages = false;
    }
    page++;
  }

  return { error: false, result: allData };
};

const getPaymentData = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    eventList(input: { start: "${startDate}", finish: "${endDate}", types: "PAYMENT_CREATED" }, first: 1000, page: ${page}) {
      paginatorInfo { count currentPage lastPage }
      data {
        type timestamp client { phone nickname }
        payment { id value title }
        payment_items { title amount sum entity_type }
        value1 operator { first_name last_name }
      }
    }
  }`;

  const res = await fetchPaginatedData(queryFactory, managerBearer);
  if (res.error) return res;

  const result = [];
  res.result.forEach((payment) => {
    payment.payment_items.forEach((item) => {
      result.push({
        timestamp: payment.timestamp,
        idForSort: makeIdForSort(payment.timestamp),
        id: payment.payment.id,
        type: getPaymentItemType(item),
        date: parseDate(payment.timestamp),
        time: parseTime(payment.timestamp),
        client: payment.client?.phone ? `+${payment.client?.phone}` : null,
        nickname: payment.client?.nickname || null,
        title: item.title || 'Пополнение депозита',
        amount: item.amount,
        sum:
          payment.payment.title === 'DEPOSIT'
            ? Math.floor(item.sum - payment.value1)
            : Math.floor(item.sum),
        bonus: Math.floor(payment.value1),
        payment_title: payment.payment.title,
        operator: formatOperator(payment.operator),
      });
    });
  });
  return { result };
};

const getSbpData = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    eventList(input: { start: "${startDate}", finish: "${endDate}", types: "DEPOSIT_ADDED_ONLINE" }, first: 1000, page: ${page}) {
      paginatorInfo { count currentPage lastPage }
      data {
        type timestamp client { phone nickname }
        payment { id value }
        payment_items { title amount sum entity_type }
        operator { first_name last_name }
        value1
      }
    }
  }`;

  const res = await fetchPaginatedData(queryFactory, managerBearer);
  if (res.error) return res;

  const result = res.result.map((payment) => ({
    timestamp: payment.timestamp,
    idForSort: makeIdForSort(payment.timestamp),
    id: payment.payment.id,
    type: 'TARIFF',
    date: parseDate(payment.timestamp),
    time: parseTime(payment.timestamp),
    client: payment.client?.phone ? `+${payment.client?.phone}` : null,
    nickname: payment.client?.nickname || null,
    title: 'Пополнение по СБП',
    amount: payment.payment_items[0].amount,
    sum: Math.floor(payment.payment_items[0].sum),
    bonus: Math.floor(payment.value1) || 0,
    payment_title: 'СБП',
    operator: formatOperator(payment.operator),
  }));
  return { result };
};

const getTariffPerMinuteData = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    eventList(input: { start: "${startDate}", finish: "${endDate}", types: "CLIENT_SESSION_FINISHED" }, first: 1000, page: ${page}) {
      paginatorInfo { count currentPage lastPage }
      data {
        timestamp client { phone nickname }
        payment { id value title }
        payment_items { title amount sum entity_type }
        client_session { is_per_minute total_cost elapsed }
        operator { first_name last_name }
        value1
      }
    }
  }`;

  const res = await fetchPaginatedData(queryFactory, managerBearer);
  if (res.error) return res;

  const result = res.result
    .filter(
      (payment) =>
        payment.client_session && payment.client_session.is_per_minute === true,
    )
    .map((payment) => ({
      timestamp: payment.timestamp,
      idForSort: makeIdForSort(payment.timestamp),
      id: payment.payment?.id || 0,
      type: 'TARIFF',
      date: parseDate(payment.timestamp),
      time: parseTime(payment.timestamp),
      client: payment.client?.phone ? `+${payment.client?.phone}` : null,
      nickname: payment.client?.nickname || null,
      title: 'Поминутный',
      amount: payment.client_session.elapsed,
      sum: Math.floor(payment?.client_session?.total_cost) || 0,
      bonus: Math.floor(payment.value1) || 0,
      payment_title: 'DEPOSIT',
      operator: formatOperator(payment.operator),
    }));
  return { result };
};

const getBonusData = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    eventList(input: { start: "${startDate}", finish: "${endDate}", types: "BONUS_PAYMENT_CREATED" }, first: 1000, page: ${page}) {
      paginatorInfo { count currentPage lastPage }
      data {
        timestamp client { phone nickname }
        payment { id value title }
        payment_items { title amount sum entity_type }
        operator { first_name last_name }
        comment
      }
    }
  }`;

  const res = await fetchPaginatedData(queryFactory, managerBearer);
  if (res.error) return res;

  const result = res.result.map((payment) => ({
    timestamp: payment.timestamp,
    idForSort: makeIdForSort(payment.timestamp),
    id: payment.payment.id,
    type: 'DEPOSIT',
    date: parseDate(payment.timestamp),
    time: parseTime(payment.timestamp),
    client: payment.client?.phone ? `+${payment.client?.phone}` : null,
    nickname: payment.client?.nickname || null,
    title: 'Начисление смарт-бонусов',
    amount: payment.payment_items[0].amount,
    sum: 0,
    bonus: payment.payment_items[0].sum,
    payment_title: payment.payment.title,
    operator: formatOperator(payment.operator),
    comment: payment.comment,
  }));
  return { result };
};

const getPaymentRefundData = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    eventList(input: { start: "${startDate}", finish: "${endDate}", types: "PAYMENT_REFUND" }, first: 1000, page: ${page}) {
      paginatorInfo { count currentPage lastPage }
      data {
        type timestamp client { phone nickname }
        payment { id value title }
        payment_items { title amount sum entity_type }
        value1 operator { first_name last_name }
      }
    }
  }`;

  const res = await fetchPaginatedData(queryFactory, managerBearer);
  if (res.error) return res;

  const result = [];
  res.result.forEach((payment) => {
    payment.payment_items.forEach((item) => {
      result.push({
        timestamp: payment.timestamp,
        idForSort: makeIdForSort(payment.timestamp),
        id: payment.payment.id,
        type: item.entity_type,
        date: parseDate(payment.timestamp),
        time: parseTime(payment.timestamp),
        client: payment.client?.phone ? `+${payment.client?.phone}` : null,
        nickname: payment.client?.nickname || null,
        title: 'Отмена ' + item.entity_type,
        amount: item.amount,
        sum:
          payment.payment.title === 'BONUS'
            ? 0
            : payment.payment.title === 'DEPOSIT'
              ? -Math.floor(item.sum - payment.value1)
              : -Math.floor(item.sum),
        bonus:
          payment.payment.title === 'BONUS'
            ? -Math.floor(item.sum)
            : Math.floor(payment.value1),
        payment_title: payment.payment.title,
        operator: formatOperator(payment.operator),
      });
    });
  });
  return { result };
};

const getCashOrders = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    eventList(input: { start: "${startDate}", finish: "${endDate}", types: "CASH_ORDER_CREATED" }, first: 1000, page: ${page}) {
      paginatorInfo { count currentPage lastPage }
      data {
        cash_order { id created_at type sum comment }
        operator { first_name last_name }
      }
    }
  }`;

  const res = await fetchPaginatedData(queryFactory, managerBearer);
  if (res.error) return res;

  const result = res.result.map((order) => ({
    timestamp: order.cash_order.created_at,
    idForSort: makeIdForSort(order.cash_order.created_at),
    id: order.cash_order.id,
    type: order.cash_order.type,
    date: parseDate(order.cash_order.created_at),
    time: parseTime(order.cash_order.created_at),
    sum: order.cash_order.sum,
    comment: order.cash_order.comment,
    operator: formatOperator(order.operator),
  }));
  return { result };
};

const getAllShiftsForPeriod = async (startDate, endDate, managerBearer) => {
  const queryFactory = (page) => `query {
    workShifts(input: { created_from: "${startDate}", created_to: "${endDate}" }, page: ${page}, first: 500) {
      paginatorInfo { hasMorePages }
      data {
        id created_at finished_at
        worker { first_name last_name }
      }
    }
  }`;

  const res = await fetchPaginatedData(
    queryFactory,
    managerBearer,
    'workShifts',
  );
  if (res.error) return res;

  const result = res.result.map((shift) => {
    const finishedAtNum = shift.finished_at
      ? parseInt(shift.finished_at.replace(/[- :]/g, ''))
      : 99999999999999;
    return {
      start_at_num: parseInt(shift.created_at.replace(/[- :]/g, '')),
      finished_at_num: finishedAtNum,
      operatorName:
        `${shift.worker?.first_name || ''} ${shift.worker?.last_name || ''}`.trim(),
    };
  });
  return { result };
};

const getFirstClientSessions = async (startDate, endDate, managerBearer) => {
  const result = [];
  const seenClients = new Set();
  let currentStartDate = new Date(startDate);
  const endLimit = new Date(endDate);

  while (currentStartDate <= endLimit) {
    const currentMonth = currentStartDate.getMonth();
    const currentYear = currentStartDate.getFullYear();
    const monthStartDate = new Date(currentYear, currentMonth, 1, 0, 0, 0);
    const monthEndDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const formattedMonthStart = monthStartDate
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const formattedMonthEnd = monthEndDate
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    const queryFactory = (page) => `query {
      eventList(input: { start: "${formattedMonthStart}", finish: "${formattedMonthEnd}", types: "CLIENT_SESSION_FINISHED" }, first: 1000, page: ${page}) {
        paginatorInfo { hasMorePages }
        data { timestamp client { phone email nickname } }
      }
    }`;

    const res = await fetchPaginatedData(queryFactory, managerBearer);
    if (res.error) return res;

    res.result.forEach((event) => {
      const clientPhone = event.client?.phone;
      if (clientPhone && !seenClients.has(clientPhone)) {
        seenClients.add(clientPhone);
        result.push({
          key: clientPhone,
          firstSessionDate: event.timestamp,
          nickname: event.client.nickname,
          phone: `+${event.client.phone}`,
          email: event.client.email || 'Не указан',
        });
      }
    });
    currentStartDate.setMonth(currentStartDate.getMonth() + 1);
  }

  result.sort(
    (a, b) => new Date(a.firstSessionDate) - new Date(b.firstSessionDate),
  );
  return { result };
};

const getResultsArray = async (startDate, endDate, club) => {
  try {
    const managerBearer = await getManagerToken(club);
    if (managerBearer.error) return managerBearer;

    const shiftsStartDateObj = new Date(startDate);
    shiftsStartDateObj.setDate(shiftsStartDateObj.getDate() - 1);
    const formattedShiftsStartDate = `${shiftsStartDateObj.getFullYear()}-${String(shiftsStartDateObj.getMonth() + 1).padStart(2, '0')}-${String(shiftsStartDateObj.getDate()).padStart(2, '0')} 00:00:00`;

    const shiftsEndDateObj = new Date(endDate);
    shiftsEndDateObj.setDate(shiftsEndDateObj.getDate() + 1);
    const formattedShiftsEndDate = `${shiftsEndDateObj.getFullYear()}-${String(shiftsEndDateObj.getMonth() + 1).padStart(2, '0')}-${String(shiftsEndDateObj.getDate()).padStart(2, '0')} 23:59:59`;

    const [paymentResults, shiftsData] = await Promise.all([
      Promise.all([
        getPaymentData(startDate, endDate, managerBearer),
        getSbpData(startDate, endDate, managerBearer),
        getTariffPerMinuteData(startDate, endDate, managerBearer),
        getBonusData(startDate, endDate, managerBearer),
        getPaymentRefundData(startDate, endDate, managerBearer),
      ]),
      getAllShiftsForPeriod(
        formattedShiftsStartDate,
        formattedShiftsEndDate,
        managerBearer,
      ),
    ]);

    if (shiftsData.error) return shiftsData;

    const paymentData = paymentResults.flatMap((res) => res.result || []);
    const shifts = shiftsData.result.sort(
      (a, b) => a.start_at_num - b.start_at_num,
    );

    const transactionsMap = new Map();
    paymentData.forEach((event) => {
      if (event.id && event.id !== 0 && !event.title.startsWith('Отмена')) {
        transactionsMap.set(event.id, { type: event.type, title: event.title });
      }
    });

    const processedEvents = paymentData.map((event) => {
      if (event.title && event.title.includes('null')) {
        const originalTx = transactionsMap.get(event.id);
        if (originalTx) {
          event.type = originalTx.type;
          event.title = `Отмена (${originalTx.title})`;
        }
      }

      if (event.payment_title === 'СБП') {
        const eventTimeNum = event.idForSort;
        let matchingShift = shifts.find(
          (shift) =>
            eventTimeNum >= shift.start_at_num &&
            eventTimeNum <= shift.finished_at_num,
        );

        if (!matchingShift) {
          const previousShifts = shifts
            .filter((s) => s.finished_at_num < eventTimeNum)
            .sort((a, b) => b.finished_at_num - a.finished_at_num);
          if (previousShifts.length > 0) matchingShift = previousShifts[0];
        }

        event.operator =
          matchingShift && matchingShift.operatorName
            ? matchingShift.operatorName
            : 'Смена не завершена (Текущая)';
      }
      return event;
    });

    return processedEvents.sort((a, b) => a.idForSort - b.idForSort);
  } catch (error) {
    console.log('getResultsArray ERROR ->', error);
    return { error: true, message: error.message };
  }
};

module.exports = {
  getResultsArray,
  getSbpData,
  getCashOrders,
  getFirstClientSessions,
};
