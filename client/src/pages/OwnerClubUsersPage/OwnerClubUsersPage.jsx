import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { CLUB_ROLES, ROLE_LABELS } from '@/lib/auth-session';
import { cn } from '@/lib/utils';

const CLUB_ROLE_OPTIONS = [
  { value: CLUB_ROLES.OWNER, label: ROLE_LABELS[CLUB_ROLES.OWNER] },
  { value: CLUB_ROLES.MANAGER, label: ROLE_LABELS[CLUB_ROLES.MANAGER] },
  { value: CLUB_ROLES.CLUB_ADMIN, label: ROLE_LABELS[CLUB_ROLES.CLUB_ADMIN] },
];

const CLUB_ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Все роли' },
  ...CLUB_ROLE_OPTIONS,
];

const EMPTY_USER_FORM = {
  id: null,
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  passwordConfirmation: '',
  role: CLUB_ROLES.MANAGER,
};

const getServerMessage = (error, fallback) =>
  error.response?.data?.message || fallback || 'Ошибка сервера';

const toId = (value) =>
  value === null || value === undefined ? '' : String(value);

const getUserName = (user) => {
  const firstName = user.firstName ?? user.first_name ?? '';
  const lastName = user.lastName ?? user.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user.email || `Пользователь #${user.id}`;
};

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('ru-RU');
};

const getMembership = (user) =>
  user?.membership || (user?.memberships || [])[0] || null;

const normalizeSearchValue = (value) => String(value || '').toLowerCase();

const getUserSearchText = (user) => {
  const membership = getMembership(user);

  return normalizeSearchValue(
    [
      getUserName(user),
      user.email,
      membership?.role,
      ROLE_LABELS[membership?.role],
    ]
      .filter(Boolean)
      .join(' '),
  );
};

const normalizeUserForm = (user = {}) => {
  const membership = getMembership(user);

  return {
    id: user.id ? String(user.id) : null,
    email: user.email || '',
    firstName: user.firstName ?? user.first_name ?? '',
    lastName: user.lastName ?? user.last_name ?? '',
    password: '',
    passwordConfirmation: '',
    role: membership?.role || CLUB_ROLES.MANAGER,
  };
};

const validateUserForm = (
  form,
  isCreate,
  { validateProfile = true } = {},
) => {
  const errors = {};
  const email = form.email.trim();

  if (validateProfile) {
    if (!email) errors.email = 'Email обязателен';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Некорректный email';
    }
    if (!form.firstName.trim()) errors.firstName = 'Имя обязательно';
    if (!form.lastName.trim()) errors.lastName = 'Фамилия обязательна';

    const password = form.password || '';
    const passwordConfirmation = form.passwordConfirmation || '';
    const shouldValidatePassword = isCreate || password || passwordConfirmation;

    if (shouldValidatePassword) {
      if (!password) {
        errors.password = isCreate ? 'Пароль обязателен' : 'Укажите новый пароль';
      } else if (password.length < 8) {
        errors.password = 'Пароль должен быть не короче 8 символов';
      }

      if (!passwordConfirmation) {
        errors.passwordConfirmation = isCreate
          ? 'Повторите пароль'
          : 'Повторите новый пароль';
      } else if (password && password !== passwordConfirmation) {
        errors.passwordConfirmation = 'Пароли не совпадают';
      }
    }
  }

  if (!form.role) errors.role = 'Роль обязательна';

  return errors;
};

const ErrorBlock = ({ children }) =>
  children ? (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </div>
  ) : null;

const FieldError = ({ children }) =>
  children ? (
    <p className="text-xs font-medium text-destructive">{children}</p>
  ) : null;

const EmptyState = ({ title }) => (
  <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
    {title}
  </div>
);

const TrialBadge = ({ user }) => {
  const expiresAt = user.freeTrialExpiresAt ?? user.free_trial_expires_at;
  const isActive = Boolean(user.isFreeTrial ?? user.is_free_trial);

  if (!expiresAt) {
    return <Badge variant="outline">Без trial</Badge>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={isActive ? 'secondary' : 'outline'}>
        {isActive ? 'Trial активен' : 'Trial истек'}
      </Badge>
      <span className="text-xs text-muted-foreground">
        до {formatDate(expiresAt)}
      </span>
    </div>
  );
};

const OwnerClubUsersPage = () => {
  const { session, refreshSession } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [removingUserId, setRemovingUserId] = useState('');
  const [dialog, setDialog] = useState({
    open: false,
    mode: 'create',
    form: { ...EMPTY_USER_FORM },
    errors: {},
    serverError: '',
    isSaving: false,
    user: null,
  });

  const activeClubName = useMemo(() => {
    const membership = (session.memberships || []).find(
      (item) => item.clubId === session.activeClubId,
    );
    return membership?.club?.name || 'Текущий клуб';
  }, [session.activeClubId, session.memberships]);

  const filteredUsers = useMemo(() => {
    const query = normalizeSearchValue(searchQuery.trim());

    return users.filter((user) => {
      const membership = getMembership(user);
      const matchesSearch = !query || getUserSearchText(user).includes(query);
      const matchesRole =
        roleFilter === 'all' || membership?.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchQuery, users]);

  const ownerCount = useMemo(
    () =>
      users.filter(
        (user) => getMembership(user)?.role === CLUB_ROLES.OWNER,
      ).length,
    [users],
  );

  const getUserControls = useCallback(
    (user) => {
      const membership = getMembership(user);
      const isCurrentUser = toId(user?.id) === toId(session.user?.id);
      const isOwner = membership?.role === CLUB_ROLES.OWNER;
      const isOnlyOwner = isOwner && ownerCount <= 1;

      return {
        canEditProfile: user?.canEditProfile !== false,
        canChangeMembership: !(isCurrentUser && isOwner) && !isOnlyOwner,
        canRemoveMembership: !isCurrentUser && !isOnlyOwner,
      };
    },
    [ownerCount, session.user?.id],
  );

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError('');
      const response = await api.get('/api/clubs/current/users');
      setUsers(response.data?.users || []);
    } catch (error) {
      setLoadError(getServerMessage(error, 'Не удалось загрузить пользователей'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, session.activeClubId]);

  const refreshAfterMutation = async () => {
    await loadUsers();
    await refreshSession();
  };

  const openDialog = (mode, user = null) => {
    setDialog({
      open: true,
      mode,
      form: normalizeUserForm(user || {}),
      errors: {},
      serverError: '',
      isSaving: false,
      user,
    });
  };

  const closeDialog = () => {
    setDialog((current) => ({ ...current, open: false }));
  };

  const saveUser = async (event) => {
    event.preventDefault();

    const isCreate = dialog.mode === 'create';
    const controls = isCreate
      ? { canEditProfile: true, canChangeMembership: true }
      : getUserControls(dialog.user);
    const errors = validateUserForm(dialog.form, isCreate, {
      validateProfile: isCreate || controls.canEditProfile,
    });

    if (Object.keys(errors).length) {
      setDialog((current) => ({ ...current, errors }));
      return;
    }

    const initialRole = getMembership(dialog.user)?.role;
    const isRoleChanged = !isCreate && dialog.form.role !== initialRole;

    if (isRoleChanged && !controls.canChangeMembership) {
      setDialog((current) => ({
        ...current,
        serverError: 'Нельзя удалить или понизить владельца клуба',
      }));
      return;
    }

    try {
      setDialog((current) => ({
        ...current,
        isSaving: true,
        serverError: '',
      }));

      const payload = {
        email: dialog.form.email.trim(),
        first_name: dialog.form.firstName.trim(),
        last_name: dialog.form.lastName.trim(),
      };

      if (isCreate) {
        await api.post('/api/clubs/current/users', {
          ...payload,
          password: dialog.form.password,
          passwordConfirmation: dialog.form.passwordConfirmation,
          role: dialog.form.role,
        });
        toast.success('Пользователь создан');
      } else {
        if (controls.canEditProfile) {
          const updatePayload = { ...payload };
          if (dialog.form.password || dialog.form.passwordConfirmation) {
            updatePayload.password = dialog.form.password;
            updatePayload.passwordConfirmation =
              dialog.form.passwordConfirmation;
          }

          await api.patch(
            `/api/clubs/current/users/${dialog.form.id}`,
            updatePayload,
          );
        }

        if (isRoleChanged) {
          await api.patch(
            `/api/clubs/current/users/${dialog.form.id}/membership`,
            { role: dialog.form.role },
          );
        }

        toast.success('Пользователь обновлен');
      }

      await refreshAfterMutation();
      closeDialog();
    } catch (error) {
      setDialog((current) => ({
        ...current,
        serverError: getServerMessage(
          error,
          'Не удалось сохранить пользователя',
        ),
      }));
    } finally {
      setDialog((current) => ({ ...current, isSaving: false }));
    }
  };

  const removeUserAccess = async (user) => {
    const controls = getUserControls(user);
    if (!controls.canRemoveMembership) {
      toast.error('Нельзя удалить владельца клуба');
      return;
    }

    if (!window.confirm('Удалить доступ пользователя к текущему клубу?')) {
      return;
    }

    try {
      setRemovingUserId(toId(user.id));
      await api.delete(`/api/clubs/current/users/${user.id}/membership`);
      toast.success('Доступ удален');
      await refreshAfterMutation();
    } catch (error) {
      toast.error(getServerMessage(error, 'Не удалось удалить доступ'));
    } finally {
      setRemovingUserId('');
    }
  };

  const dialogControls =
    dialog.mode === 'edit'
      ? getUserControls(dialog.user)
      : { canEditProfile: true, canChangeMembership: true };
  const profileDisabled =
    dialog.mode === 'edit' && !dialogControls.canEditProfile;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Users className="h-6 w-6 shrink-0" />
            Пользователи клуба
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeClubName} · показано {filteredUsers.length} из {users.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadUsers}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Обновить
          </Button>
          <Button
            type="button"
            data-testid="owner-create-user-button"
            onClick={() => openDialog('create')}
          >
            <UserPlus className="h-4 w-4" />
            Создать пользователя
          </Button>
        </div>
      </div>

      <ErrorBlock>{loadError}</ErrorBlock>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_220px]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Имя, email или роль"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLUB_ROLE_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <EmptyState title="Загрузка пользователей..." />
      ) : filteredUsers.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Роль в клубе</TableHead>
                <TableHead>Бесплатный период</TableHead>
                <TableHead className="w-24 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const membership = getMembership(user);
                const isRemoving = removingUserId === toId(user.id);
                const controls = getUserControls(user);

                return (
                  <TableRow key={user.id}>
                    <TableCell className="min-w-56">
                      <div className="font-medium">{getUserName(user)}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[membership?.role] || membership?.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <TrialBadge user={user} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          data-testid={`owner-edit-user-${user.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => openDialog('edit', user)}
                          title="Редактировать пользователя"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeUserAccess(user)}
                          disabled={
                            Boolean(removingUserId) ||
                            !controls.canRemoveMembership
                          }
                          title={
                            controls.canRemoveMembership
                              ? 'Удалить доступ'
                              : 'Нельзя удалить владельца клуба'
                          }
                        >
                          {isRemoving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
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
        <EmptyState title="Пользователи по фильтрам не найдены" />
      )}

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {dialog.mode === 'create'
                ? 'Создать пользователя'
                : 'Редактировать пользователя'}
            </DialogTitle>
            <DialogDescription>
              Профиль и роль доступа в текущем клубе.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveUser} className="space-y-6">
            <ErrorBlock>{dialog.serverError}</ErrorBlock>

            <section className="space-y-4">
              {profileDisabled && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Профиль используется в нескольких клубах. Здесь меняется только
                  роль в текущем клубе.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="owner-user-email">Email</Label>
                  <Input
                    id="owner-user-email"
                    type="email"
                    value={dialog.form.email}
                    disabled={profileDisabled}
                    onChange={(event) =>
                      setDialog((current) => ({
                        ...current,
                        form: { ...current.form, email: event.target.value },
                        errors: {},
                      }))
                    }
                    aria-invalid={Boolean(dialog.errors.email)}
                  />
                  <FieldError>{dialog.errors.email}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="owner-user-first-name">Имя</Label>
                  <Input
                    id="owner-user-first-name"
                    value={dialog.form.firstName}
                    disabled={profileDisabled}
                    onChange={(event) =>
                      setDialog((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          firstName: event.target.value,
                        },
                        errors: {},
                      }))
                    }
                    aria-invalid={Boolean(dialog.errors.firstName)}
                  />
                  <FieldError>{dialog.errors.firstName}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="owner-user-last-name">Фамилия</Label>
                  <Input
                    id="owner-user-last-name"
                    value={dialog.form.lastName}
                    disabled={profileDisabled}
                    onChange={(event) =>
                      setDialog((current) => ({
                        ...current,
                        form: { ...current.form, lastName: event.target.value },
                        errors: {},
                      }))
                    }
                    aria-invalid={Boolean(dialog.errors.lastName)}
                  />
                  <FieldError>{dialog.errors.lastName}</FieldError>
                </div>

                {(dialog.mode === 'create' ||
                  (dialog.mode === 'edit' && !profileDisabled)) && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="owner-user-password">
                        {dialog.mode === 'create' ? 'Пароль' : 'Новый пароль'}
                      </Label>
                      <Input
                        id="owner-user-password"
                        type="password"
                        autoComplete="new-password"
                        value={dialog.form.password}
                        onChange={(event) =>
                          setDialog((current) => ({
                            ...current,
                            form: {
                              ...current.form,
                              password: event.target.value,
                            },
                            errors: {},
                          }))
                        }
                        aria-invalid={Boolean(dialog.errors.password)}
                      />
                      <FieldError>{dialog.errors.password}</FieldError>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner-user-password-confirmation">
                        {dialog.mode === 'create'
                          ? 'Повторите пароль'
                          : 'Повторите новый пароль'}
                      </Label>
                      <Input
                        id="owner-user-password-confirmation"
                        type="password"
                        autoComplete="new-password"
                        value={dialog.form.passwordConfirmation}
                        onChange={(event) =>
                          setDialog((current) => ({
                            ...current,
                            form: {
                              ...current.form,
                              passwordConfirmation: event.target.value,
                            },
                            errors: {},
                          }))
                        }
                        aria-invalid={Boolean(
                          dialog.errors.passwordConfirmation,
                        )}
                      />
                      <FieldError>
                        {dialog.errors.passwordConfirmation}
                      </FieldError>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label>Роль в клубе</Label>
                  <Select
                    value={dialog.form.role}
                    disabled={
                      dialog.mode === 'edit' &&
                      !dialogControls.canChangeMembership
                    }
                    onValueChange={(value) =>
                      setDialog((current) => ({
                        ...current,
                        form: { ...current.form, role: value },
                        errors: {},
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLUB_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{dialog.errors.role}</FieldError>
                </div>
              </div>
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={dialog.isSaving}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={dialog.isSaving}>
                {dialog.isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : dialog.mode === 'create' ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
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

export default OwnerClubUsersPage;
