import React, { useEffect, useMemo, useState } from 'react';
import api from '@/api';
import { useAuth } from '@/lib/auth-context';
import { CLUB_ROLES, isPlatformAdminSession } from '@/lib/auth-session';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import ManagerModal from './ManagerModal';

const CHECK_LABELS = {
  allTasksCompleted: 'Все задачи выполнены',
  longMessageResponseCount: 'Долгие или неотвеченные сообщения',
  uncleanClubPlacesCount: 'Неприбранные места в клубе',
  dirtyKitchen: 'Беспорядок или грязь на кухне',
  missedCallNoCallbackCount: 'Пропущенные звонки без перезвона',
  messyWorkspace: 'Беспорядок на рабочем месте',
  strangersBehindDesk: 'Посторонние за стойкой',
  climateControlIssue: 'Проблема с климат-контролем',
  fridgeNotFilled: 'Холодильники не заполнены',
  loudSwearingCount: 'Громкий мат',
  secretGuestFailed: 'Провал тайного гостя',
};

const DEFAULT_CURRENT_STATS = {
  totalRevenue: 0,
  barRevenue: 0,
  goodsRevenue: 0,
  servicesRevenue: 0,
  psRevenue: 0,
  psServiceRevenue: 0,
  pcRevenue: 0,
};

const DEFAULT_PLAN_STATS = {
  totalRevenue: 0,
  foodRevenue: 0,
  chocolateRevenue: 0,
  drinksRevenue: 0,
  psServiceRevenue: 0,
  pcRevenue: 0,
  isConfigured: false,
};

const DEFAULT_AWARDS = {
  baseSalary: 0,
  taskCompletionBonus: 0,
  penaltiesTotal: 0,
  penaltiesBreakdown: [],
  barBonus: 0,
  servicesBonus: 0,
  planMultiplierApplied: false,
  totalAward: 0,
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const toMoneyNumber = (value) => Math.floor(Number(value) || 0);

const money = (value) => `${toMoneyNumber(value).toLocaleString('ru-RU')} ₽`;

const percent = (fact, plan) =>
  plan > 0 ? Math.floor(((Number(fact) || 0) / plan) * 100) : 0;

const ratePercent = (rate) => `${Math.round((Number(rate) || 0) * 100)}%`;

const Statistic = ({ title, value, subtext, isGoalMet, valueClass }) => (
  <div className="min-w-0 space-y-1">
    <span className="text-sm font-medium text-muted-foreground">{title}</span>
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={`${valueClass || 'text-2xl font-bold'} ${isGoalMet ? 'text-green-600' : ''}`}
      >
        {value}
      </span>
      {subtext && (
        <span className="text-sm font-medium text-muted-foreground">
          {subtext}
        </span>
      )}
    </div>
  </div>
);

const PayoutLine = ({ label, value, tone = 'default', detail }) => {
  const toneClass =
    tone === 'positive'
      ? 'text-green-600'
      : tone === 'negative'
        ? 'text-red-600'
        : 'text-foreground';

  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {detail && (
          <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
        )}
      </div>
      <div className={`shrink-0 text-right font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
};

const DecisionMetric = ({ title, value, detail, tone = 'default', badge }) => {
  const toneClass =
    tone === 'positive'
      ? 'text-green-600'
      : tone === 'warning'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-foreground';

  return (
    <div className="min-w-0 rounded-md border border-border bg-background p-4">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-muted-foreground">
          {title}
        </span>
        {badge}
      </div>
      <div className={`break-words text-2xl font-bold ${toneClass}`}>
        {value}
      </div>
      {detail && (
        <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
      )}
    </div>
  );
};

const AdminPage = () => {
  const { session } = useAuth();
  const canConfirmChecklist =
    isPlatformAdminSession(session) ||
    [CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER].includes(session.activeClubRole);

  const [currentStatsObject, setCurrentStatsObject] =
    useState(DEFAULT_CURRENT_STATS);
  const [planStatsObject, setPlanStatsObject] = useState(DEFAULT_PLAN_STATS);
  const [currentAwardsObject, setCurrentAwardsObject] =
    useState(DEFAULT_AWARDS);
  const [currentWorkshift, setCurrentWorkshift] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

  const formatDate = (date) => {
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const getWorkshiftDuration = () => {
    if (!currentWorkshift?.created_at) return '—';
    const createdAtDate = new Date(
      currentWorkshift.created_at.replace(' ', 'T') + '+03:00',
    );
    const now = new Date();
    const diffInMinutes = Math.floor((now - createdAtDate) / 1000 / 60);
    return `${Math.floor(diffInMinutes / 60)} ч ${diffInMinutes % 60} мин`;
  };

  const getShiftType = () => {
    if (!currentWorkshift?.created_at) return '—';
    const hours = new Date(
      currentWorkshift.created_at.replace(' ', 'T') + '+03:00',
    ).getHours();
    return hours >= 6 && hours < 12
      ? 'День'
      : hours >= 18 && hours < 24
        ? 'Ночь'
        : '—';
  };

  const resetShiftStats = () => {
    setCurrentStatsObject(DEFAULT_CURRENT_STATS);
    setPlanStatsObject(DEFAULT_PLAN_STATS);
    setCurrentAwardsObject(DEFAULT_AWARDS);
  };

  const getAdminStatsData = async () => {
    if (!session.activeClubId) {
      setCurrentWorkshift(null);
      resetShiftStats();
      setLoadError('Выберите активный клуб для просмотра смены');
      setIsInitialLoad(false);
      setIsRefreshing(false);
      return;
    }

    try {
      setIsRefreshing(true);
      setLoadError('');
      const responseWorkshift = await api.get('/api/admin/getActiveWorkshift');
      const activeWorkshift = responseWorkshift.data?.currentWorkshift;

      if (!activeWorkshift || !activeWorkshift.created_at) {
        setCurrentWorkshift(null);
        resetShiftStats();
        return;
      }

      setCurrentWorkshift(activeWorkshift);

      const now = new Date();
      let startDate = activeWorkshift.created_at;
      let endDate;
      const createdAt = new Date(
        activeWorkshift.created_at.replace(' ', 'T') + '+03:00',
      );
      const hours = createdAt.getHours();

      if (hours >= 6 && hours < 12) {
        const end = new Date(now);
        end.setHours(21, 0, 0, 0);
        endDate = formatDate(end);
      } else if (hours >= 18 && hours < 24) {
        const end = new Date(createdAt);
        end.setDate(createdAt.getDate() + 1);
        end.setHours(9, 0, 0, 0);
        endDate = formatDate(end);
      }

      if (!endDate) {
        resetShiftStats();
        setLoadError('Текущая смена открыта вне поддерживаемого окна');
        return;
      }

      const responseStats = await api.get('/api/admin/currentStats', {
        params: { startDate, endDate },
      });

      if (responseStats?.data) {
        setCurrentStatsObject({
          ...DEFAULT_CURRENT_STATS,
          ...(responseStats.data.currentStatsObject || {}),
        });
        setPlanStatsObject({
          ...DEFAULT_PLAN_STATS,
          ...(responseStats.data.planStatsObject || {}),
        });
        setCurrentAwardsObject({
          ...DEFAULT_AWARDS,
          ...(responseStats.data.currentAwardsObject || {}),
        });
      }
    } catch (error) {
      setCurrentWorkshift(null);
      resetShiftStats();
      setLoadError(
        getErrorMessage(
          error,
          'Не удалось получить данные смены из Smartshell',
        ),
      );
    } finally {
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsInitialLoad(true);
    getAdminStatsData();
    const intervalId = setInterval(getAdminStatsData, 60000);
    return () => clearInterval(intervalId);
  }, [session.activeClubId]);

  const breakdown = currentAwardsObject?.payoutBreakdown || {};
  const planBreakdown = breakdown.plan || {};
  const bonusBreakdown = breakdown.bonuses || {};
  const penalties = breakdown.penalties || {
    total: currentAwardsObject.penaltiesTotal || 0,
    items: currentAwardsObject.penaltiesBreakdown || [],
  };
  const taskBonus = breakdown.taskCompletionBonus || {};
  const hasPlanForShift = Boolean(
    planStatsObject?.isConfigured || planStatsObject?.id,
  );
  const totalPlan = planStatsObject?.totalRevenue || 0;
  const totalFact = currentStatsObject?.totalRevenue || 0;
  const totalNeed = totalPlan - totalFact;
  const remainingToX2 = Math.max(totalNeed, 0);
  const planCompleted =
    planBreakdown.isCompleted ||
    (hasPlanForShift && totalPlan > 0 && totalFact >= totalPlan);
  const planProgress = Math.min(percent(totalFact, totalPlan), 100);
  const check = currentAwardsObject?.responsibilitiesCheck;
  const configuredTaskBonus = toMoneyNumber(
    taskBonus.configured ?? currentAwardsObject?.taskCompletionBonus,
  );
  const savedCheckList = check?.checklist || {};
  const payoutWithoutPenalties =
    toMoneyNumber(currentAwardsObject?.baseSalary) +
    (savedCheckList.allTasksCompleted === true
      ? configuredTaskBonus
      : toMoneyNumber(currentAwardsObject?.taskCompletionBonus)) +
    toMoneyNumber(currentAwardsObject?.barBonus) +
    toMoneyNumber(currentAwardsObject?.servicesBonus);
  const penaltyLoss = Math.max(
    payoutWithoutPenalties - toMoneyNumber(currentAwardsObject?.totalAward),
    0,
  );
  const x2RateDetail = planCompleted
    ? `Бар ${ratePercent(bonusBreakdown.bar?.rate)}, услуги ${ratePercent(
        bonusBreakdown.services?.rate,
      )}`
    : `После плана: бар ${ratePercent(
        (bonusBreakdown.bar?.baseRate || 0) * (planBreakdown.multiplier || 2),
      )}, услуги ${ratePercent(
        (bonusBreakdown.services?.baseRate || 0) *
          (planBreakdown.multiplier || 2),
      )}`;
  const notPassedItems = useMemo(() => {
    const items = check?.notPassedItems;
    if (Array.isArray(items) && items.length) return items;

    return (check?.notPassed || []).map((key) => ({
      key,
      label: CHECK_LABELS[key] || key,
    }));
  }, [check]);

  const adminName = currentWorkshift?.worker
    ? `${currentWorkshift.worker.first_name} ${currentWorkshift.worker.last_name}`
    : 'Неизвестный админ';
  const shiftType = getShiftType();
  const shiftPhrase =
    shiftType === 'День'
      ? 'дневная смена'
      : shiftType === 'Ночь'
        ? 'ночная смена'
        : 'смена';
  const shiftBadge =
    shiftType === 'День'
      ? 'Дневная смена'
      : shiftType === 'Ночь'
        ? 'Ночная смена'
        : 'Смена';

  const handleCopy = () => {
    const checkStatus =
      check?.status === 'ok'
        ? 'пройдена'
        : check?.status === 'fail'
          ? `есть нарушения: ${notPassedItems.map((item) => item.label).join(', ')}`
          : 'не подтверждена';

    const textToCopy = `
${currentWorkshift?.created_at?.split(' ')[0] || '-'} - ${getShiftType()}
Админ: ${adminName}
Начало: ${currentWorkshift?.created_at?.split(' ')[1] || '-'}
Продолжительность: ${getWorkshiftDuration()}

Выручка:
Общая: ${totalFact}/${totalPlan} (${percent(totalFact, totalPlan)}%)
Бар: ${currentStatsObject?.barRevenue || currentStatsObject?.goodsRevenue || 0}
Услуги: ${currentStatsObject?.servicesRevenue || 0}
PS: ${currentStatsObject?.psRevenue || 0}
ПК: ${currentStatsObject?.pcRevenue || 0}

Выплата:
База: ${currentAwardsObject?.baseSalary || 0}₽
Бонус за задачи: ${currentAwardsObject?.taskCompletionBonus || 0}₽
Бар: ${currentAwardsObject?.barBonus || 0}₽
Услуги: ${currentAwardsObject?.servicesBonus || 0}₽
Штрафы: ${penalties.total > 0 ? `-${penalties.total}` : 0}₽
Итого: ${currentAwardsObject?.totalAward || 0}₽

Проверка смены: ${checkStatus}
    `.trim();
    navigator.clipboard.writeText(textToCopy);
  };

  const LoadingSkeleton = () => (
    <div className="flex min-h-[50vh] items-center justify-center gap-2 p-12 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      Загрузка данных Smartshell...
    </div>
  );

  if (isInitialLoad)
    return (
      <div className="space-y-8 p-4 md:p-8">
        <LoadingSkeleton />
      </div>
    );

  if (loadError)
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-lg p-6 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="mb-3 text-xl font-bold">
            Не удалось загрузить смену
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={getAdminStatsData} disabled={isRefreshing}>
            {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Повторить
          </Button>
        </Card>
      </div>
    );

  if (!currentWorkshift)
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-md p-6 text-center shadow-md">
          <h3 className="mb-3 text-xl font-bold">Активная смена не открыта</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Сейчас в Smartshell нет открытой рабочей смены для активного клуба.
          </p>
          <Button onClick={getAdminStatsData} disabled={isRefreshing}>
            {isRefreshing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Обновить
          </Button>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-8 p-4 md:p-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold md:text-3xl">
            Панель администратора
          </h1>
          {isRefreshing && (
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              title="Обновление данных..."
            />
          )}
        </div>
        <p className="mt-2 text-muted-foreground">
          Статистика текущей смены и расчет выплаты.
        </p>
      </div>

      <Card className="shadow-md">
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold">Главное по смене</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {adminName}, {shiftPhrase}, в работе {getWorkshiftDuration()}.
              </p>
            </div>
            <Badge variant={planCompleted ? 'default' : 'secondary'}>
              {planCompleted ? 'x2 применён' : 'x2 не применён'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DecisionMetric
              title="Текущая выплата"
              value={money(currentAwardsObject?.totalAward)}
              detail="Итог с учетом проверки смены"
            />
            <DecisionMetric
              title="Осталось до x2"
              value={
                hasPlanForShift
                  ? planCompleted
                    ? 'x2 уже открыт'
                    : money(remainingToX2)
                  : 'План не задан'
              }
              detail={
                hasPlanForShift
                  ? `Общий план: ${money(totalFact)} из ${money(totalPlan)}`
                  : 'Добавьте общий план смены'
              }
              tone={planCompleted ? 'positive' : 'warning'}
            />
            <DecisionMetric
              title="Статус x2"
              value={planCompleted ? 'Применён' : 'Не применён'}
              detail={hasPlanForShift ? x2RateDetail : 'Нет общего плана'}
              tone={planCompleted ? 'positive' : 'default'}
            />
            <DecisionMetric
              title="Без штрафов"
              value={money(payoutWithoutPenalties)}
              detail={
                penaltyLoss > 0
                  ? `Штрафы снижают итог на ${money(penaltyLoss)}`
                  : 'Штрафы не снижают итог'
              }
              tone={penaltyLoss > 0 ? 'warning' : 'positive'}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">Прогресс общего плана</span>
              <span className="text-muted-foreground">
                {hasPlanForShift ? `${percent(totalFact, totalPlan)}%` : '—'}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  planCompleted ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: hasPlanForShift ? `${planProgress}%` : '0%' }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasPlanForShift && (
        <Card className="border-amber-500/40 bg-amber-500/10 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">План на смену не задан</div>
              <p className="text-sm text-muted-foreground">
                x2 процентов не применяется без общего плана на смену.
              </p>
            </div>
            <Button variant="outline" onClick={getAdminStatsData}>
              Обновить
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <Card className="border-border shadow-md">
            <CardHeader>
              <CardTitle>Сводка выручки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Statistic
                  title="Бар"
                  value={money(
                    currentStatsObject?.barRevenue ||
                      currentStatsObject?.goodsRevenue,
                  )}
                />
                <Statistic
                  title="Услуги"
                  value={money(currentStatsObject?.servicesRevenue)}
                />
                <Statistic
                  title="PS"
                  value={money(currentStatsObject?.psRevenue)}
                />
                <Statistic
                  title="ПК"
                  value={money(currentStatsObject?.pcRevenue)}
                />
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Statistic title="Общая выручка" value={money(totalFact)} />
                <Statistic
                  title="Общий план"
                  value={hasPlanForShift ? money(totalPlan) : '—'}
                />
                <Statistic
                  title="Выполнение"
                  value={`${percent(totalFact, totalPlan)}%`}
                  isGoalMet={planCompleted}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8 lg:col-span-5">
          <Card className="border-border shadow-md">
            <CardContent className="p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="min-w-0 text-lg font-semibold">{adminName}</h4>
                <Badge variant="secondary">{shiftBadge}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Statistic
                  title="Начало"
                  value={
                    currentWorkshift?.created_at
                      ? currentWorkshift.created_at.split(' ')[1]
                      : '—'
                  }
                  valueClass="text-xl font-semibold"
                />
                <Statistic
                  title="В работе"
                  value={getWorkshiftDuration()}
                  valueClass="text-xl font-semibold"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Выплата за смену</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <PayoutLine
                  label="База смены"
                  value={money(currentAwardsObject?.baseSalary)}
                  detail={shiftBadge}
                />
                <PayoutLine
                  label="Бонус за все задачи"
                  value={`+${money(currentAwardsObject?.taskCompletionBonus)}`}
                  tone={
                    currentAwardsObject?.taskCompletionBonus > 0
                      ? 'positive'
                      : 'default'
                  }
                  detail={`Доступно ${money(taskBonus.configured || 0)}`}
                />
                <PayoutLine
                  label="Бар"
                  value={`+${money(currentAwardsObject?.barBonus)}`}
                  tone={
                    currentAwardsObject?.barBonus > 0 ? 'positive' : 'default'
                  }
                  detail={`${money(bonusBreakdown.bar?.revenue)} x ${ratePercent(bonusBreakdown.bar?.rate)}`}
                />
                <PayoutLine
                  label="Услуги"
                  value={`+${money(currentAwardsObject?.servicesBonus)}`}
                  tone={
                    currentAwardsObject?.servicesBonus > 0
                      ? 'positive'
                      : 'default'
                  }
                  detail={`${money(bonusBreakdown.services?.revenue)} x ${ratePercent(bonusBreakdown.services?.rate)}`}
                />
                <PayoutLine
                  label="Штрафы"
                  value={
                    penalties.total > 0 ? `-${money(penalties.total)}` : money(0)
                  }
                  tone={penalties.total > 0 ? 'negative' : 'default'}
                  detail={
                    penalties.total > 0
                      ? `${penalties.items?.length || 0} наруш.`
                      : 'Нет штрафов'
                  }
                />
              </div>

              {penalties.items?.length > 0 && (
                <div className="space-y-2 rounded-md border border-red-500/20 bg-red-500/5 p-3">
                  {penalties.items.map((penalty) => (
                    <PayoutLine
                      key={`${penalty.key}-${penalty.count || ''}`}
                      label={penalty.label}
                      value={`-${money(penalty.amount)}`}
                      tone="negative"
                      detail={
                        penalty.count ? `Количество: ${penalty.count}` : null
                      }
                    />
                  ))}
                </div>
              )}

              {planBreakdown.multiplierApplied && (
                <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Применен x{planBreakdown.multiplier || 2} к процентам бара и
                  услуг
                </div>
              )}

              <Separator />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-lg font-medium">Итого к выплате:</span>
                <span className="whitespace-nowrap text-3xl font-bold text-primary">
                  {money(currentAwardsObject?.totalAward)}
                </span>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button
                  className="w-full"
                  onClick={() => setIsManagerModalOpen(true)}
                  disabled={
                    !currentWorkshift?.created_at || !canConfirmChecklist
                  }
                >
                  {canConfirmChecklist
                    ? 'Проверить смену'
                    : 'Проверка недоступна'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Скопировать отчет"
                  disabled={!currentWorkshift?.created_at}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Проверка смены</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                {check?.status === 'ok' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : check?.status === 'fail' ? (
                  <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                ) : (
                  <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
                )}
                <span className="font-medium">
                  {check?.status === 'ok'
                    ? 'Проверка пройдена'
                    : check?.status === 'fail'
                      ? 'Есть нарушения'
                      : 'Проверка не сохранена'}
                </span>
              </div>

              {notPassedItems.length > 0 && (
                <ul className="space-y-2">
                  {notPassedItems.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-start gap-2 text-sm text-red-600"
                    >
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              )}

              {penalties.items?.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {penalties.items.map((penalty) => (
                      <PayoutLine
                        key={`${penalty.key}-${penalty.count || ''}`}
                        label={penalty.label}
                        value={`-${money(penalty.amount)}`}
                        tone="negative"
                        detail={
                          penalty.count ? `Количество: ${penalty.count}` : null
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ManagerModal
        modalOpen={isManagerModalOpen}
        setModalOpen={setIsManagerModalOpen}
        canConfirm={canConfirmChecklist}
        onConfirmed={getAdminStatsData}
        currentAwardsObject={currentAwardsObject}
      />
    </div>
  );
};

export default AdminPage;
