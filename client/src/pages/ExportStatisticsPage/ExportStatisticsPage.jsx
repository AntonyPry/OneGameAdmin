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
  const hasPeriodOverviewData = Boolean(
    periodOverview &&
      ((periodOverview.totals || []).length ||
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
                {(periodOverview.totals || []).length > 0 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {periodOverview.totals.slice(0, 8).map((total) => (
                      <div
                        key={`${total.source}-${total.key}`}
                        className="min-w-0 rounded-md border border-border bg-muted/30 p-3"
                      >
                        <div className="truncate text-xs text-muted-foreground">
                          {total.label}
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
                            <TableHead>Позиция</TableHead>
                            <TableHead>Раздел</TableHead>
                            <TableHead className="text-right">Кол-во</TableHead>
                            <TableHead className="text-right">Сумма</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {periodOverview.topItems.map((item, index) => (
                            <TableRow key={`${item.source}-${item.title}-${index}`}>
                              <TableCell className="min-w-44 font-medium">
                                {item.title}
                              </TableCell>
                              <TableCell className="min-w-36 text-muted-foreground">
                                {item.category}
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
                    {periodOverview.sections.slice(0, 4).map((section) => (
                      <div
                        key={section.key}
                        className="min-w-0 rounded-md border border-border"
                      >
                        <div className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium">
                          {section.title}
                        </div>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Показатель</TableHead>
                                <TableHead className="text-right">Кол-во</TableHead>
                                <TableHead className="text-right">Сумма</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(section.rows || []).slice(0, 6).map((row, index) => (
                                <TableRow key={`${section.key}-${row.label}-${index}`}>
                                  <TableCell className="min-w-40">
                                    {row.label}
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
                    ))}
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
