import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/api';
import { useAuth } from '@/lib/auth-context';
import {
  format,
  getDaysInMonth,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarDays,
  Copy,
  Loader2,
  Moon,
  Pencil,
  Save,
  Sun,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const PLAN_FIELDS = [
  {
    key: 'totalRevenue',
    label: 'Общий план',
    shortLabel: 'Общий',
    inputLabel: 'Общий план (₽)',
    emphasis: true,
  },
  {
    key: 'pcRevenue',
    label: 'ПК/тарифы',
    shortLabel: 'ПК',
    inputLabel: 'ПК/тарифы (₽)',
  },
  {
    key: 'psRevenue',
    label: 'PS',
    shortLabel: 'PS',
    inputLabel: 'PS (₽)',
  },
  {
    key: 'servicesRevenue',
    label: 'Услуги',
    shortLabel: 'Услуги',
    inputLabel: 'Услуги (₽)',
  },
  {
    key: 'barRevenue',
    label: 'Бар/товары',
    shortLabel: 'Бар',
    inputLabel: 'Бар/товары (₽)',
  },
];

const CATEGORY_FIELDS = PLAN_FIELDS.filter(
  (field) => field.key !== 'totalRevenue',
);

const EMPTY_PLAN_VALUES = {
  totalRevenue: 0,
  pcRevenue: 0,
  psRevenue: 0,
  servicesRevenue: 0,
  barRevenue: 0,
};

const getShiftKey = (date, shiftType) => `${date}-${shiftType}`;

const numberOrZero = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.round(numberValue));
};

const getLegacyBarRevenue = (plan = {}) => {
  const source = plan || {};

  return (
    numberOrZero(source.foodRevenue) +
    numberOrZero(source.drinksRevenue) +
    numberOrZero(source.chocolateRevenue)
  );
};

const normalizePlanValues = (plan = {}) => {
  const source = plan || {};
  const legacyBarRevenue = getLegacyBarRevenue(source);
  const explicitBarRevenue = numberOrZero(source.barRevenue);
  const servicesRevenue = numberOrZero(source.servicesRevenue);
  const explicitPsRevenue = numberOrZero(source.psRevenue);
  const legacyPsServiceRevenue = numberOrZero(source.psServiceRevenue);
  const psRevenue =
    explicitPsRevenue > 0 || servicesRevenue > 0
      ? explicitPsRevenue
      : legacyPsServiceRevenue;
  const barRevenue =
    explicitBarRevenue > 0 || legacyBarRevenue === 0
      ? explicitBarRevenue
      : legacyBarRevenue;

  return {
    totalRevenue: numberOrZero(source.totalRevenue),
    pcRevenue: numberOrZero(source.pcRevenue),
    psRevenue,
    servicesRevenue,
    barRevenue,
  };
};

const withLegacyPlanFields = (values) => {
  const normalized = normalizePlanValues(values);
  return {
    ...normalized,
    psServiceRevenue: normalized.psRevenue + normalized.servicesRevenue,
    foodRevenue: 0,
    drinksRevenue: 0,
    chocolateRevenue: 0,
  };
};

const sumCategories = (values = {}) =>
  CATEGORY_FIELDS.reduce((sum, field) => sum + numberOrZero(values[field.key]), 0);

const money = (value) =>
  `${numberOrZero(value).toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  })} ₽`;

const displayMoney = (value) => (numberOrZero(value) > 0 ? money(value) : '-');

const hasGeneralPlan = (plan) =>
  Boolean(plan) && numberOrZero(normalizePlanValues(plan).totalRevenue) > 0;

const hasAnyPlanValue = (plan) => {
  const values = normalizePlanValues(plan);
  return PLAN_FIELDS.some((field) => numberOrZero(values[field.key]) > 0);
};

const getShiftLabel = (shiftType) => (shiftType === 'day' ? 'День' : 'Ночь');

const formatShiftName = (item) =>
  `${format(parseISO(item.date), 'dd MMM', { locale: ru })}, ${getShiftLabel(
    item.shift_type,
  ).toLowerCase()}`;

const getStatusLabel = (item) => {
  if (hasGeneralPlan(item.data)) return 'Заполнен';
  if (hasAnyPlanValue(item.data)) return 'Нет общего';
  return 'Пусто';
};

const PlansPage = () => {
  const { session } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), 'yyyy-MM'),
  );
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState(EMPTY_PLAN_VALUES);
  const [isSaving, setIsSaving] = useState(false);
  const [quickTemplate, setQuickTemplate] = useState(EMPTY_PLAN_VALUES);
  const [bulkAction, setBulkAction] = useState('');

  const fetchPlans = useCallback(async () => {
    if (!selectedMonth) {
      setPlans([]);
      setLoadError('Выберите месяц для загрузки планов');
      return;
    }

    if (!session.activeClubId) {
      setPlans([]);
      setLoadError('Выберите активный клуб');
      return;
    }

    try {
      setIsLoading(true);
      setLoadError('');
      const response = await api.get('/api/admin/plans', {
        params: { month: selectedMonth },
      });
      setPlans(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      const message =
        error.response?.data?.message || 'Не удалось загрузить планы';
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, session.activeClubId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const planByKey = useMemo(() => {
    const map = new Map();
    plans.forEach((plan) => {
      map.set(getShiftKey(plan.date, plan.shift_type), plan);
    });
    return map;
  }, [plans]);

  const monthData = useMemo(() => {
    const dateObj = parseISO(`${selectedMonth}-01`);
    if (!isValid(dateObj)) return [];

    const daysCount = getDaysInMonth(dateObj);
    const generated = [];

    for (let day = 1; day <= daysCount; day++) {
      const dateString = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayPlan = planByKey.get(getShiftKey(dateString, 'day')) || null;
      const nightPlan = planByKey.get(getShiftKey(dateString, 'night')) || null;

      generated.push({ date: dateString, shift_type: 'day', data: dayPlan });
      generated.push({
        date: dateString,
        shift_type: 'night',
        data: nightPlan,
      });
    }

    return generated;
  }, [selectedMonth, planByKey]);

  const selectedMonthLabel = useMemo(() => {
    const dateObj = parseISO(`${selectedMonth}-01`);
    if (!isValid(dateObj)) return selectedMonth;
    return format(dateObj, 'LLLL yyyy', { locale: ru });
  }, [selectedMonth]);

  const upcomingUnfilled = useMemo(() => {
    const today = startOfDay(new Date());

    return monthData
      .filter((item) => {
        const itemDate = parseISO(item.date);
        return !isBefore(itemDate, today) && !hasGeneralPlan(item.data);
      })
      .slice(0, 8);
  }, [monthData]);

  const upcomingUnfilledKeys = useMemo(
    () =>
      new Set(
        upcomingUnfilled.map((item) => getShiftKey(item.date, item.shift_type)),
      ),
    [upcomingUnfilled],
  );

  const monthSummary = useMemo(() => {
    const filled = monthData.filter((item) => hasGeneralPlan(item.data)).length;
    return {
      filled,
      total: monthData.length,
      empty: Math.max(monthData.length - filled, 0),
    };
  }, [monthData]);

  const updateQuickTemplate = (field, value) => {
    setQuickTemplate((current) => ({
      ...current,
      [field]: numberOrZero(value),
    }));
  };

  const updateFormValue = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: numberOrZero(value),
    }));
  };

  const openEditModal = (item) => {
    setEditingPlan(item);
    setFormData({
      date: item.date,
      shift_type: item.shift_type,
      ...normalizePlanValues(item.data || EMPTY_PLAN_VALUES),
    });
  };

  const buildPlanPayload = (item, values) => ({
    date: item.date,
    shift_type: item.shift_type,
    ...withLegacyPlanFields(values),
  });

  const savePlanPayloads = async (payloads, successMessage) => {
    if (!payloads.length) {
      toast.info('Нет смен для заполнения');
      return;
    }

    try {
      setBulkAction(successMessage);
      await api.post('/api/admin/plans', {
        planData: payloads,
      });
      toast.success(`${successMessage}: ${payloads.length}`);
      await fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Не удалось сохранить планы');
    } finally {
      setBulkAction('');
    }
  };

  const fillShiftTypeFromTemplate = async (shiftType) => {
    const values = normalizePlanValues(quickTemplate);
    const categorySum = sumCategories(values);
    const payloadValues = {
      ...values,
      totalRevenue: values.totalRevenue || categorySum,
    };

    if (!payloadValues.totalRevenue && categorySum === 0) {
      toast.error('Заполните шаблон смены');
      return;
    }

    const payloads = monthData
      .filter((item) => item.shift_type === shiftType)
      .map((item) => buildPlanPayload(item, payloadValues));

    await savePlanPayloads(
      payloads,
      shiftType === 'day' ? 'Заполнены дневные смены' : 'Заполнены ночные смены',
    );
  };

  const copyFromPreviousPeriod = async (daysBack) => {
    const payloads = monthData.reduce((acc, item) => {
      if (hasGeneralPlan(item.data)) return acc;

      const sourceDate = format(subDays(parseISO(item.date), daysBack), 'yyyy-MM-dd');
      const sourcePlan = planByKey.get(getShiftKey(sourceDate, item.shift_type));

      if (!hasGeneralPlan(sourcePlan)) return acc;

      acc.push(buildPlanPayload(item, normalizePlanValues(sourcePlan)));
      return acc;
    }, []);

    await savePlanPayloads(
      payloads,
      daysBack === 1 ? 'Скопирован прошлый день' : 'Скопирована прошлая неделя',
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      await api.post('/api/admin/plans', {
        planData: buildPlanPayload(editingPlan, formData),
      });
      toast.success('План успешно сохранен');
      setEditingPlan(null);
      await fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Не удалось сохранить план');
    } finally {
      setIsSaving(false);
    }
  };

  const isBulkSaving = Boolean(bulkAction);
  const formCategorySum = sumCategories(formData);
  const templateCategorySum = sumCategories(quickTemplate);

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">Планы продаж</h1>
          <p className="mt-2 text-muted-foreground">
            Общий план управляет x2 по бару и услугам; категории нужны для
            сверки состава выручки.
          </p>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <Label htmlFor="month-picker" className="shrink-0 font-medium">
            Месяц
          </Label>
          <Input
            id="month-picker"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
      </div>

      <Card className="border-border shadow-md">
        <CardHeader>
          <CardTitle>Быстрое заполнение</CardTitle>
          <CardDescription>
            Шаблон применяется ко всем дневным или ночным сменам выбранного
            месяца.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            {PLAN_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`quick-${field.key}`}>{field.inputLabel}</Label>
                <Input
                  id={`quick-${field.key}`}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={quickTemplate[field.key]}
                  onChange={(event) =>
                    updateQuickTemplate(field.key, event.target.value)
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="font-medium">Сумма категорий:</span>{' '}
              {money(templateCategorySum)}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 2xl:min-w-[960px] 2xl:grid-cols-4">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => copyFromPreviousPeriod(1)}
                disabled={isLoading || isBulkSaving || monthData.length === 0}
              >
                {bulkAction === 'Скопирован прошлый день' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Copy />
                )}
                Скопировать прошлый день
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => copyFromPreviousPeriod(7)}
                disabled={isLoading || isBulkSaving || monthData.length === 0}
              >
                {bulkAction === 'Скопирована прошлая неделя' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CalendarDays />
                )}
                Скопировать прошлую неделю
              </Button>
              <Button
                type="button"
                className="w-full justify-center"
                onClick={() => fillShiftTypeFromTemplate('day')}
                disabled={isLoading || isBulkSaving || monthData.length === 0}
              >
                {bulkAction === 'Заполнены дневные смены' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sun />
                )}
                Заполнить дневные
              </Button>
              <Button
                type="button"
                className="w-full justify-center"
                onClick={() => fillShiftTypeFromTemplate('night')}
                disabled={isLoading || isBulkSaving || monthData.length === 0}
              >
                {bulkAction === 'Заполнены ночные смены' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Moon />
                )}
                Заполнить ночные
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-md">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Планы на {selectedMonthLabel}</CardTitle>
              <CardDescription>
                Заполнено {monthSummary.filled} из {monthSummary.total} смен.
              </CardDescription>
            </div>
            <Badge variant={monthSummary.empty === 0 ? 'default' : 'secondary'}>
              {monthSummary.empty === 0
                ? 'Месяц заполнен'
                : `Без общего плана: ${monthSummary.empty}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loadError}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={fetchPlans}
                disabled={isLoading}
              >
                Повторить
              </Button>
            </div>
          )}

          {!isLoading && !loadError && plans.length === 0 && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              На выбранный месяц планы еще не заполнены.
            </div>
          )}

          {!isLoading && !loadError && upcomingUnfilled.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Wand2 className="h-4 w-4" />
                Ближайшие смены без общего плана
              </div>
              <div className="flex flex-wrap gap-2">
                {upcomingUnfilled.map((item) => (
                  <Badge
                    key={getShiftKey(item.date, item.shift_type)}
                    variant="outline"
                    className="border-amber-500 bg-background/70"
                  >
                    {formatShiftName(item)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border">
            <Table className="min-w-[860px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[118px]">Дата</TableHead>
                  <TableHead className="w-[96px]">Смена</TableHead>
                  <TableHead className="w-[112px]">Статус</TableHead>
                  {PLAN_FIELDS.map((field) => (
                    <TableHead
                      key={field.key}
                      className={cn(
                        'text-right',
                        field.emphasis && 'font-bold text-primary',
                      )}
                    >
                      {field.shortLabel}
                    </TableHead>
                  ))}
                  <TableHead className="w-[72px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-32 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : loadError ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Данные не загружены
                    </TableCell>
                  </TableRow>
                ) : (
                  monthData.map((item, idx) => {
                    const values = normalizePlanValues(item.data || {});
                    const itemKey = getShiftKey(item.date, item.shift_type);
                    const isUpcomingUnfilled =
                      upcomingUnfilledKeys.has(itemKey);
                    const hasPlan = hasGeneralPlan(item.data);
                    const statusLabel = getStatusLabel(item);

                    return (
                      <TableRow
                        key={itemKey}
                        className={cn(
                          idx % 2 === 1
                            ? 'border-b border-border'
                            : 'border-none',
                          isUpcomingUnfilled &&
                            'bg-amber-500/10 hover:bg-amber-500/15',
                        )}
                      >
                        <TableCell className="font-medium">
                          {idx % 2 === 0
                            ? format(parseISO(item.date), 'dd MMMM', {
                                locale: ru,
                              })
                            : ''}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.shift_type === 'day'
                                ? 'outline'
                                : 'secondary'
                            }
                            className={
                              item.shift_type === 'night'
                                ? 'bg-slate-800 text-white dark:bg-slate-700'
                                : 'border-none bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500'
                            }
                          >
                            {getShiftLabel(item.shift_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={hasPlan ? 'default' : 'secondary'}
                            className={cn(
                              !hasPlan &&
                                'border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
                            )}
                          >
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        {PLAN_FIELDS.map((field) => (
                          <TableCell
                            key={field.key}
                            className={cn(
                              'text-right',
                              field.emphasis && 'font-bold text-primary',
                            )}
                          >
                            {displayMoney(values[field.key])}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            disabled={isSaving || isBulkSaving}
                            title="Редактировать план"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground group-hover/button:text-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!editingPlan}
        onOpenChange={(open) => !open && setEditingPlan(null)}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Редактирование плана</DialogTitle>
            <DialogDescription>
              {editingPlan?.date &&
                format(parseISO(editingPlan.date), 'dd MMMM yyyy', {
                  locale: ru,
                })}{' '}
              ({editingPlan?.shift_type === 'day' ? 'Дневная' : 'Ночная'} смена)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="font-medium">x2 зависит от общего плана</div>
              <p className="mt-1 text-muted-foreground">
                Бар и услуги получают x2 только когда фактическая общая выручка
                достигла поля "Общий план".
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PLAN_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className={cn(
                    'space-y-2',
                    field.key === 'totalRevenue' && 'sm:col-span-2',
                  )}
                >
                  <Label htmlFor={field.key}>{field.inputLabel}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className={field.emphasis ? 'font-bold' : ''}
                    value={formData[field.key] ?? 0}
                    onChange={(event) =>
                      updateFormValue(field.key, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">Сумма категорий</div>
                  <div className="text-muted-foreground">
                    ПК/тарифы + PS + услуги + бар/товары
                  </div>
                </div>
                <div className="text-lg font-bold text-primary">
                  {money(formCategorySum)}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPlan(null)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save />
                )}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlansPage;
