import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api';
import ClubSettingsForm, {
  buildSettingsPayload,
  normalizeClubForm,
  validateClubSettingsForm,
} from '@/components/ClubSettingsForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { CLUB_ROLES, ROLE_LABELS, SYSTEM_ROLES } from '@/lib/auth-session';

const ErrorBlock = ({ children }) =>
  children ? (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </div>
  ) : null;

const sameValue = (left, right) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const getMotivationChangeGroups = (previousSettings, nextSettings) => {
  const previous = previousSettings?.motivation || {};
  const next = nextSettings?.motivation || {};
  const groups = [];

  if (
    !sameValue(previous.basePay, next.basePay) ||
    !sameValue(previous.taskCompletionBonus, next.taskCompletionBonus)
  ) {
    groups.push('Оплата смены');
  }

  if (!sameValue(previous.bonusRates, next.bonusRates)) {
    groups.push('Проценты');
  }

  const previousPenalties = previous.penalties || {};
  const nextPenalties = next.penalties || {};

  if (
    !sameValue(previousPenalties.secretGuestFailed, nextPenalties.secretGuestFailed)
  ) {
    groups.push('Тайный гость');
  }

  const { secretGuestFailed: previousSecretGuest, ...previousCommonPenalties } =
    previousPenalties;
  const { secretGuestFailed: nextSecretGuest, ...nextCommonPenalties } =
    nextPenalties;

  void previousSecretGuest;
  void nextSecretGuest;

  if (!sameValue(previousCommonPenalties, nextCommonPenalties)) {
    groups.push('Штрафы');
  }

  return groups;
};

const ClubSettingsPage = () => {
  const { session } = useAuth();
  const [form, setForm] = useState(() => normalizeClubForm());
  const [savedSettings, setSavedSettings] = useState(() =>
    buildSettingsPayload(normalizeClubForm(), { includeSmartshell: true }),
  );
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmation, setConfirmation] = useState({
    open: false,
    settings: null,
    groups: [],
  });
  const isPlatformAdmin = session.systemRole === SYSTEM_ROLES.PLATFORM_ADMIN;
  const canEditSettings =
    isPlatformAdmin || session.activeClubRole === CLUB_ROLES.OWNER;
  const canEditSmartshell = canEditSettings;

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setServerError('');

      const response = await api.get('/api/clubs/current/settings');
      const nextForm = normalizeClubForm(response.data?.club || {});
      setForm(nextForm);
      setSavedSettings(
        buildSettingsPayload(nextForm, { includeSmartshell: true }),
      );
    } catch (error) {
      setServerError(
        error.response?.data?.message || 'Не удалось загрузить настройки',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings, session.activeClubId]);

  const persistSettings = async (settings) => {
    try {
      setIsSaving(true);
      setServerError('');

      const response = await api.patch('/api/clubs/current/settings', {
        settings,
      });
      const nextForm = normalizeClubForm(response.data?.club || {});
      setForm(nextForm);
      setSavedSettings(
        buildSettingsPayload(nextForm, { includeSmartshell: true }),
      );
      setConfirmation({ open: false, settings: null, groups: [] });
      toast.success('Настройки сохранены');
    } catch (error) {
      setServerError(
        error.response?.data?.message || 'Не удалось сохранить настройки',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();

    if (!canEditSettings) return;

    const nextErrors = validateClubSettingsForm(form, {
      requireSmartshell: canEditSmartshell,
    });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const nextSettings = buildSettingsPayload(form, {
      includeSmartshell: canEditSmartshell,
    });
    const motivationChangeGroups = getMotivationChangeGroups(
      savedSettings,
      nextSettings,
    );

    if (motivationChangeGroups.length) {
      setConfirmation({
        open: true,
        settings: nextSettings,
        groups: motivationChangeGroups,
      });
      return;
    }

    await persistSettings(nextSettings);
  };

  const confirmCriticalSave = async () => {
    if (!confirmation.settings) return;
    await persistSettings(confirmation.settings);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 p-4 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Settings className="h-6 w-6 shrink-0" />
            Настройки клуба
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {form.name || 'Текущий клуб'}
            {!canEditSettings &&
              ` · только просмотр, редактирует ${ROLE_LABELS[CLUB_ROLES.OWNER]} или ${ROLE_LABELS[SYSTEM_ROLES.PLATFORM_ADMIN]}`}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={loadSettings}
          disabled={isSaving}
        >
          Обновить
        </Button>
      </div>

      <ErrorBlock>{serverError}</ErrorBlock>

      <form onSubmit={saveSettings} className="space-y-6">
        <ClubSettingsForm
          form={form}
          onChange={(nextForm) => {
            setForm(nextForm);
            setErrors({});
          }}
          errors={errors}
          canEditBasic={false}
          canEditSmartshell={canEditSmartshell}
          canViewSmartshellCredentials={canEditSmartshell}
          canEditSettings={canEditSettings}
        />

        {canEditSettings && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Сохранить
            </Button>
          </div>
        )}
      </form>

      <Dialog
        open={confirmation.open}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            setConfirmation({ open: false, settings: null, groups: [] });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Подтвердите изменение мотивации
            </DialogTitle>
            <DialogDescription>
              Эти настройки влияют на выплаты администраторам и штрафы за смену.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Будут изменены разделы:
            </p>
            <div className="flex flex-wrap gap-2">
              {confirmation.groups.map((group) => (
                <span
                  key={group}
                  className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-sm"
                >
                  {group}
                </span>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfirmation({ open: false, settings: null, groups: [] })
              }
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCriticalSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Сохранить изменения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubSettingsPage;
