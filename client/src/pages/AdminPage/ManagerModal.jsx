import React, { useEffect, useMemo, useState } from 'react';
import api from '@/api';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SECRET_GUEST_FAILURE_REASONS = [
  { key: 'noTour', label: 'Не провели экскурсию' },
  { key: 'promotionsNotExplained', label: 'Не рассказали об акциях' },
  { key: 'scriptNotFollowed', label: 'Не соблюден скрипт' },
  { key: 'noUpsellAttempt', label: 'Не предложили более дорогую зону' },
  {
    key: 'noFoodDrinkOrServiceOffer',
    label: 'Не предложили еду, напитки или услуги',
  },
];

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

const DEFAULT_MOTIVATION = {
  taskCompletionBonus: 1200,
  penalties: {
    longMessageResponse: {
      perCase: 300,
      escalationCount: 3,
      escalationPenalty: 1200,
    },
    uncleanClub: {
      basePenalty: 600,
      thresholdPlaces: 5,
      escalationPenalty: 1200,
    },
    dirtyKitchen: 1200,
    missedCallNoCallback: 300,
    messyWorkspace: 400,
    strangersBehindDesk: 500,
    climateControl: 200,
    fridgeNotFilled: 300,
    loudSwearingPerCase: 100,
    secretGuestFailed: 1200,
  },
};

const DEFAULT_SHIFT_CHECK = {
  allTasksCompleted: false,
  longMessageResponseCount: 0,
  uncleanClubPlacesCount: 0,
  dirtyKitchen: false,
  missedCallNoCallbackCount: 0,
  messyWorkspace: false,
  strangersBehindDesk: false,
  climateControlIssue: false,
  fridgeNotFilled: false,
  loudSwearingCount: 0,
  secretGuestFailed: false,
  secretGuestFailureReasons: Object.fromEntries(
    SECRET_GUEST_FAILURE_REASONS.map((item) => [item.key, false]),
  ),
};

const toMoney = (value) => Math.floor(Number(value) || 0);

const money = (value) => `${toMoney(value).toLocaleString('ru-RU')} ₽`;

const signedMoney = (value) => {
  const amount = toMoney(value);
  if (amount > 0) return `+${money(amount)}`;
  if (amount < 0) return `-${money(Math.abs(amount))}`;
  return money(0);
};

const mergeShiftCheck = (check = {}) => ({
  ...DEFAULT_SHIFT_CHECK,
  ...check,
  secretGuestFailureReasons: {
    ...DEFAULT_SHIFT_CHECK.secretGuestFailureReasons,
    ...(check.secretGuestFailureReasons || {}),
  },
});

const normalizeMotivation = (settings = {}) => ({
  ...DEFAULT_MOTIVATION,
  ...settings,
  penalties: {
    ...DEFAULT_MOTIVATION.penalties,
    ...(settings.penalties || {}),
    longMessageResponse: {
      ...DEFAULT_MOTIVATION.penalties.longMessageResponse,
      ...(settings.penalties?.longMessageResponse || {}),
    },
    uncleanClub: {
      ...DEFAULT_MOTIVATION.penalties.uncleanClub,
      ...(settings.penalties?.uncleanClub || {}),
    },
  },
});

const addPenalty = (items, key, amount, meta = {}) => {
  const moneyAmount = toMoney(amount);
  if (moneyAmount <= 0) return;

  items.push({
    key,
    label: CHECK_LABELS[key] || key,
    amount: moneyAmount,
    ...meta,
  });
};

const calculatePenalties = (shiftCheck, motivation) => {
  const check = mergeShiftCheck(shiftCheck);
  const penalties = motivation.penalties || {};
  const items = [];

  const longMessageRules = penalties.longMessageResponse || {};
  const longMessageCount = toNonNegativeInteger(
    check.longMessageResponseCount,
  );
  if (longMessageCount > 0) {
    const escalationCount = Number(longMessageRules.escalationCount) || 3;
    const amount =
      longMessageCount >= escalationCount
        ? longMessageRules.escalationPenalty
        : longMessageCount * longMessageRules.perCase;
    addPenalty(items, 'longMessageResponseCount', amount, {
      count: longMessageCount,
    });
  }

  const uncleanRules = penalties.uncleanClub || {};
  const uncleanPlacesCount = toNonNegativeInteger(
    check.uncleanClubPlacesCount,
  );
  if (uncleanPlacesCount > 0) {
    const thresholdPlaces = Number(uncleanRules.thresholdPlaces) || 5;
    const amount =
      uncleanPlacesCount > thresholdPlaces
        ? uncleanRules.escalationPenalty
        : uncleanRules.basePenalty;
    addPenalty(items, 'uncleanClubPlacesCount', amount, {
      count: uncleanPlacesCount,
    });
  }

  if (check.dirtyKitchen) {
    addPenalty(items, 'dirtyKitchen', penalties.dirtyKitchen);
  }

  const missedCallCount = toNonNegativeInteger(check.missedCallNoCallbackCount);
  if (missedCallCount > 0) {
    addPenalty(
      items,
      'missedCallNoCallbackCount',
      missedCallCount * penalties.missedCallNoCallback,
      { count: missedCallCount },
    );
  }

  if (check.messyWorkspace) {
    addPenalty(items, 'messyWorkspace', penalties.messyWorkspace);
  }

  if (check.strangersBehindDesk) {
    addPenalty(items, 'strangersBehindDesk', penalties.strangersBehindDesk);
  }

  if (check.climateControlIssue) {
    addPenalty(items, 'climateControlIssue', penalties.climateControl);
  }

  if (check.fridgeNotFilled) {
    addPenalty(items, 'fridgeNotFilled', penalties.fridgeNotFilled);
  }

  const loudSwearingCount = toNonNegativeInteger(check.loudSwearingCount);
  if (loudSwearingCount > 0) {
    addPenalty(
      items,
      'loudSwearingCount',
      loudSwearingCount * penalties.loudSwearingPerCase,
      { count: loudSwearingCount },
    );
  }

  const failedSecretGuestReasons = Object.entries(
    check.secretGuestFailureReasons || {},
  )
    .filter(([, failed]) => failed === true)
    .map(([key]) =>
      SECRET_GUEST_FAILURE_REASONS.find((item) => item.key === key),
    )
    .filter(Boolean);

  if (check.secretGuestFailed || failedSecretGuestReasons.length > 0) {
    addPenalty(items, 'secretGuestFailed', penalties.secretGuestFailed, {
      reasons: failedSecretGuestReasons,
    });
  }

  return {
    total: items.reduce((sum, item) => sum + item.amount, 0),
    items,
  };
};

const CounterField = ({ id, label, value, disabled, onChange }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="number"
      min="0"
      step="1"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);

const CheckboxField = ({ id, label, checked, disabled, onChange }) => (
  <label
    htmlFor={id}
    className="flex items-start gap-3 rounded-md border border-border p-3 text-sm font-medium leading-snug"
  >
    <Checkbox
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onChange(value === true)}
      className="mt-0.5"
    />
    <span>{label}</span>
  </label>
);

const toNonNegativeInteger = (value) => {
  const number = Number.parseInt(String(value || 0), 10);
  return Number.isInteger(number) && number >= 0 ? number : 0;
};

const PreviewLine = ({ label, value, tone = 'default', detail }) => {
  const toneClass =
    tone === 'positive'
      ? 'text-green-600'
      : tone === 'negative'
        ? 'text-red-600'
        : 'text-foreground';

  return (
    <div className="flex items-start justify-between gap-3 text-sm">
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

const ManagerModal = ({
  modalOpen,
  setModalOpen,
  canConfirm = false,
  onConfirmed,
  currentAwardsObject,
}) => {
  const [shiftCheck, setShiftCheck] = useState(DEFAULT_SHIFT_CHECK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      setShiftCheck(
        mergeShiftCheck(
          currentAwardsObject?.responsibilitiesCheck?.checklist || {},
        ),
      );
    }
  }, [modalOpen]);

  const preview = useMemo(() => {
    const payoutBreakdown = currentAwardsObject?.payoutBreakdown || {};
    const motivation = normalizeMotivation(payoutBreakdown.motivationSettings);
    const normalizedCheck = mergeShiftCheck(shiftCheck);
    const hasSecretGuestReasonFailure = Object.values(
      normalizedCheck.secretGuestFailureReasons || {},
    ).some(Boolean);

    if (hasSecretGuestReasonFailure) {
      normalizedCheck.secretGuestFailed = true;
    }

    const penalties = calculatePenalties(normalizedCheck, motivation);
    const baseSalary = toMoney(
      currentAwardsObject?.baseSalary ?? payoutBreakdown.baseSalary?.amount,
    );
    const barBonus = toMoney(
      currentAwardsObject?.barBonus ?? payoutBreakdown.bonuses?.bar?.amount,
    );
    const servicesBonus = toMoney(
      currentAwardsObject?.servicesBonus ??
        payoutBreakdown.bonuses?.services?.amount,
    );
    const taskBonusConfigured = toMoney(
      payoutBreakdown.taskCompletionBonus?.configured ??
        motivation.taskCompletionBonus,
    );
    const taskCompletionBonus =
      normalizedCheck.allTasksCompleted && penalties.total === 0
        ? taskBonusConfigured
        : 0;
    const totalAward =
      baseSalary +
      taskCompletionBonus +
      barBonus +
      servicesBonus -
      penalties.total;
    const currentTotalAward = toMoney(currentAwardsObject?.totalAward);

    return {
      baseSalary,
      barBonus,
      servicesBonus,
      taskCompletionBonus,
      taskBonusConfigured,
      penalties,
      totalAward,
      checkImpact: taskCompletionBonus - penalties.total,
      delta: totalAward - currentTotalAward,
      allTasksCompleted: normalizedCheck.allTasksCompleted,
    };
  }, [currentAwardsObject, shiftCheck]);

  const updateField = (key, value) => {
    setShiftCheck((prev) => ({ ...prev, [key]: value }));
  };

  const updateCounter = (key, value) => {
    updateField(key, toNonNegativeInteger(value));
  };

  const updateSecretGuestReason = (key, value) => {
    setShiftCheck((prev) => ({
      ...prev,
      secretGuestFailed: value ? true : prev.secretGuestFailed,
      secretGuestFailureReasons: {
        ...prev.secretGuestFailureReasons,
        [key]: value,
      },
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!canConfirm) {
      toast.error('Недостаточно прав для подтверждения проверки смены');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        '/api/admin/approveAdminResponsibilities',
        { adminResponsibilities: shiftCheck },
        { validateStatus: () => true },
      );

      if (!response.data.error) {
        toast.success('Проверка смены сохранена');
        setModalOpen(false);
        await onConfirmed?.();
      } else {
        toast.error(response.data.message || 'Не удалось сохранить проверку');
      }
    } catch (error) {
      toast.error('Ошибка сервера при сохранении проверки');
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !canConfirm;

  return (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Проверка смены</DialogTitle>
          <DialogDescription>
            Задачи, нарушения и влияние проверки на выплату.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-6">
          <CheckboxField
            id="allTasksCompleted"
            label="Все задачи по смене выполнены"
            checked={shiftCheck.allTasksCompleted}
            disabled={disabled}
            onChange={(value) => updateField('allTasksCompleted', value)}
          />

          <div className="rounded-md border border-border bg-muted/30 p-4">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Предпросмотр выплаты</h3>
                <p className="text-xs text-muted-foreground">
                  После сохранения: {money(preview.totalAward)}
                </p>
              </div>
              <div
                className={`text-left text-lg font-bold sm:text-right ${
                  preview.delta > 0
                    ? 'text-green-600'
                    : preview.delta < 0
                      ? 'text-red-600'
                      : 'text-foreground'
                }`}
              >
                {signedMoney(preview.delta)}
              </div>
            </div>

            {!preview.allTasksCompleted && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Все задачи не отмечены: бонус{' '}
                  {money(preview.taskBonusConfigured)} не начислится.
                </span>
              </div>
            )}

            <div className="space-y-3">
              <PreviewLine
                label="База смены"
                value={money(preview.baseSalary)}
              />
              <PreviewLine
                label="Бонус за все задачи"
                value={`+${money(preview.taskCompletionBonus)}`}
                tone={preview.taskCompletionBonus > 0 ? 'positive' : 'default'}
                detail={
                  preview.allTasksCompleted && preview.penalties.total > 0
                    ? 'Не начислится, пока есть штрафы'
                    : `Доступно ${money(preview.taskBonusConfigured)}`
                }
              />
              <PreviewLine
                label="Бар"
                value={`+${money(preview.barBonus)}`}
                tone={preview.barBonus > 0 ? 'positive' : 'default'}
              />
              <PreviewLine
                label="Услуги"
                value={`+${money(preview.servicesBonus)}`}
                tone={preview.servicesBonus > 0 ? 'positive' : 'default'}
              />
              {preview.penalties.items.length > 0 ? (
                preview.penalties.items.map((penalty) => (
                  <PreviewLine
                    key={`${penalty.key}-${penalty.count || 'one'}`}
                    label={penalty.label}
                    value={`-${money(penalty.amount)}`}
                    tone="negative"
                    detail={
                      penalty.count
                        ? `Количество: ${penalty.count}`
                        : penalty.reasons?.length
                          ? penalty.reasons
                              .map((reason) => reason.label)
                              .join(', ')
                          : null
                    }
                  />
                ))
              ) : (
                <PreviewLine
                  label="Штрафы"
                  value={money(0)}
                  detail="Нет штрафов"
                />
              )}
            </div>

            <div className="mt-4 flex flex-col gap-1 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">Итоговое влияние проверки</span>
              <span
                className={`text-lg font-bold ${
                  preview.checkImpact > 0
                    ? 'text-green-600'
                    : preview.checkImpact < 0
                      ? 'text-red-600'
                      : 'text-foreground'
                }`}
              >
                {signedMoney(preview.checkImpact)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CounterField
              id="longMessageResponseCount"
              label="Долгие или неотвеченные сообщения"
              value={shiftCheck.longMessageResponseCount}
              disabled={disabled}
              onChange={(value) =>
                updateCounter('longMessageResponseCount', value)
              }
            />
            <CounterField
              id="uncleanClubPlacesCount"
              label="Неприбранные места в клубе"
              value={shiftCheck.uncleanClubPlacesCount}
              disabled={disabled}
              onChange={(value) =>
                updateCounter('uncleanClubPlacesCount', value)
              }
            />
            <CounterField
              id="missedCallNoCallbackCount"
              label="Пропущенные звонки без перезвона"
              value={shiftCheck.missedCallNoCallbackCount}
              disabled={disabled}
              onChange={(value) =>
                updateCounter('missedCallNoCallbackCount', value)
              }
            />
            <CounterField
              id="loudSwearingCount"
              label="Случаи громкого мата"
              value={shiftCheck.loudSwearingCount}
              disabled={disabled}
              onChange={(value) => updateCounter('loudSwearingCount', value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CheckboxField
              id="dirtyKitchen"
              label="Беспорядок или грязь на кухне"
              checked={shiftCheck.dirtyKitchen}
              disabled={disabled}
              onChange={(value) => updateField('dirtyKitchen', value)}
            />
            <CheckboxField
              id="messyWorkspace"
              label="Беспорядок на рабочем месте"
              checked={shiftCheck.messyWorkspace}
              disabled={disabled}
              onChange={(value) => updateField('messyWorkspace', value)}
            />
            <CheckboxField
              id="strangersBehindDesk"
              label="Посторонние за стойкой"
              checked={shiftCheck.strangersBehindDesk}
              disabled={disabled}
              onChange={(value) => updateField('strangersBehindDesk', value)}
            />
            <CheckboxField
              id="climateControlIssue"
              label="Проблема с климат-контролем"
              checked={shiftCheck.climateControlIssue}
              disabled={disabled}
              onChange={(value) => updateField('climateControlIssue', value)}
            />
            <CheckboxField
              id="fridgeNotFilled"
              label="Холодильники не заполнены"
              checked={shiftCheck.fridgeNotFilled}
              disabled={disabled}
              onChange={(value) => updateField('fridgeNotFilled', value)}
            />
            <CheckboxField
              id="secretGuestFailed"
              label="Тайный гость провален"
              checked={shiftCheck.secretGuestFailed}
              disabled={disabled}
              onChange={(value) => updateField('secretGuestFailed', value)}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              Причины тайного гостя
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SECRET_GUEST_FAILURE_REASONS.map((reason) => (
                <CheckboxField
                  key={reason.key}
                  id={`secret-${reason.key}`}
                  label={reason.label}
                  checked={shiftCheck.secretGuestFailureReasons[reason.key]}
                  disabled={disabled}
                  onChange={(value) =>
                    updateSecretGuestReason(reason.key, value)
                  }
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={disabled}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerModal;
