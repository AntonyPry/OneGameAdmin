import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/api';
import { format } from 'date-fns';
import {
  AlertCircle,
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

  const selectedPeriodLabel = useMemo(() => formatRange(dateRange), [dateRange]);

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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const applyQuickPeriod = (periodKey) => {
    setDateRange(getQuickPeriodRange(periodKey));
    setActiveQuickPeriod(periodKey);
  };

  const handleDateRangeChange = (nextRange) => {
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

      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap gap-2">
            {QUICK_PERIODS.map((period) => (
              <Button
                key={period.key}
                type="button"
                variant={
                  activeQuickPeriod === period.key ? 'default' : 'outline'
                }
                onClick={() => applyQuickPeriod(period.key)}
              >
                {period.label}
              </Button>
            ))}
          </div>
          <DatePickerWithRange
            date={dateRange}
            setDate={handleDateRangeChange}
            className="w-full lg:w-[280px]"
          />
        </div>
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
                  {report.requiresPeriod ? selectedPeriodLabel : 'Все время'}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  variant={report.requiresPeriod ? 'default' : 'secondary'}
                  onClick={() => downloadReport(report.key)}
                  disabled={
                    Boolean(loadingReportKey) ||
                    (report.requiresPeriod &&
                      (!dateRange?.from || !dateRange?.to))
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
          <div className="rounded-lg border border-border bg-card">
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
