import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/api';
import { format } from 'date-fns';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  History,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InfoHint } from '@/components/ui/info-hint';

const REPORTS = [
  {
    key: 'payments',
    historyType: 'payments',
    title: 'Общие оплаты',
    description: 'Полный список транзакций за выбранный период.',
    url: '/api/payments/paymentsFromPeriod',
    fileNamePrefix: 'Платежи',
    requiresPeriod: true,
  },
  {
    key: 'sbp',
    historyType: 'sbp',
    title: 'Оплаты по СБП',
    description: 'Транзакции через Систему Быстрых Платежей.',
    url: '/api/payments/sbpFromPeriod',
    fileNamePrefix: 'СБП',
    requiresPeriod: true,
  },
  {
    key: 'cash_orders',
    historyType: 'cash_orders',
    title: 'Кассовые ордера',
    description: 'Движение наличных средств по кассе.',
    url: '/api/payments/cashOrdersFromPeriod',
    fileNamePrefix: 'Кассовые_ордера',
    requiresPeriod: true,
  },
  {
    key: 'first_sessions',
    historyType: 'first_sessions',
    title: 'Первые сессии клиентов',
    description: 'Новые клиенты с момента открытия клуба.',
    url: '/api/payments/firstSessionsFromPeriod',
    fileNamePrefix: 'Первые_сессии',
    requiresPeriod: false,
  },
];

const REPORTS_BY_HISTORY_TYPE = new Map(
  REPORTS.map((report) => [report.historyType, report]),
);

const QUICK_PERIODS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'yesterday', label: 'Вчера' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
];

const TRIAL_WINDOW_DAYS = 7;

const STATUS_META = {
  pending: {
    label: 'Формируется',
    variant: 'secondary',
    icon: Clock3,
  },
  success: {
    label: 'Готово',
    variant: 'outline',
    icon: CheckCircle2,
  },
  error: {
    label: 'Ошибка',
    variant: 'destructive',
    icon: XCircle,
  },
};

const REPORT_SOURCE_LABELS = {
  overviewReport: 'Общие итоги',
  salesReport: 'Продажи',
  sessionsMoneyReport: 'Сессии',
  topSoldOverviewItemsReport: 'Топ продаж',
  boughtTariffsReport: 'Купленные тарифы',
};

const REPORT_SOURCE_DESCRIPTIONS = {
  overviewReport:
    'Итоговая сводка Smartshell по выбранному периоду: общие суммы и ключевые показатели.',
  salesReport:
    'Продажи товаров, тарифов и услуг за выбранный период по данным Smartshell.',
  sessionsMoneyReport:
    'Деньги, связанные с игровыми сессиями за выбранный период.',
  topSoldOverviewItemsReport:
    'Позиции, которые чаще всего приносили выручку в выбранном периоде.',
  boughtTariffsReport:
    'Купленные тарифы и пакеты за выбранный период.',
};

const METRIC_LABELS = {
  amount: 'Количество',
  avg_goods_receipt: 'Средний чек товаров',
  avg_hour_cost: 'Средняя стоимость часа',
  avg_revenue_per_host: 'Средняя выручка на место',
  average: 'Среднее значение',
  bepaid_erip_count: 'Платежи bePaid ЕРИП',
  bepaid_erip_sum: 'Сумма bePaid ЕРИП',
  bonus: 'Бонусы',
  bonus_count: 'Бонусные операции',
  bonus_sum: 'Начислено бонусов',
  bonus_cashback: 'Бонусный кешбэк',
  bonuses: 'Бонусы',
  card: 'Оплаты картой',
  card_count: 'Оплаты картой',
  card_sum: 'Сумма оплат картой',
  cash: 'Наличные',
  cash_count: 'Оплаты наличными',
  cash_revenue: 'Выручка наличными',
  cash_sum: 'Сумма наличными',
  client_apru: 'Средняя выручка на клиента',
  cloudpayments_count: 'Оплаты CloudPayments',
  cloudpayments_sum: 'Сумма CloudPayments',
  count: 'Количество',
  deposit: 'Пополнения',
  deposit_count: 'Пополнения баланса',
  deposit_revenue: 'Пополнения баланса',
  deposit_sum: 'Сумма пополнений',
  deposits: 'Пополнения',
  discount: 'Скидки',
  discounts: 'Скидки',
  guest_sessions: 'Гостевые сессии',
  guest_sessions_percent: 'Доля гостевых сессий',
  good_count: 'Продано товаров',
  good_sum: 'Выручка бара и товаров',
  income: 'Доход',
  items: 'Позиции',
  kaspi_pay_count: 'Платежи Kaspi Pay',
  kaspi_pay_sum: 'Сумма Kaspi Pay',
  money: 'Деньги',
  new_clients_count: 'Новые клиенты',
  new_clients_percent: 'Доля новых клиентов',
  online_count: 'Онлайн-оплаты',
  online_sum: 'Сумма онлайн-оплат',
  payment: 'Оплата',
  payments: 'Оплаты',
  percent: 'Процент',
  pko_amount: 'Приходные кассовые ордера',
  profit: 'Прибыль',
  quantity: 'Количество',
  qty: 'Количество',
  regular_clients_percent: 'Постоянные клиенты',
  repeat_visits: 'Повторные визиты',
  repeat_visits_percent: 'Доля повторных визитов',
  refund: 'Возвраты',
  refunds: 'Возвраты',
  revenue: 'Выручка',
  rko_amount: 'Расходные кассовые ордера',
  sale: 'Продажа',
  sales: 'Продажи',
  service: 'Услуги',
  service_count: 'Продано услуг',
  service_sum: 'Выручка услуг',
  services: 'Услуги',
  session: 'Сессия',
  sessions: 'Сессии',
  sessions_count: 'Сессии',
  stripe_count: 'Платежи Stripe',
  stripe_sum: 'Сумма Stripe',
  sum: 'Сумма',
  tariff: 'Тариф',
  tariff_count: 'Продано тарифов',
  tariff_revenue: 'Выручка по тарифам',
  tariff_sum: 'Выручка по тарифам',
  tariffs: 'Тарифы',
  tinkoff_sbp_count: 'Оплаты по СБП',
  tinkoff_sbp_sum: 'Сумма оплат по СБП',
  total: 'Итого',
  total_amount: 'Общее количество',
  total_bonus: 'Начислено бонусов',
  total_bonus_with_refunds: 'Бонусы с учетом возвратов',
  total_booked_revenue: 'Выручка по броням',
  total_booked_sessions: 'Забронированные сессии',
  total_count: 'Общее количество',
  total_goods_sold: 'Продано товаров',
  total_load_percent: 'Загрузка клуба',
  total_payments_count: 'Всего платежей',
  total_payments_sum: 'Сумма всех платежей',
  total_revenue: 'Общая выручка',
  total_sessions: 'Сессии',
  total_sum: 'Итого сумма',
  unique_clients: 'Уникальные клиенты',
};

const UNIT_LABELS = {
  count: 'Количество',
  percent: 'Процент',
  rub: 'Сумма',
};

const OVERVIEW_CARD_DEFINITIONS = [
  {
    id: 'totalRevenue',
    source: 'overviewReport',
    labelKey: 'total_revenue',
    title: 'Общая выручка',
    unit: 'rub',
    description:
      'Вся выручка за выбранный период по сводке Smartshell.',
  },
  {
    id: 'tariffRevenue',
    source: 'salesReport',
    labelKey: 'tariff_sum',
    title: 'Тарифы и ПК',
    unit: 'rub',
    description:
      'Деньги от купленных тарифов и компьютерных сессий за выбранный период.',
  },
  {
    id: 'goodsRevenue',
    source: 'salesReport',
    labelKey: 'good_sum',
    title: 'Бар и товары',
    unit: 'rub',
    description:
      'Выручка от проданных товаров и бара за выбранный период.',
  },
  {
    id: 'serviceRevenue',
    source: 'salesReport',
    labelKey: 'service_sum',
    title: 'Услуги',
    unit: 'rub',
    description:
      'Выручка от дополнительных услуг за выбранный период.',
  },
  {
    id: 'depositRevenue',
    source: 'overviewReport',
    labelKey: 'deposit_revenue',
    title: 'Пополнения баланса',
    unit: 'rub',
    description:
      'Сколько денег гости внесли на баланс за выбранный период.',
  },
  {
    id: 'bonusTotal',
    source: 'overviewReport',
    labelKey: 'total_bonus',
    title: 'Начислено бонусов',
    unit: 'rub',
    description:
      'Сколько бонусов было начислено клиентам за выбранный период.',
  },
  {
    id: 'uniqueClients',
    source: 'overviewReport',
    labelKey: 'unique_clients',
    title: 'Уникальные клиенты',
    unit: 'count',
    description:
      'Сколько разных клиентов посещали клуб или совершали операции в выбранный период.',
  },
  {
    id: 'sessions',
    source: 'overviewReport',
    labelKey: 'total_sessions',
    title: 'Сессии',
    unit: 'count',
    description:
      'Количество игровых сессий за выбранный период.',
  },
];

const saveBlob = (blob, fileName) => {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', fileName);

  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

const endOfDay = (date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );

const startOfWeek = (date) => {
  const day = date.getDay() || 7;
  return addDays(startOfDay(date), 1 - day);
};

const startOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const getQuickPeriodRange = (periodKey) => {
  const today = startOfDay(new Date());

  if (periodKey === 'yesterday') {
    const yesterday = addDays(today, -1);
    return { from: yesterday, to: yesterday };
  }

  if (periodKey === 'week') {
    return { from: startOfWeek(today), to: today };
  }

  if (periodKey === 'month') {
    return { from: startOfMonth(today), to: today };
  }

  return { from: today, to: today };
};

const getTrialWindow = () => {
  const today = new Date();
  return {
    from: startOfDay(addDays(today, -(TRIAL_WINDOW_DAYS - 1))),
    to: endOfDay(today),
  };
};

const isRangeInsideWindow = (range, windowRange) => {
  if (!range?.from || !range?.to) return false;
  return (
    startOfDay(range.from).getTime() >= windowRange.from.getTime() &&
    endOfDay(range.to).getTime() <= windowRange.to.getTime()
  );
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return format(date, 'dd.MM.yyyy');
};

const formatDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRange = (range) => {
  if (!range?.from || !range?.to) return 'Период не выбран';
  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
};

const formatHistoryPeriod = (item) => {
  if (!item.startDate && !item.start_date) return 'Все время';

  const startDate = item.startDate || item.start_date;
  const endDate = item.endDate || item.end_date;
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const getUserName = (user) => {
  if (!user) return 'Пользователь удален';

  const firstName = user.firstName ?? user.first_name ?? '';
  const lastName = user.lastName ?? user.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user.email || `Пользователь #${user.id}`;
};

const getDownloadErrorMessage = async (error, fallback) => {
  const data = error.response?.data;

  if (data instanceof Blob && data.type.includes('application/json')) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed.message || fallback;
    } catch (parseError) {
      return fallback;
    }
  }

  return data?.message || error.message || fallback;
};

const getReportByHistoryType = (historyType) =>
  REPORTS_BY_HISTORY_TYPE.get(historyType) || null;

const formatMetricValue = (value, unit) => {
  if (value === null || value === undefined || value === '') return '—';

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);

  if (unit === 'rub') {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(numberValue);
  }

  if (unit === 'percent') {
    return `${new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 1,
    }).format(numberValue)}%`;
  }

  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 2,
  }).format(numberValue);
};

const normalizeLookupKey = (value) =>
  String(value || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9а-яё_%]+/gi, '');

const hasRussianText = (value) => /[а-яё]/i.test(String(value || ''));

const isTechnicalMetricLabel = (value) =>
  /^(value\d+|summary\d*|data\d*|metric\d*)$/i.test(String(value || ''));

const getReportSourceLabel = (source) =>
  REPORT_SOURCE_LABELS[source] || 'Отчет Smartshell';

const getReportSourceDescription = (source) =>
  REPORT_SOURCE_DESCRIPTIONS[source] ||
  'Показатель из отчета Smartshell за выбранный период.';

const getMetricLabel = (label, { source, unit, fallback } = {}) => {
  const key = normalizeLookupKey(label);

  if (REPORT_SOURCE_LABELS[label]) return REPORT_SOURCE_LABELS[label];
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  if (!label || isTechnicalMetricLabel(label)) {
    return fallback || UNIT_LABELS[unit] || getReportSourceLabel(source);
  }

  if (!hasRussianText(label) && unit) {
    return fallback || getReportSourceLabel(source);
  }

  return String(label);
};

const getSectionTitle = (section) => {
  const rawTitle = section?.title;
  const sourceLabel = getReportSourceLabel(section?.source);
  const key = normalizeLookupKey(rawTitle);

  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  if (!rawTitle || !hasRussianText(rawTitle)) return sourceLabel;

  return getMetricLabel(rawTitle, {
    source: section?.source,
    fallback: sourceLabel,
  });
};

const getMetricDescription = ({ label, source, unit, kind }) => {
  const sourceText = getReportSourceDescription(source);
  const unitText =
    unit === 'rub'
      ? 'Значение показано в рублях.'
      : unit === 'percent'
        ? 'Значение показано в процентах.'
        : unit === 'count'
          ? 'Значение показывает количество.'
          : 'Значение приведено в формате, который отдал Smartshell.';

  if (kind === 'amount') {
    return 'Количество операций, сессий, товаров или тарифов в этой строке отчета.';
  }

  if (kind === 'sum') {
    return 'Денежная сумма по этой строке отчета за выбранный период.';
  }

  if (kind === 'row') {
    return 'Строка отчета Smartshell. Смотрите соседние колонки, чтобы понять количество и сумму по этой позиции.';
  }

  return `${sourceText} ${unitText}`;
};

const getTotalLabelKey = (total) => normalizeLookupKey(total?.label);

const findTotalMetric = (totals, definition) =>
  totals.find(
    (total) =>
      total.source === definition.source &&
      getTotalLabelKey(total) === definition.labelKey,
  );

const getOverviewCards = (report = {}) => {
  const totals = Array.isArray(report?.totals) ? report.totals : [];
  const usedKeys = new Set();
  const cards = OVERVIEW_CARD_DEFINITIONS.map((definition) => {
    const metric = findTotalMetric(totals, definition);
    if (!metric) return null;

    usedKeys.add(`${metric.source}:${getTotalLabelKey(metric)}`);

    return {
      id: definition.id,
      source: metric.source,
      key: metric.key,
      title: definition.title,
      value: metric.value,
      unit: definition.unit || metric.unit,
      description: definition.description,
    };
  }).filter(Boolean);

  if (cards.length >= 4) return cards.slice(0, 8);

  const fallbackCards = totals
    .filter((total) => {
      const key = getTotalLabelKey(total);
      if (!key || usedKeys.has(`${total.source}:${key}`)) return false;
      if (total.source === 'topSoldOverviewItemsReport') return false;
      return total.value !== null && total.value !== undefined;
    })
    .map((total, index) => ({
      id: `fallback-${total.source}-${getTotalLabelKey(total)}-${index}`,
      source: total.source,
      key: total.key,
      title: getMetricLabel(total.label, {
        source: total.source,
        unit: total.unit,
        fallback: getReportSourceLabel(total.source),
      }),
      value: total.value,
      unit: total.unit,
      description: getMetricDescription({
        label: total.label,
        source: total.source,
        unit: total.unit,
      }),
    }));

  return [...cards, ...fallbackCards].slice(0, 8);
};

const formatReportAmount = (value) =>
  value === null || value === undefined ? '—' : formatMetricValue(value, 'count');

const formatReportMoney = (value) =>
  value === null || value === undefined ? '—' : formatMetricValue(value, 'rub');

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;

  return (
    <Badge variant={meta.variant}>
      <Icon className="h-3 w-3 shrink-0" />
      {meta.label}
    </Badge>
  );
};

const MetricHeader = ({ children, description, className = '' }) => (
  <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
    <span className="min-w-0 truncate">{children}</span>
    <InfoHint label={`Пояснение: ${children}`}>{description}</InfoHint>
  </span>
);

const ExportStatisticsPage = () => {
  const { session } = useAuth();
  const [dateRange, setDateRange] = useState(() =>
    getQuickPeriodRange('today'),
  );
  const [activeQuickPeriod, setActiveQuickPeriod] = useState('today');
  const [loadingReportKey, setLoadingReportKey] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [periodOverview, setPeriodOverview] = useState(null);
  const [periodOverviewError, setPeriodOverviewError] = useState('');
  const [isPeriodOverviewLoading, setIsPeriodOverviewLoading] = useState(false);

  const isTrial = Boolean(session.isFreeTrial ?? session.is_free_trial);
  const trialWindow = useMemo(() => getTrialWindow(), []);
  const trialWindowLabel = useMemo(
    () => formatRange({ from: trialWindow.from, to: trialWindow.to }),
    [trialWindow],
  );
  const selectedPeriodLabel = useMemo(() => formatRange(dateRange), [dateRange]);
  const isSelectedPeriodAllowed = useMemo(
    () => !isTrial || isRangeInsideWindow(dateRange, trialWindow),
    [dateRange, isTrial, trialWindow],
  );
  const overviewCards = useMemo(
    () => getOverviewCards(periodOverview),
    [periodOverview],
  );
  const hasPeriodOverviewData = Boolean(
    periodOverview &&
      (overviewCards.length ||
        (periodOverview.topItems || []).length ||
        (periodOverview.sections || []).some((section) => section.rows?.length)),
  );

  const loadHistory = useCallback(async () => {
    if (!session.activeClubId) {
      setHistory([]);
      setHistoryError('');
      return;
    }

    try {
      setIsHistoryLoading(true);
      setHistoryError('');
      const response = await api.get('/api/payments/export-history', {
        params: { limit: 10 },
      });
      setHistory(response.data?.history || []);
    } catch (error) {
      setHistory([]);
      setHistoryError(
        error.response?.data?.message || 'Не удалось загрузить историю',
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, [session.activeClubId]);

  const loadPeriodOverview = useCallback(async () => {
    if (!session.activeClubId) {
      setPeriodOverview(null);
      setPeriodOverviewError('');
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      setPeriodOverview(null);
      setPeriodOverviewError('Выберите период для обзора');
      return;
    }

    if (!isSelectedPeriodAllowed) {
      setPeriodOverview(null);
      setPeriodOverviewError(
        `В бесплатном периоде доступен период ${trialWindowLabel}`,
      );
      return;
    }

    try {
      setIsPeriodOverviewLoading(true);
      setPeriodOverviewError('');
      const response = await api.post('/api/payments/periodOverview', {
        startDate: `${format(dateRange.from, 'yyyy-MM-dd')} 00:00:00`,
        endDate: `${format(dateRange.to, 'yyyy-MM-dd')} 23:59:59`,
      });
      setPeriodOverview(response.data?.report || null);
    } catch (error) {
      setPeriodOverview(null);
      setPeriodOverviewError(
        error.response?.data?.message ||
          'Не удалось загрузить обзор периода из Smartshell',
      );
    } finally {
      setIsPeriodOverviewLoading(false);
    }
  }, [
    dateRange,
    isSelectedPeriodAllowed,
    session.activeClubId,
    trialWindowLabel,
  ]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadPeriodOverview();
  }, [loadPeriodOverview]);

  useEffect(() => {
    if (!isTrial || isSelectedPeriodAllowed) return;

    setDateRange(getQuickPeriodRange('today'));
    setActiveQuickPeriod('today');
    setDownloadError(`В бесплатном периоде доступен период ${trialWindowLabel}`);
  }, [isSelectedPeriodAllowed, isTrial, trialWindowLabel]);

  const applyQuickPeriod = (periodKey) => {
    const nextRange = getQuickPeriodRange(periodKey);
    if (isTrial && !isRangeInsideWindow(nextRange, trialWindow)) {
      const message = `В бесплатном периоде доступен период ${trialWindowLabel}`;
      setDownloadError(message);
      toast.error(message);
      return;
    }

    setDownloadError('');
    setDateRange(nextRange);
    setActiveQuickPeriod(periodKey);
  };

  const handleDateRangeChange = (nextRange) => {
    if (
      isTrial &&
      nextRange?.from &&
      nextRange?.to &&
      !isRangeInsideWindow(nextRange, trialWindow)
    ) {
      setDownloadError(`В бесплатном периоде доступен период ${trialWindowLabel}`);
      setActiveQuickPeriod('custom');
      return;
    }

    setDownloadError('');
    setDateRange(nextRange);
    setActiveQuickPeriod('custom');
  };

  const downloadReport = async (reportKey, rangeOverride = dateRange) => {
    const report = REPORTS.find((item) => item.key === reportKey);
    if (!report) return;

    if (report.requiresPeriod && (!rangeOverride?.from || !rangeOverride?.to)) {
      toast.error('Выберите диапазон дат');
      return;
    }

    if (
      isTrial &&
      report.requiresPeriod &&
      !isRangeInsideWindow(rangeOverride, trialWindow)
    ) {
      const message = `В бесплатном периоде доступен период ${trialWindowLabel}`;
      setDownloadError(message);
      toast.error(message);
      return;
    }

    if (!session.activeClubId) {
      setDownloadError('Выберите активный клуб');
      return;
    }

    const payload = report.requiresPeriod
      ? {
          startDate: `${format(rangeOverride.from, 'yyyy-MM-dd')} 00:00:00`,
          endDate: `${format(rangeOverride.to, 'yyyy-MM-dd')} 23:59:59`,
        }
      : {};
    const filePeriod = report.requiresPeriod
      ? `${formatDate(rangeOverride.from)}-${formatDate(rangeOverride.to)}`
      : isTrial
        ? 'последние_7_дней'
        : 'за_все_время';

    try {
      setLoadingReportKey(report.key);
      setDownloadError('');
      const response = await api.post(report.url, payload, {
        responseType: 'blob',
      });

      saveBlob(response.data, `${report.fileNamePrefix}_${filePeriod}.xlsx`);
      toast.success('Отчет сформирован');
      await loadHistory();
    } catch (error) {
      const message = await getDownloadErrorMessage(
        error,
        'Произошла ошибка при скачивании файла',
      );
      setDownloadError(message);
      toast.error(message);
      await loadHistory();
    } finally {
      setLoadingReportKey('');
    }
  };

  const repeatExport = (item) => {
    const report = getReportByHistoryType(item.reportType || item.report_type);
    if (!report) {
      toast.error('Тип отчета больше не поддерживается');
      return;
    }

    const startDate = item.startDate || item.start_date;
    const endDate = item.endDate || item.end_date;
    const historyRange =
      report.requiresPeriod && startDate && endDate
        ? { from: new Date(startDate), to: new Date(endDate) }
        : dateRange;

    if (report.requiresPeriod) {
      setDateRange(historyRange);
      setActiveQuickPeriod('custom');
    }

    downloadReport(report.key, historyRange);
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-8 p-4 md:p-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Экспорт статистики
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedPeriodLabel}
        </p>
      </div>

      {downloadError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {isTrial && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Бесплатный период: доступен диапазон {trialWindowLabel}</span>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap gap-2">
            {QUICK_PERIODS.map((period) => {
              const periodRange = getQuickPeriodRange(period.key);
              const isDisabled =
                isTrial && !isRangeInsideWindow(periodRange, trialWindow);

              return (
                <Button
                  key={period.key}
                  type="button"
                  variant={
                    activeQuickPeriod === period.key ? 'default' : 'outline'
                  }
                  onClick={() => applyQuickPeriod(period.key)}
                  disabled={isDisabled}
                >
                  {period.label}
                </Button>
              );
            })}
          </div>
          <DatePickerWithRange
            date={dateRange}
            setDate={handleDateRangeChange}
            className="w-full lg:w-[280px]"
            disabled={
              isTrial
                ? [{ before: trialWindow.from }, { after: trialWindow.to }]
                : undefined
            }
          />
        </div>
      </section>

      <section>
        <Card className="border-border shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 shrink-0" />
                  Обзор периода
                </CardTitle>
                <CardDescription>
                  {selectedPeriodLabel}
                  {periodOverview?.generatedAt
                    ? ` · обновлено ${formatDateTime(periodOverview.generatedAt)}`
                    : ''}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {periodOverview?.status === 'degraded' && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-700"
                  >
                    Частичные данные
                  </Badge>
                )}
                {periodOverview?.status === 'ok' && (
                  <Badge variant="outline">Smartshell</Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadPeriodOverview}
                  disabled={
                    isPeriodOverviewLoading ||
                    !dateRange?.from ||
                    !dateRange?.to ||
                    !isSelectedPeriodAllowed
                  }
                >
                  <RotateCcw
                    className={
                      isPeriodOverviewLoading
                        ? 'h-4 w-4 animate-spin'
                        : 'h-4 w-4'
                    }
                  />
                  Обновить
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {periodOverviewError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{periodOverviewError}</span>
              </div>
            )}

            {(periodOverview?.warnings || []).length > 0 && (
              <div className="space-y-2">
                {periodOverview.warnings.map((warning, index) => (
                  <div
                    key={`${warning.operationName || 'warning'}-${index}`}
                    className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{warning.message || 'Часть данных недоступна'}</span>
                  </div>
                ))}
              </div>
            )}

            {isPeriodOverviewLoading ? (
              <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка обзора...
              </div>
            ) : hasPeriodOverviewData ? (
              <>
                {overviewCards.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {overviewCards.map((total) => (
                      <div
                        key={total.id}
                        className="min-w-0 rounded-md border border-border bg-muted/30 p-3"
                      >
                        <div className="text-xs text-muted-foreground">
                          <MetricHeader description={total.description}>
                            {total.title}
                          </MetricHeader>
                        </div>
                        <div className="mt-1 break-words text-xl font-semibold">
                          {formatMetricValue(total.value, total.unit)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(periodOverview.topItems || []).length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Что принесло деньги</div>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>
                              <MetricHeader description="Название товара, тарифа, услуги или другой позиции, которая принесла выручку.">
                                Позиция
                              </MetricHeader>
                            </TableHead>
                            <TableHead>
                              <MetricHeader description="Раздел отчета Smartshell, из которого взята эта позиция.">
                                Раздел
                              </MetricHeader>
                            </TableHead>
                            <TableHead className="text-right">
                              <MetricHeader
                                className="justify-end"
                                description={getMetricDescription({
                                  kind: 'amount',
                                })}
                              >
                                Количество
                              </MetricHeader>
                            </TableHead>
                            <TableHead className="text-right">
                              <MetricHeader
                                className="justify-end"
                                description={getMetricDescription({
                                  kind: 'sum',
                                })}
                              >
                                Сумма
                              </MetricHeader>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {periodOverview.topItems.map((item, index) => (
                            <TableRow key={`${item.source}-${item.title}-${index}`}>
                              <TableCell className="min-w-44 font-medium">
                                {item.title}
                              </TableCell>
                              <TableCell className="min-w-36 text-muted-foreground">
                                {getMetricLabel(item.category, {
                                  source: item.source,
                                  fallback: getReportSourceLabel(item.source),
                                })}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatReportAmount(item.amount)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatReportMoney(item.sum)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {(periodOverview.sections || []).length > 0 && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {periodOverview.sections.slice(0, 4).map((section) => {
                      const sectionTitle = getSectionTitle(section);

                      return (
                        <div
                          key={section.key}
                          className="min-w-0 rounded-md border border-border"
                        >
                          <div className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium">
                            <MetricHeader
                              description={getReportSourceDescription(
                                section.source,
                              )}
                            >
                              {sectionTitle}
                            </MetricHeader>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>
                                    <MetricHeader
                                      description={getMetricDescription({
                                        kind: 'row',
                                      })}
                                    >
                                      Показатель
                                    </MetricHeader>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <MetricHeader
                                      className="justify-end"
                                      description={getMetricDescription({
                                        kind: 'amount',
                                      })}
                                    >
                                      Количество
                                    </MetricHeader>
                                  </TableHead>
                                  <TableHead className="text-right">
                                    <MetricHeader
                                      className="justify-end"
                                      description={getMetricDescription({
                                        kind: 'sum',
                                      })}
                                    >
                                      Сумма
                                    </MetricHeader>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(section.rows || [])
                                  .slice(0, 6)
                                  .map((row, index) => (
                                    <TableRow
                                      key={`${section.key}-${row.label}-${index}`}
                                    >
                                      <TableCell className="min-w-40">
                                        {isTechnicalMetricLabel(row.label)
                                          ? getMetricLabel(row.label, {
                                              source: row.source,
                                              fallback: 'Позиция отчета',
                                            })
                                          : row.label}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {formatReportAmount(row.amount)}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {formatReportMoney(row.sum ?? row.value)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Данные по выбранному периоду пока недоступны
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {REPORTS.map((report) => {
          const isLoading = loadingReportKey === report.key;

          return (
            <Card key={report.key} className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="text-sm text-muted-foreground">
                  {report.requiresPeriod
                    ? selectedPeriodLabel
                    : isTrial
                      ? `Последние ${TRIAL_WINDOW_DAYS} дней`
                      : 'Все время'}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  variant={report.requiresPeriod ? 'default' : 'secondary'}
                  onClick={() => downloadReport(report.key)}
                  disabled={
                    Boolean(loadingReportKey) ||
                    (report.requiresPeriod &&
                      (!dateRange?.from ||
                        !dateRange?.to ||
                        !isSelectedPeriodAllowed))
                  }
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isLoading ? 'Формирование...' : 'Скачать отчет'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="h-5 w-5 shrink-0" />
              Последние выгрузки
            </h2>
            <p className="text-sm text-muted-foreground">
              {history.length ? `Показано: ${history.length}` : 'История пуста'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={loadHistory}
            disabled={isHistoryLoading}
          >
            <RotateCcw
              className={isHistoryLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
            Обновить
          </Button>
        </div>

        {historyError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{historyError}</span>
          </div>
        )}

        {isHistoryLoading ? (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Загрузка истории...
          </div>
        ) : history.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Отчет</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Кто выгрузил</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="w-24 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => {
                  const report = getReportByHistoryType(
                    item.reportType || item.report_type,
                  );
                  const user = item.exportedBy || item.exported_by;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-44">
                        <div className="font-medium">
                          {report?.title || item.reportType || item.report_type}
                        </div>
                        {item.errorMessage || item.error_message ? (
                          <div className="max-w-72 truncate text-xs text-destructive">
                            {item.errorMessage || item.error_message}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatHistoryPeriod(item)}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="min-w-44">
                        <div className="font-medium">{getUserName(user)}</div>
                        <div className="text-xs text-muted-foreground">
                          {user?.email || 'email недоступен'}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => repeatExport(item)}
                            disabled={Boolean(loadingReportKey) || !report}
                            title="Повторить выгрузку"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            История выгрузок не найдена
          </div>
        )}
      </section>
    </div>
  );
};

export default ExportStatisticsPage;
