import React from 'react';
import { LockKeyhole, RotateCcw, ServerCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const DEFAULT_MOTIVATION = {
  basePay: {
    day: 1000,
    night: 1200,
  },
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
  bonusRates: {
    bar: 0.05,
    services: 0.1,
    planMultiplier: 2,
  },
};

export const MOTIVATION_PRESET_NAME = 'Правила от 04.07.2026';

const toInputDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 10);
};

const valueToString = (value, fallback = '') =>
  value === null || value === undefined ? String(fallback) : String(value);

const numberToInputString = (value, fallback = '') => {
  const number = Number(value);
  if (!Number.isFinite(number)) return valueToString(fallback);

  const normalized = Number(number.toFixed(4));
  return String(normalized);
};

const rateToPercentString = (value, fallback) => {
  const rawValue = value ?? fallback;
  const number = Number(rawValue);
  if (!Number.isFinite(number)) return numberToInputString(fallback * 100);

  return numberToInputString(number > 1 ? number : number * 100);
};

const percentToRate = (value) => Number(value) / 100;

const getSettings = (club = {}) => club.settings || {};

const normalizeMotivation = (settings = {}) => {
  const motivation = settings.motivation || {};
  const legacyBonusRates = settings.bonusRates || {};
  const basePay = motivation.basePay || {};
  const penalties = motivation.penalties || {};
  const longMessageResponse = penalties.longMessageResponse || {};
  const uncleanClub = penalties.uncleanClub || {};
  const bonusRates = motivation.bonusRates || {};

  return {
    basePay: {
      day: valueToString(basePay.day, DEFAULT_MOTIVATION.basePay.day),
      night: valueToString(basePay.night, DEFAULT_MOTIVATION.basePay.night),
    },
    taskCompletionBonus: valueToString(
      motivation.taskCompletionBonus,
      DEFAULT_MOTIVATION.taskCompletionBonus,
    ),
    penalties: {
      longMessageResponse: {
        perCase: valueToString(
          longMessageResponse.perCase,
          DEFAULT_MOTIVATION.penalties.longMessageResponse.perCase,
        ),
        escalationCount: valueToString(
          longMessageResponse.escalationCount,
          DEFAULT_MOTIVATION.penalties.longMessageResponse.escalationCount,
        ),
        escalationPenalty: valueToString(
          longMessageResponse.escalationPenalty,
          DEFAULT_MOTIVATION.penalties.longMessageResponse.escalationPenalty,
        ),
      },
      uncleanClub: {
        basePenalty: valueToString(
          uncleanClub.basePenalty,
          DEFAULT_MOTIVATION.penalties.uncleanClub.basePenalty,
        ),
        thresholdPlaces: valueToString(
          uncleanClub.thresholdPlaces,
          DEFAULT_MOTIVATION.penalties.uncleanClub.thresholdPlaces,
        ),
        escalationPenalty: valueToString(
          uncleanClub.escalationPenalty,
          DEFAULT_MOTIVATION.penalties.uncleanClub.escalationPenalty,
        ),
      },
      dirtyKitchen: valueToString(
        penalties.dirtyKitchen,
        DEFAULT_MOTIVATION.penalties.dirtyKitchen,
      ),
      missedCallNoCallback: valueToString(
        penalties.missedCallNoCallback,
        DEFAULT_MOTIVATION.penalties.missedCallNoCallback,
      ),
      messyWorkspace: valueToString(
        penalties.messyWorkspace,
        DEFAULT_MOTIVATION.penalties.messyWorkspace,
      ),
      strangersBehindDesk: valueToString(
        penalties.strangersBehindDesk,
        DEFAULT_MOTIVATION.penalties.strangersBehindDesk,
      ),
      climateControl: valueToString(
        penalties.climateControl,
        DEFAULT_MOTIVATION.penalties.climateControl,
      ),
      fridgeNotFilled: valueToString(
        penalties.fridgeNotFilled,
        DEFAULT_MOTIVATION.penalties.fridgeNotFilled,
      ),
      loudSwearingPerCase: valueToString(
        penalties.loudSwearingPerCase,
        DEFAULT_MOTIVATION.penalties.loudSwearingPerCase,
      ),
      secretGuestFailed: valueToString(
        penalties.secretGuestFailed,
        DEFAULT_MOTIVATION.penalties.secretGuestFailed,
      ),
    },
    bonusRates: {
      bar: rateToPercentString(
        bonusRates.bar ?? legacyBonusRates.goodsThreshold,
        DEFAULT_MOTIVATION.bonusRates.bar,
      ),
      services: rateToPercentString(
        bonusRates.services ?? legacyBonusRates.psThreshold,
        DEFAULT_MOTIVATION.bonusRates.services,
      ),
      planMultiplier: valueToString(
        bonusRates.planMultiplier,
        DEFAULT_MOTIVATION.bonusRates.planMultiplier,
      ),
    },
  };
};

export const normalizeClubForm = (club = {}) => {
  const settings = getSettings(club);
  const smartshell = settings.smartshell || {};
  const smartshellCompanyId =
    club.smartshellCompanyId ??
    club.smartshellId ??
    club.smartshell_id ??
    smartshell.companyId ??
    '';
  const hasSmartshellManagerCredentials = Boolean(
    smartshell.hasManagerCredentials,
  );

  return {
    id: club.id ? String(club.id) : null,
    name: valueToString(club.name),
    address: valueToString(club.address),
    openingDate: toInputDate(club.openingDate ?? club.opening_date),
    smartshellCompanyId: valueToString(smartshellCompanyId),
    smartshellManagerLogin: valueToString(smartshell.managerLogin),
    smartshellManagerPassword: '',
    hasSmartshellManagerCredentials,
    smartshellCredentialsUpdatedAt: smartshell.credentialsUpdatedAt || null,
    settings: {
      motivation: normalizeMotivation(settings),
    },
  };
};

const parseNonNegativeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const parsePositiveInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;

  const text = String(value).trim();
  const number = Number.parseInt(text, 10);
  return /^\d+$/.test(text) && number > 0 ? number : null;
};

const validateNumberFields = (fields, errors) => {
  fields.forEach(([key, value]) => {
    if (parseNonNegativeNumber(value) === null) {
      errors[key] = 'Введите неотрицательное число';
    }
  });
};

const validateIntegerFields = (fields, errors) => {
  fields.forEach(([key, value]) => {
    if (parsePositiveInteger(value) === null) {
      errors[key] = 'Введите положительное целое число';
    }
  });
};

export const validateClubSettingsForm = (
  form,
  { requireBasic = false, requireSmartshell = false } = {},
) => {
  const errors = {};
  const motivation = form.settings.motivation;

  if (requireBasic && !form.name.trim()) {
    errors.name = 'Название обязательно';
  }

  if (requireSmartshell && !parsePositiveInteger(form.smartshellCompanyId)) {
    errors.smartshellCompanyId = 'Укажите положительный Smartshell company id';
  }

  if (requireSmartshell && !form.smartshellManagerLogin.trim()) {
    errors.smartshellManagerLogin = 'Укажите Smartshell manager login';
  }

  if (
    requireSmartshell &&
    !form.hasSmartshellManagerCredentials &&
    !form.smartshellManagerPassword.trim()
  ) {
    errors.smartshellManagerPassword = 'Укажите Smartshell manager password';
  }

  validateNumberFields(
    [
      ['settings.motivation.basePay.day', motivation.basePay.day],
      ['settings.motivation.basePay.night', motivation.basePay.night],
      [
        'settings.motivation.taskCompletionBonus',
        motivation.taskCompletionBonus,
      ],
      [
        'settings.motivation.penalties.longMessageResponse.perCase',
        motivation.penalties.longMessageResponse.perCase,
      ],
      [
        'settings.motivation.penalties.longMessageResponse.escalationPenalty',
        motivation.penalties.longMessageResponse.escalationPenalty,
      ],
      [
        'settings.motivation.penalties.uncleanClub.basePenalty',
        motivation.penalties.uncleanClub.basePenalty,
      ],
      [
        'settings.motivation.penalties.uncleanClub.escalationPenalty',
        motivation.penalties.uncleanClub.escalationPenalty,
      ],
      [
        'settings.motivation.penalties.dirtyKitchen',
        motivation.penalties.dirtyKitchen,
      ],
      [
        'settings.motivation.penalties.missedCallNoCallback',
        motivation.penalties.missedCallNoCallback,
      ],
      [
        'settings.motivation.penalties.messyWorkspace',
        motivation.penalties.messyWorkspace,
      ],
      [
        'settings.motivation.penalties.strangersBehindDesk',
        motivation.penalties.strangersBehindDesk,
      ],
      [
        'settings.motivation.penalties.climateControl',
        motivation.penalties.climateControl,
      ],
      [
        'settings.motivation.penalties.fridgeNotFilled',
        motivation.penalties.fridgeNotFilled,
      ],
      [
        'settings.motivation.penalties.loudSwearingPerCase',
        motivation.penalties.loudSwearingPerCase,
      ],
      [
        'settings.motivation.penalties.secretGuestFailed',
        motivation.penalties.secretGuestFailed,
      ],
      ['settings.motivation.bonusRates.bar', motivation.bonusRates.bar],
      [
        'settings.motivation.bonusRates.services',
        motivation.bonusRates.services,
      ],
      [
        'settings.motivation.bonusRates.planMultiplier',
        motivation.bonusRates.planMultiplier,
      ],
    ],
    errors,
  );

  validateIntegerFields(
    [
      [
        'settings.motivation.penalties.longMessageResponse.escalationCount',
        motivation.penalties.longMessageResponse.escalationCount,
      ],
      [
        'settings.motivation.penalties.uncleanClub.thresholdPlaces',
        motivation.penalties.uncleanClub.thresholdPlaces,
      ],
    ],
    errors,
  );

  return errors;
};

const numericMotivation = (form) => {
  const motivation = form.settings.motivation;

  return {
    basePay: {
      day: Number(motivation.basePay.day),
      night: Number(motivation.basePay.night),
    },
    taskCompletionBonus: Number(motivation.taskCompletionBonus),
    penalties: {
      longMessageResponse: {
        perCase: Number(motivation.penalties.longMessageResponse.perCase),
        escalationCount: Number.parseInt(
          motivation.penalties.longMessageResponse.escalationCount,
          10,
        ),
        escalationPenalty: Number(
          motivation.penalties.longMessageResponse.escalationPenalty,
        ),
      },
      uncleanClub: {
        basePenalty: Number(motivation.penalties.uncleanClub.basePenalty),
        thresholdPlaces: Number.parseInt(
          motivation.penalties.uncleanClub.thresholdPlaces,
          10,
        ),
        escalationPenalty: Number(
          motivation.penalties.uncleanClub.escalationPenalty,
        ),
      },
      dirtyKitchen: Number(motivation.penalties.dirtyKitchen),
      missedCallNoCallback: Number(
        motivation.penalties.missedCallNoCallback,
      ),
      messyWorkspace: Number(motivation.penalties.messyWorkspace),
      strangersBehindDesk: Number(motivation.penalties.strangersBehindDesk),
      climateControl: Number(motivation.penalties.climateControl),
      fridgeNotFilled: Number(motivation.penalties.fridgeNotFilled),
      loudSwearingPerCase: Number(motivation.penalties.loudSwearingPerCase),
      secretGuestFailed: Number(motivation.penalties.secretGuestFailed),
    },
    bonusRates: {
      bar: percentToRate(motivation.bonusRates.bar),
      services: percentToRate(motivation.bonusRates.services),
      planMultiplier: Number(motivation.bonusRates.planMultiplier),
    },
  };
};

export const getMotivationPresetFormValues = () =>
  normalizeMotivation({ motivation: DEFAULT_MOTIVATION });

const smartshellSettings = (form) => {
  const managerPassword = form.smartshellManagerPassword || '';
  const settings = {
    companyId: Number.parseInt(form.smartshellCompanyId, 10),
    managerLogin: form.smartshellManagerLogin.trim(),
  };

  if (managerPassword.trim()) {
    settings.managerPassword = managerPassword;
  }

  return settings;
};

const numericSettings = (form, { includeSmartshell = false } = {}) => ({
  motivation: numericMotivation(form),
  ...(includeSmartshell
    ? {
        smartshell: smartshellSettings(form),
      }
    : {}),
});

export const buildSettingsPayload = (form, options) =>
  numericSettings(form, options);

export const buildPlatformClubPayload = (form) => ({
  name: form.name.trim(),
  address: form.address.trim() || null,
  opening_date: form.openingDate || null,
  smartshellCompanyId: Number.parseInt(form.smartshellCompanyId, 10),
  settings: {
    ...numericSettings(form, { includeSmartshell: true }),
  },
});

const FieldError = ({ children }) =>
  children ? (
    <p className="text-xs font-medium text-destructive">{children}</p>
  ) : null;

const fieldInputClassName = (isReadOnly, unit) =>
  cn(
    isReadOnly &&
      'cursor-default border-border/80 bg-muted/30 text-foreground opacity-100',
    unit && 'pr-14',
  );

const TextField = ({
  id,
  label,
  value,
  error,
  readOnly,
  onChange,
  type = 'text',
  min,
  step,
}) => (
  <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type={type}
      min={min}
      step={step}
      value={value}
      onChange={readOnly ? undefined : (event) => onChange(event.target.value)}
      readOnly={readOnly}
      aria-readonly={readOnly}
      aria-invalid={Boolean(error)}
      className={fieldInputClassName(readOnly)}
    />
    <FieldError>{error}</FieldError>
  </div>
);

const NumberField = ({
  id,
  label,
  value,
  error,
  readOnly,
  onChange,
  step = '1',
  unit,
}) => (
  <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={
          readOnly ? undefined : (event) => onChange(event.target.value)
        }
        readOnly={readOnly}
        aria-readonly={readOnly}
        aria-invalid={Boolean(error)}
        className={fieldInputClassName(readOnly, unit)}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-medium text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
    <FieldError>{error}</FieldError>
  </div>
);

const Section = ({ title, description, children, action, variant = 'default' }) => (
  <section
    className={cn(
      'space-y-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0',
      variant === 'technical' &&
        'rounded-lg border border-dashed border-border bg-muted/20 p-4 first:border first:pt-4',
    )}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </section>
);

const ClubSettingsForm = ({
  form,
  onChange,
  errors = {},
  readOnly = false,
  canEditBasic = true,
  canEditSmartshell = true,
  canViewSmartshellCredentials = canEditSmartshell,
  canEditSettings = true,
}) => {
  const motivation = form.settings.motivation;
  const updateField = (key, value) =>
    onChange({
      ...form,
      [key]: value,
    });

  const updateMotivation = (section, key, value) =>
    onChange({
      ...form,
      settings: {
        ...form.settings,
        motivation: {
          ...motivation,
          [section]: {
            ...motivation[section],
            [key]: value,
          },
        },
      },
    });

  const updatePenalty = (key, value) =>
    onChange({
      ...form,
      settings: {
        ...form.settings,
        motivation: {
          ...motivation,
          penalties: {
            ...motivation.penalties,
            [key]: value,
          },
        },
      },
    });

  const updateNestedPenalty = (section, key, value) =>
    onChange({
      ...form,
      settings: {
        ...form.settings,
        motivation: {
          ...motivation,
          penalties: {
            ...motivation.penalties,
            [section]: {
              ...motivation.penalties[section],
              [key]: value,
            },
          },
        },
      },
    });

  const basicReadOnly = readOnly || !canEditBasic;
  const smartshellReadOnly = readOnly || !canEditSmartshell;
  const settingsReadOnly = readOnly || !canEditSettings;

  const applyPreset = () => {
    if (settingsReadOnly) return;

    onChange({
      ...form,
      settings: {
        ...form.settings,
        motivation: getMotivationPresetFormValues(),
      },
    });
  };

  return (
    <div className="space-y-6">
      {!canEditSettings && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Режим просмотра</p>
            <p>Редактировать настройки может владелец или platform admin.</p>
          </div>
        </div>
      )}

      <Section title="Основные данные">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="club-name"
            label="Название"
            value={form.name}
            error={errors.name}
            readOnly={basicReadOnly}
            onChange={(value) => updateField('name', value)}
          />

          <TextField
            id="club-opening-date"
            label="Дата открытия"
            type="date"
            value={form.openingDate}
            readOnly={basicReadOnly}
            onChange={(value) => updateField('openingDate', value)}
          />

          <div className="md:col-span-2">
            <TextField
              id="club-address"
              label="Адрес"
              value={form.address}
              readOnly={basicReadOnly}
              onChange={(value) => updateField('address', value)}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Техническая интеграция"
        description="Smartshell отделен от правил мотивации."
        variant="technical"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField
            id="club-smartshell-company-id"
            label="Smartshell company ID"
            value={form.smartshellCompanyId}
            error={errors.smartshellCompanyId}
            readOnly={smartshellReadOnly}
            step="1"
            onChange={(value) => updateField('smartshellCompanyId', value)}
          />
          <div className="flex min-h-16 items-center gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
            <ServerCog className="h-4 w-4 shrink-0" />
            <span>Системный ID клуба в Smartshell, не сумма и не процент.</span>
          </div>
          {canViewSmartshellCredentials && (
            <>
              <TextField
                id="club-smartshell-manager-login"
                label="Manager login"
                value={form.smartshellManagerLogin}
                error={errors.smartshellManagerLogin}
                readOnly={smartshellReadOnly}
                onChange={(value) =>
                  updateField('smartshellManagerLogin', value)
                }
              />
              <TextField
                id="club-smartshell-manager-password"
                label="Manager password"
                type="password"
                value={form.smartshellManagerPassword}
                error={errors.smartshellManagerPassword}
                readOnly={smartshellReadOnly}
                onChange={(value) =>
                  updateField('smartshellManagerPassword', value)
                }
              />
            </>
          )}
          <div className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {form.hasSmartshellManagerCredentials
                  ? 'Пароль настроен'
                  : 'Пароль не настроен'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {form.smartshellCredentialsUpdatedAt
                  ? `Обновлено: ${new Date(
                      form.smartshellCredentialsUpdatedAt,
                    ).toLocaleString('ru-RU')}`
                  : 'Нет даты обновления'}
              </p>
            </div>
            <Badge
              variant={
                form.hasSmartshellManagerCredentials ? 'outline' : 'secondary'
              }
            >
              {form.hasSmartshellManagerCredentials ? 'настроено' : 'пусто'}
            </Badge>
          </div>
        </div>
      </Section>

      <Section
        title="Оплата смены"
        action={
          <Button
            type="button"
            variant="outline"
            onClick={applyPreset}
            disabled={settingsReadOnly}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            {MOTIVATION_PRESET_NAME}
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{MOTIVATION_PRESET_NAME}</Badge>
          <Badge variant="secondary">рубли</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            id="motivation-base-day"
            label="Дневная смена"
            value={motivation.basePay.day}
            error={errors['settings.motivation.basePay.day']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updateMotivation('basePay', 'day', value)}
          />
          <NumberField
            id="motivation-base-night"
            label="Ночная смена"
            value={motivation.basePay.night}
            error={errors['settings.motivation.basePay.night']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updateMotivation('basePay', 'night', value)}
          />
          <NumberField
            id="motivation-task-bonus"
            label="Бонус за все задачи"
            value={motivation.taskCompletionBonus}
            error={errors['settings.motivation.taskCompletionBonus']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) =>
              onChange({
                ...form,
                settings: {
                  ...form.settings,
                  motivation: {
                    ...motivation,
                    taskCompletionBonus: value,
                  },
                },
              })
            }
          />
        </div>
      </Section>

      <Section title="Проценты">
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            id="motivation-bar-rate"
            label="Бар"
            value={motivation.bonusRates.bar}
            error={errors['settings.motivation.bonusRates.bar']}
            readOnly={settingsReadOnly}
            step="0.1"
            unit="%"
            onChange={(value) => updateMotivation('bonusRates', 'bar', value)}
          />
          <NumberField
            id="motivation-services-rate"
            label="Услуги"
            value={motivation.bonusRates.services}
            error={errors['settings.motivation.bonusRates.services']}
            readOnly={settingsReadOnly}
            step="0.1"
            unit="%"
            onChange={(value) =>
              updateMotivation('bonusRates', 'services', value)
            }
          />
          <NumberField
            id="motivation-plan-multiplier"
            label="Множитель при плане"
            value={motivation.bonusRates.planMultiplier}
            error={errors['settings.motivation.bonusRates.planMultiplier']}
            readOnly={settingsReadOnly}
            step="0.1"
            unit="x"
            onChange={(value) =>
              updateMotivation('bonusRates', 'planMultiplier', value)
            }
          />
        </div>
      </Section>

      <Section title="Штрафы">
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            id="penalty-long-message-case"
            label="Долгий ответ, случай"
            value={motivation.penalties.longMessageResponse.perCase}
            error={
              errors[
                'settings.motivation.penalties.longMessageResponse.perCase'
              ]
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) =>
              updateNestedPenalty('longMessageResponse', 'perCase', value)
            }
          />
          <NumberField
            id="penalty-long-message-count"
            label="Порог сообщений"
            value={motivation.penalties.longMessageResponse.escalationCount}
            error={
              errors[
                'settings.motivation.penalties.longMessageResponse.escalationCount'
              ]
            }
            readOnly={settingsReadOnly}
            unit="шт."
            onChange={(value) =>
              updateNestedPenalty(
                'longMessageResponse',
                'escalationCount',
                value,
              )
            }
          />
          <NumberField
            id="penalty-long-message-escalation"
            label="Штраф за порог"
            value={motivation.penalties.longMessageResponse.escalationPenalty}
            error={
              errors[
                'settings.motivation.penalties.longMessageResponse.escalationPenalty'
              ]
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) =>
              updateNestedPenalty(
                'longMessageResponse',
                'escalationPenalty',
                value,
              )
            }
          />
          <NumberField
            id="penalty-unclean-base"
            label="Клуб не убран"
            value={motivation.penalties.uncleanClub.basePenalty}
            error={
              errors['settings.motivation.penalties.uncleanClub.basePenalty']
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) =>
              updateNestedPenalty('uncleanClub', 'basePenalty', value)
            }
          />
          <NumberField
            id="penalty-unclean-threshold"
            label="Порог мест"
            value={motivation.penalties.uncleanClub.thresholdPlaces}
            error={
              errors[
                'settings.motivation.penalties.uncleanClub.thresholdPlaces'
              ]
            }
            readOnly={settingsReadOnly}
            unit="мест"
            onChange={(value) =>
              updateNestedPenalty('uncleanClub', 'thresholdPlaces', value)
            }
          />
          <NumberField
            id="penalty-unclean-escalation"
            label="Штраф выше порога"
            value={motivation.penalties.uncleanClub.escalationPenalty}
            error={
              errors[
                'settings.motivation.penalties.uncleanClub.escalationPenalty'
              ]
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) =>
              updateNestedPenalty('uncleanClub', 'escalationPenalty', value)
            }
          />
          <NumberField
            id="penalty-dirty-kitchen"
            label="Грязная кухня"
            value={motivation.penalties.dirtyKitchen}
            error={errors['settings.motivation.penalties.dirtyKitchen']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('dirtyKitchen', value)}
          />
          <NumberField
            id="penalty-missed-call"
            label="Пропущенный звонок"
            value={motivation.penalties.missedCallNoCallback}
            error={
              errors['settings.motivation.penalties.missedCallNoCallback']
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('missedCallNoCallback', value)}
          />
          <NumberField
            id="penalty-messy-workspace"
            label="Рабочее место"
            value={motivation.penalties.messyWorkspace}
            error={errors['settings.motivation.penalties.messyWorkspace']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('messyWorkspace', value)}
          />
          <NumberField
            id="penalty-strangers"
            label="Посторонние"
            value={motivation.penalties.strangersBehindDesk}
            error={
              errors['settings.motivation.penalties.strangersBehindDesk']
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('strangersBehindDesk', value)}
          />
          <NumberField
            id="penalty-climate"
            label="Климат"
            value={motivation.penalties.climateControl}
            error={errors['settings.motivation.penalties.climateControl']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('climateControl', value)}
          />
          <NumberField
            id="penalty-fridge"
            label="Холодильники"
            value={motivation.penalties.fridgeNotFilled}
            error={errors['settings.motivation.penalties.fridgeNotFilled']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('fridgeNotFilled', value)}
          />
          <NumberField
            id="penalty-swearing"
            label="Громкий мат"
            value={motivation.penalties.loudSwearingPerCase}
            error={
              errors['settings.motivation.penalties.loudSwearingPerCase']
            }
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('loudSwearingPerCase', value)}
          />
        </div>
      </Section>

      <Section title="Тайный гость">
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField
            id="penalty-secret-guest"
            label="Провал проверки"
            value={motivation.penalties.secretGuestFailed}
            error={errors['settings.motivation.penalties.secretGuestFailed']}
            readOnly={settingsReadOnly}
            unit="руб."
            onChange={(value) => updatePenalty('secretGuestFailed', value)}
          />
        </div>
      </Section>
    </div>
  );
};

export default ClubSettingsForm;
