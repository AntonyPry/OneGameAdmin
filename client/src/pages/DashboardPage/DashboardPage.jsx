import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
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
import ClubSettingsForm, {
  buildPlatformClubPayload,
  normalizeClubForm,
  validateClubSettingsForm,
} from '@/components/ClubSettingsForm';
import InvitationReadyPanel from '@/components/InvitationReadyPanel';
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
import { CLUB_ROLES, ROLE_LABELS, SYSTEM_ROLES } from '@/lib/auth-session';
import { cn } from '@/lib/utils';

const VIEW_TABS = [
  { value: 'clubs', label: 'Клубы', icon: Building2 },
  { value: 'users', label: 'Пользователи', icon: Users },
];

const CLUB_ROLE_OPTIONS = [
  { value: CLUB_ROLES.OWNER, label: ROLE_LABELS[CLUB_ROLES.OWNER] },
  { value: CLUB_ROLES.MANAGER, label: ROLE_LABELS[CLUB_ROLES.MANAGER] },
  { value: CLUB_ROLES.CLUB_ADMIN, label: ROLE_LABELS[CLUB_ROLES.CLUB_ADMIN] },
];

const SYSTEM_ROLE_OPTIONS = [
  { value: SYSTEM_ROLES.USER, label: 'Пользователь' },
  {
    value: SYSTEM_ROLES.PLATFORM_ADMIN,
    label: ROLE_LABELS[SYSTEM_ROLES.PLATFORM_ADMIN],
  },
];

const USER_ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Все роли' },
  { value: 'no_access', label: 'Без клуба' },
  {
    value: SYSTEM_ROLES.PLATFORM_ADMIN,
    label: ROLE_LABELS[SYSTEM_ROLES.PLATFORM_ADMIN],
  },
  { value: SYSTEM_ROLES.USER, label: 'Обычный пользователь' },
  { value: CLUB_ROLES.OWNER, label: ROLE_LABELS[CLUB_ROLES.OWNER] },
  { value: CLUB_ROLES.MANAGER, label: ROLE_LABELS[CLUB_ROLES.MANAGER] },
  { value: CLUB_ROLES.CLUB_ADMIN, label: ROLE_LABELS[CLUB_ROLES.CLUB_ADMIN] },
];

const CLUB_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Все клубы' },
  { value: 'issues', label: 'Проблемные' },
];

const EMPTY_USER_FORM = {
  id: null,
  email: '',
  firstName: '',
  lastName: '',
  temporaryPassword: '',
  systemRole: SYSTEM_ROLES.USER,
};

const EMPTY_MEMBERSHIP_DRAFT = {
  clubId: '',
  role: CLUB_ROLES.MANAGER,
};

const getServerMessage = (error, fallback) =>
  error.response?.data?.message || fallback || 'Ошибка сервера';

const toId = (value) =>
  value === null || value === undefined ? '' : String(value);

const normalizeUserForm = (
  user = {},
  { withTemporaryPassword = false } = {},
) => ({
  id: user.id ? String(user.id) : null,
  email: user.email || '',
  firstName: user.firstName ?? user.first_name ?? '',
  lastName: user.lastName ?? user.last_name ?? '',
  temporaryPassword: withTemporaryPassword ? generateTemporaryPassword() : '',
  systemRole: user.systemRole ?? user.system_role ?? SYSTEM_ROLES.USER,
});

const getUserName = (user) => {
  const firstName = user.firstName ?? user.first_name ?? '';
  const lastName = user.lastName ?? user.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user.email || `Пользователь #${user.id}`;
};

const getClubName = (club) => club?.name || `Клуб #${club?.id || ''}`;

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('ru-RU');
};

const formatDateTime = (value) => {
  if (!value) return 'Нет данных';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Нет данных';

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeSearchValue = (value) => String(value || '').toLowerCase();

const getUserSearchText = (user, clubsById = new Map()) => {
  const memberships = user.memberships || [];
  const membershipText = memberships
    .map((membership) => {
      const club = membership.club || clubsById.get(toId(membership.clubId));
      return [
        club?.name,
        club?.address,
        membership.role,
        ROLE_LABELS[membership.role],
      ]
        .filter(Boolean)
        .join(' ');
    })
    .join(' ');

  return normalizeSearchValue(
    [
      getUserName(user),
      user.email,
      user.systemRole,
      user.system_role,
      ROLE_LABELS[user.systemRole ?? user.system_role],
      membershipText,
    ]
      .filter(Boolean)
      .join(' '),
  );
};

const generateTemporaryPassword = () => {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(16);

  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * alphabet.length);
    }
  }

  return Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join('');
};

const getSmartshellStatus = (club) => {
  const smartshell = club.settings?.smartshell || {};
  const smartshellCompanyId =
    club.smartshellCompanyId ||
    club.smartshellId ||
    club.smartshell_id ||
    smartshell.companyId;
  const lastSyncAt =
    smartshell.lastSyncAt ||
    smartshell.lastSyncedAt ||
    smartshell.last_sync_at ||
    smartshell.syncedAt ||
    smartshell.updatedAt;
  const integrationError =
    smartshell.integrationError ||
    smartshell.lastError ||
    smartshell.last_error ||
    smartshell.error ||
    '';

  return {
    smartshellCompanyId,
    lastSyncAt,
    integrationError: integrationError ? String(integrationError) : '',
  };
};

const getClubStatus = (club, userCount) => {
  const smartshell = getSmartshellStatus(club);
  const issues = [];

  if (!smartshell.smartshellCompanyId) issues.push('нет Smartshell id');
  if (smartshell.integrationError) issues.push('ошибка интеграции');
  if (!smartshell.lastSyncAt) issues.push('нет данных синхронизации');
  if (userCount < 1) issues.push('нет пользователей');

  if (smartshell.integrationError || !smartshell.smartshellCompanyId) {
    return { level: 'error', label: 'Проблема', issues, ...smartshell };
  }

  if (issues.length) {
    return { level: 'warning', label: 'Проверить', issues, ...smartshell };
  }

  return { level: 'ok', label: 'OK', issues, ...smartshell };
};

const userMatchesRoleFilter = (user, roleFilter) => {
  if (roleFilter === 'all') return true;

  const memberships = user.memberships || [];
  if (roleFilter === 'no_access') return memberships.length === 0;

  if ([SYSTEM_ROLES.PLATFORM_ADMIN, SYSTEM_ROLES.USER].includes(roleFilter)) {
    return (user.systemRole ?? user.system_role) === roleFilter;
  }

  return memberships.some((membership) => membership.role === roleFilter);
};

const StatusBadge = ({ status }) => {
  const isError = status.level === 'error';
  const isWarning = status.level === 'warning';

  return (
    <Badge
      variant={isError ? 'destructive' : isWarning ? 'secondary' : 'outline'}
      className="max-w-full"
    >
      {isError || isWarning ? (
        <AlertTriangle className="h-3 w-3 shrink-0" />
      ) : (
        <CheckCircle2 className="h-3 w-3 shrink-0" />
      )}
      <span className="truncate">{status.label}</span>
    </Badge>
  );
};

const validateUserForm = (form, isCreate) => {
  const errors = {};

  const email = form.email.trim();

  if (!email) errors.email = 'Email обязателен';
  if (!form.firstName.trim()) errors.firstName = 'Имя обязательно';
  if (!form.lastName.trim()) errors.lastName = 'Фамилия обязательна';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Некорректный email';
  }

  if (isCreate && form.temporaryPassword.length < 8) {
    errors.temporaryPassword = 'Временный пароль должен быть не короче 8 символов';
  }

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

const RoleBadge = ({ role }) => (
  <Badge
    variant={role === SYSTEM_ROLES.PLATFORM_ADMIN ? 'default' : 'outline'}
    className="max-w-full"
  >
    <span className="truncate">
      {ROLE_LABELS[role] || (role === SYSTEM_ROLES.USER ? 'Пользователь' : role)}
    </span>
  </Badge>
);

const DashboardPage = () => {
  const navigate = useNavigate();
  const { refreshSession, setActiveClubId } = useAuth();
  const [activeView, setActiveView] = useState('clubs');
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [clubStatusFilter, setClubStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [clubDialog, setClubDialog] = useState({
    open: false,
    mode: 'create',
    form: normalizeClubForm(),
    errors: {},
    serverError: '',
    isSaving: false,
  });
  const [userDialog, setUserDialog] = useState({
    open: false,
    mode: 'create',
    form: { ...EMPTY_USER_FORM },
    errors: {},
    serverError: '',
    isSaving: false,
    membershipDraft: { ...EMPTY_MEMBERSHIP_DRAFT },
    membershipAction: '',
    showFallbackPassword: false,
    user: null,
  });

  const clubsById = useMemo(
    () => new Map(clubs.map((club) => [toId(club.id), club])),
    [clubs],
  );

  const membershipCountByClubId = useMemo(() => {
    const counts = new Map();

    users.forEach((user) => {
      (user.memberships || []).forEach((membership) => {
        const clubId = toId(membership.clubId ?? membership.club_id);
        counts.set(clubId, (counts.get(clubId) || 0) + 1);
      });
    });

    return counts;
  }, [users]);

  const usersByClubId = useMemo(() => {
    const map = new Map();

    users.forEach((user) => {
      (user.memberships || []).forEach((membership) => {
        const clubId = toId(membership.clubId ?? membership.club_id);
        const clubUsers = map.get(clubId) || [];
        clubUsers.push(user);
        map.set(clubId, clubUsers);
      });
    });

    return map;
  }, [users]);

  const clubRows = useMemo(
    () =>
      clubs.map((club) => {
        const clubId = toId(club.id);
        const userCount = membershipCountByClubId.get(clubId) || 0;
        const status = getClubStatus(club, userCount);
        const linkedUsers = usersByClubId.get(clubId) || [];

        return {
          club,
          status,
          userCount,
          linkedUsers,
          searchText: normalizeSearchValue(
            [
              getClubName(club),
              club.address,
              status.smartshellCompanyId,
              status.integrationError,
              linkedUsers.map((user) => `${getUserName(user)} ${user.email}`).join(' '),
            ]
              .filter(Boolean)
              .join(' '),
          ),
        };
      }),
    [clubs, membershipCountByClubId, usersByClubId],
  );

  const sortedClubRows = useMemo(() => {
    const levelOrder = { error: 0, warning: 1, ok: 2 };

    return [...clubRows].sort((left, right) => {
      const levelDiff =
        (levelOrder[left.status.level] ?? 3) -
        (levelOrder[right.status.level] ?? 3);

      if (levelDiff !== 0) return levelDiff;
      return getClubName(left.club).localeCompare(getClubName(right.club), 'ru');
    });
  }, [clubRows]);

  const filteredClubRows = useMemo(() => {
    const query = normalizeSearchValue(searchQuery.trim());
    return sortedClubRows.filter((row) => {
      const matchesSearch = !query || row.searchText.includes(query);
      const matchesStatus =
        clubStatusFilter === 'all' || row.status.level !== 'ok';

      return matchesSearch && matchesStatus;
    });
  }, [clubStatusFilter, searchQuery, sortedClubRows]);

  const filteredUsers = useMemo(() => {
    const query = normalizeSearchValue(searchQuery.trim());

    return users.filter((user) => {
      const matchesSearch =
        !query || getUserSearchText(user, clubsById).includes(query);
      return matchesSearch && userMatchesRoleFilter(user, userRoleFilter);
    });
  }, [clubsById, searchQuery, userRoleFilter, users]);

  const platformStats = useMemo(() => {
    const issueRows = clubRows.filter((row) => row.status.level !== 'ok');

    return {
      clubs: clubs.length,
      users: users.length,
      issueClubs: issueRows.length,
      integrationErrors: clubRows.filter((row) => row.status.integrationError)
        .length,
      usersWithoutAccess: users.filter(
        (user) => !(user.memberships || []).length,
      ).length,
    };
  }, [clubRows, clubs.length, users]);

  const loadPlatformData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError('');

      const [clubsResponse, usersResponse] = await Promise.all([
        api.get('/api/platform/clubs', { skipClubHeader: true }),
        api.get('/api/platform/users', { skipClubHeader: true }),
      ]);

      setClubs(clubsResponse.data?.clubs || []);
      setUsers(usersResponse.data?.users || []);
    } catch (error) {
      setLoadError(getServerMessage(error, 'Не удалось загрузить данные'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformData();
  }, [loadPlatformData]);

  const refreshAfterMutation = async () => {
    await loadPlatformData();
    await refreshSession();
  };

  const openClubDialog = (mode, club = {}) => {
    setClubDialog({
      open: true,
      mode,
      form: normalizeClubForm(club),
      errors: {},
      serverError: '',
      isSaving: false,
    });
  };

  const closeClubDialog = () => {
    setClubDialog((current) => ({ ...current, open: false }));
  };

  const openClubWorkspace = (clubId) => {
    setActiveClubId(toId(clubId));
    navigate('/admin');
  };

  const saveClub = async (event) => {
    event.preventDefault();

    const errors = validateClubSettingsForm(clubDialog.form, {
      requireBasic: true,
      requireSmartshell: true,
    });

    if (Object.keys(errors).length) {
      setClubDialog((current) => ({ ...current, errors }));
      return;
    }

    try {
      setClubDialog((current) => ({
        ...current,
        isSaving: true,
        serverError: '',
      }));

      const payload = buildPlatformClubPayload(clubDialog.form);

      if (clubDialog.mode === 'create') {
        await api.post('/api/platform/clubs', payload, { skipClubHeader: true });
        toast.success('Клуб создан');
      } else {
        await api.patch(`/api/platform/clubs/${clubDialog.form.id}`, payload, {
          skipClubHeader: true,
        });
        toast.success('Клуб обновлен');
      }

      await refreshAfterMutation();
      closeClubDialog();
    } catch (error) {
      setClubDialog((current) => ({
        ...current,
        serverError: getServerMessage(error, 'Не удалось сохранить клуб'),
      }));
    } finally {
      setClubDialog((current) => ({ ...current, isSaving: false }));
    }
  };

  const openUserDialog = (mode, user = null) => {
    setUserDialog({
      open: true,
      mode,
      form: normalizeUserForm(user || {}, {
        withTemporaryPassword: mode === 'create',
      }),
      errors: {},
      serverError: '',
      isSaving: false,
      membershipDraft: { ...EMPTY_MEMBERSHIP_DRAFT },
      membershipAction: '',
      showFallbackPassword: false,
      user,
    });
  };

  const closeUserDialog = () => {
    setUserDialog((current) => ({ ...current, open: false }));
  };

  const regenerateUserTemporaryPassword = () => {
    setUserDialog((current) => ({
      ...current,
      form: {
        ...current.form,
        temporaryPassword: generateTemporaryPassword(),
      },
      errors: {},
    }));
  };

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(
        [
          `Email: ${userDialog.form.email.trim()}`,
          `Fallback: ${userDialog.form.temporaryPassword}`,
        ].join('\n'),
      );
      toast.success('Доступ скопирован');
    } catch (error) {
      toast.error('Не удалось скопировать доступ');
    }
  };

  const toggleFallbackPassword = () => {
    setUserDialog((current) => ({
      ...current,
      showFallbackPassword: !current.showFallbackPassword,
    }));
  };

  const saveUser = async (event) => {
    event.preventDefault();

    const isCreate = userDialog.mode === 'create';
    const errors = validateUserForm(userDialog.form, isCreate);

    if (Object.keys(errors).length) {
      setUserDialog((current) => ({ ...current, errors }));
      return;
    }

    try {
      setUserDialog((current) => ({
        ...current,
        isSaving: true,
        serverError: '',
      }));

      const payload = {
        email: userDialog.form.email.trim(),
        first_name: userDialog.form.firstName.trim(),
        last_name: userDialog.form.lastName.trim(),
        system_role: userDialog.form.systemRole,
      };

      let userId = userDialog.form.id;

      if (isCreate) {
        const response = await api.post(
          '/api/platform/users',
          {
            ...payload,
            password: userDialog.form.temporaryPassword,
          },
          { skipClubHeader: true },
        );

        userId = response.data?.user?.id;

        if (userDialog.membershipDraft.clubId && userId) {
          await api.post(
            `/api/platform/users/${userId}/memberships`,
            {
              clubId: Number(userDialog.membershipDraft.clubId),
              role: userDialog.membershipDraft.role,
            },
            { skipClubHeader: true },
          );
        }

        toast.success('Пользователь создан');
      } else {
        await api.patch(`/api/platform/users/${userId}`, payload, {
          skipClubHeader: true,
        });
        toast.success('Пользователь обновлен');
      }

      await refreshAfterMutation();
      setActiveView('users');
      closeUserDialog();
    } catch (error) {
      setUserDialog((current) => ({
        ...current,
        serverError: getServerMessage(error, 'Не удалось сохранить пользователя'),
      }));
    } finally {
      setUserDialog((current) => ({ ...current, isSaving: false }));
    }
  };

  const setMembershipAction = (action) => {
    setUserDialog((current) => ({ ...current, membershipAction: action }));
  };

  const clearMembershipAction = () => {
    setUserDialog((current) => ({ ...current, membershipAction: '' }));
  };

  const reloadUserDialog = async (userId) => {
    const response = await api.get(`/api/platform/users/${userId}`, {
      skipClubHeader: true,
    });
    const nextUser = response.data?.user;
    if (!nextUser) return;

    setUserDialog((current) => ({
      ...current,
      user: nextUser,
      form: normalizeUserForm(nextUser),
      membershipDraft: { ...EMPTY_MEMBERSHIP_DRAFT },
    }));
  };

  const addMembership = async () => {
    if (!userDialog.membershipDraft.clubId) {
      setUserDialog((current) => ({
        ...current,
        serverError: 'Выберите клуб для доступа',
      }));
      return;
    }

    const userId = userDialog.form.id;

    try {
      setMembershipAction('add');
      await api.post(
        `/api/platform/users/${userId}/memberships`,
        {
          clubId: Number(userDialog.membershipDraft.clubId),
          role: userDialog.membershipDraft.role,
        },
        { skipClubHeader: true },
      );
      toast.success('Доступ добавлен');
      await refreshAfterMutation();
      setActiveView('users');
      await reloadUserDialog(userId);
    } catch (error) {
      setUserDialog((current) => ({
        ...current,
        serverError: getServerMessage(error, 'Не удалось добавить доступ'),
      }));
    } finally {
      clearMembershipAction();
    }
  };

  const updateMembership = async (clubId, role) => {
    const userId = userDialog.form.id;
    const actionKey = `update:${clubId}`;

    try {
      setMembershipAction(actionKey);
      await api.patch(
        `/api/platform/users/${userId}/memberships/${clubId}`,
        { role },
        { skipClubHeader: true },
      );
      toast.success('Роль обновлена');
      await refreshAfterMutation();
      setActiveView('users');
      await reloadUserDialog(userId);
    } catch (error) {
      setUserDialog((current) => ({
        ...current,
        serverError: getServerMessage(error, 'Не удалось обновить роль'),
      }));
    } finally {
      clearMembershipAction();
    }
  };

  const removeMembership = async (clubId) => {
    const userId = userDialog.form.id;
    const actionKey = `remove:${clubId}`;

    try {
      setMembershipAction(actionKey);
      await api.delete(`/api/platform/users/${userId}/memberships/${clubId}`, {
        skipClubHeader: true,
      });
      toast.success('Доступ удален');
      await refreshAfterMutation();
      setActiveView('users');
      await reloadUserDialog(userId);
    } catch (error) {
      setUserDialog((current) => ({
        ...current,
        serverError: getServerMessage(error, 'Не удалось удалить доступ'),
      }));
    } finally {
      clearMembershipAction();
    }
  };

  const selectedMembershipClubIds = new Set(
    (userDialog.user?.memberships || []).map((membership) =>
      toId(membership.clubId ?? membership.club_id),
    ),
  );
  const availableMembershipClubs = clubs.filter(
    (club) => !selectedMembershipClubIds.has(toId(club.id)),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Управление платформой
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Клубы, пользователи и роли доступа.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {VIEW_TABS.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              data-testid={`platform-tab-${tab.value}`}
              variant={activeView === tab.value ? 'default' : 'outline'}
              onClick={() => setActiveView(tab.value)}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={loadPlatformData}
            disabled={isLoading}
            title="Обновить"
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
            Обновить
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
            placeholder={
              activeView === 'clubs'
                ? 'Клуб, Smartshell id или пользователь'
                : 'Имя, email, клуб или роль'
            }
            className="pl-9"
          />
        </div>

        {activeView === 'users' ? (
          <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4 md:grid-cols-2">
            <div className="rounded-md border border-border px-3 py-2">
              <div className="font-medium text-foreground">
                {platformStats.clubs}
              </div>
              <div>клубов</div>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <div className="font-medium text-foreground">
                {platformStats.issueClubs}
              </div>
              <div>проверить</div>
            </div>
          </div>
        )}
      </div>

      {activeView === 'clubs' ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                Ошибки интеграции
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {platformStats.integrationErrors}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                Клубы без пользователей
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {
                  clubRows.filter((row) => row.userCount < 1).length
                }
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                Пользователи без клуба
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {platformStats.usersWithoutAccess}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Клубы</h2>
              <p className="text-sm text-muted-foreground">
                {filteredClubRows.length
                  ? `Показано: ${filteredClubRows.length} из ${clubs.length}`
                  : 'Список пуст'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CLUB_STATUS_FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    clubStatusFilter === option.value ? 'default' : 'outline'
                  }
                  onClick={() => setClubStatusFilter(option.value)}
                >
                  {option.value === 'issues' && (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {option.label}
                  {option.value === 'issues'
                    ? ` (${platformStats.issueClubs})`
                    : ''}
                </Button>
              ))}
              <Button
                type="button"
                data-testid="create-club-button"
                onClick={() => openClubDialog('create')}
              >
                <Plus className="h-4 w-4" />
                Создать клуб
              </Button>
            </div>
          </div>

          {isLoading ? (
            <EmptyState title="Загрузка клубов..." />
          ) : filteredClubRows.length ? (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Клуб</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Smartshell</TableHead>
                    <TableHead>Последняя синхронизация</TableHead>
                    <TableHead className="text-right">Пользователи</TableHead>
                    <TableHead className="w-24 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClubRows.map(({ club, status, userCount }) => {
                    const issues = status.issues.join(', ');

                    return (
                      <TableRow key={club.id}>
                        <TableCell className="min-w-56">
                          <div className="font-medium">{getClubName(club)}</div>
                          <div className="max-w-80 truncate text-xs text-muted-foreground">
                            {club.address || 'Адрес не указан'}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Открытие: {formatDate(club.openingDate)}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-40">
                          <div className="flex max-w-56 flex-col gap-1">
                            <StatusBadge status={status} />
                            {issues && (
                              <span className="truncate text-xs text-muted-foreground">
                                {issues}
                              </span>
                            )}
                            {status.integrationError && (
                              <span className="truncate text-xs text-destructive">
                                {status.integrationError}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {status.smartshellCompanyId || 'Не указан'}
                        </TableCell>
                        <TableCell>{formatDateTime(status.lastSyncAt)}</TableCell>
                        <TableCell className="text-right">{userCount}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openClubWorkspace(club.id)}
                              title="Открыть клуб"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              data-testid={`edit-club-${club.id}`}
                              variant="ghost"
                              size="icon"
                              onClick={() => openClubDialog('edit', club)}
                              title="Редактировать клуб"
                            >
                              <Pencil className="h-4 w-4" />
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
            <EmptyState title="Клубы по фильтрам не найдены" />
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Пользователи</h2>
              <p className="text-sm text-muted-foreground">
                {filteredUsers.length
                  ? `Показано: ${filteredUsers.length} из ${users.length}`
                  : 'Список пуст'}
              </p>
            </div>
            <Button
              type="button"
              data-testid="create-user-button"
              onClick={() => openUserDialog('create')}
            >
              <UserPlus className="h-4 w-4" />
              Создать пользователя
            </Button>
          </div>

          {isLoading ? (
            <EmptyState title="Загрузка пользователей..." />
          ) : filteredUsers.length ? (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Системная роль</TableHead>
                    <TableHead>Доступы</TableHead>
                    <TableHead className="w-14"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="min-w-56">
                        <div className="font-medium">{getUserName(user)}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.systemRole ?? user.system_role} />
                      </TableCell>
                      <TableCell className="min-w-72">
                        <div className="flex max-w-xl flex-wrap gap-1.5">
                          {(user.memberships || []).length ? (
                            user.memberships.map((membership) => (
                              <Badge
                                key={`${membership.clubId}-${membership.role}`}
                                variant="outline"
                              >
                                <span className="max-w-44 truncate">
                                  {membership.club?.name ||
                                    getClubName(
                                      clubsById.get(toId(membership.clubId)),
                                    )}
                                </span>
                                <span className="text-muted-foreground">
                                  {ROLE_LABELS[membership.role] || membership.role}
                                </span>
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="destructive">Без доступа</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          data-testid={`edit-user-${user.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => openUserDialog('edit', user)}
                          title="Редактировать пользователя"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="Пользователи по фильтрам не найдены" />
          )}
        </section>
      )}

      <Dialog
        open={clubDialog.open}
        onOpenChange={(open) => !open && closeClubDialog()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>
              {clubDialog.mode === 'create' ? 'Создать клуб' : 'Редактировать клуб'}
            </DialogTitle>
            <DialogDescription>
              Основные данные, Smartshell company id и настройки выплат.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveClub} className="space-y-6">
            <ErrorBlock>{clubDialog.serverError}</ErrorBlock>
            <ClubSettingsForm
              form={clubDialog.form}
              onChange={(form) =>
                setClubDialog((current) => ({
                  ...current,
                  form,
                  errors: {},
                }))
              }
              errors={clubDialog.errors}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeClubDialog}
                disabled={clubDialog.isSaving}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={clubDialog.isSaving}>
                {clubDialog.isSaving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={userDialog.open}
        onOpenChange={(open) => !open && closeUserDialog()}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>
              {userDialog.mode === 'create'
                ? 'Создать пользователя'
                : 'Редактировать пользователя'}
            </DialogTitle>
            <DialogDescription>
              Профиль, системная роль и доступы к клубам.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveUser} className="space-y-6">
            <ErrorBlock>{userDialog.serverError}</ErrorBlock>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Профиль
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={userDialog.form.email}
                    onChange={(event) =>
                      setUserDialog((current) => ({
                        ...current,
                        form: { ...current.form, email: event.target.value },
                        errors: {},
                      }))
                    }
                    aria-invalid={Boolean(userDialog.errors.email)}
                  />
                  <FieldError>{userDialog.errors.email}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="user-first-name">Имя</Label>
                  <Input
                    id="user-first-name"
                    value={userDialog.form.firstName}
                    onChange={(event) =>
                      setUserDialog((current) => ({
                        ...current,
                        form: { ...current.form, firstName: event.target.value },
                        errors: {},
                      }))
                    }
                    aria-invalid={Boolean(userDialog.errors.firstName)}
                  />
                  <FieldError>{userDialog.errors.firstName}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="user-last-name">Фамилия</Label>
                  <Input
                    id="user-last-name"
                    value={userDialog.form.lastName}
                    onChange={(event) =>
                      setUserDialog((current) => ({
                        ...current,
                        form: { ...current.form, lastName: event.target.value },
                        errors: {},
                      }))
                    }
                    aria-invalid={Boolean(userDialog.errors.lastName)}
                  />
                  <FieldError>{userDialog.errors.lastName}</FieldError>
                </div>

                {userDialog.mode === 'create' && (
                  <InvitationReadyPanel
                    password={userDialog.form.temporaryPassword}
                    error={userDialog.errors.temporaryPassword}
                    isVisible={userDialog.showFallbackPassword}
                    onCopy={copyTemporaryPassword}
                    onRegenerate={regenerateUserTemporaryPassword}
                    onToggleVisible={toggleFallbackPassword}
                  />
                )}

                <div className="space-y-1.5">
                  <Label>Системная роль</Label>
                  <Select
                    value={userDialog.form.systemRole}
                    onValueChange={(value) =>
                      setUserDialog((current) => ({
                        ...current,
                        form: { ...current.form, systemRole: value },
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Доступы
              </h3>

              {userDialog.mode === 'edit' ? (
                <div className="space-y-3">
                  {(userDialog.user?.memberships || []).length ? (
                    userDialog.user.memberships.map((membership) => {
                      const clubId = toId(membership.clubId ?? membership.club_id);
                      const club = membership.club || clubsById.get(clubId);
                      const isUpdating =
                        userDialog.membershipAction === `update:${clubId}`;
                      const isRemoving =
                        userDialog.membershipAction === `remove:${clubId}`;

                      return (
                        <div
                          key={clubId}
                          className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_180px_auto]"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {getClubName(club)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ID {clubId}
                            </div>
                          </div>
                          <Select
                            value={membership.role}
                            onValueChange={(role) =>
                              updateMembership(clubId, role)
                            }
                            disabled={Boolean(userDialog.membershipAction)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLUB_ROLE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMembership(clubId)}
                            disabled={Boolean(userDialog.membershipAction)}
                            title="Удалить доступ"
                          >
                            {isUpdating || isRemoving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState title="Доступы не назначены" />
                  )}

                  <div className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_180px_auto]">
                    <Select
                      value={userDialog.membershipDraft.clubId}
                      onValueChange={(value) =>
                        setUserDialog((current) => ({
                          ...current,
                          membershipDraft: {
                            ...current.membershipDraft,
                            clubId: value,
                          },
                          serverError: '',
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Клуб" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembershipClubs.map((club) => (
                          <SelectItem key={club.id} value={toId(club.id)}>
                            {getClubName(club)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={userDialog.membershipDraft.role}
                      onValueChange={(value) =>
                        setUserDialog((current) => ({
                          ...current,
                          membershipDraft: {
                            ...current.membershipDraft,
                            role: value,
                          },
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

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addMembership}
                      disabled={
                        userDialog.membershipAction === 'add' ||
                        availableMembershipClubs.length === 0
                      }
                    >
                      {userDialog.membershipAction === 'add' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Добавить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_180px]">
                  <Select
                    value={userDialog.membershipDraft.clubId}
                    onValueChange={(value) =>
                      setUserDialog((current) => ({
                        ...current,
                        membershipDraft: {
                          ...current.membershipDraft,
                          clubId: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Клуб" />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={toId(club.id)}>
                          {getClubName(club)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={userDialog.membershipDraft.role}
                    onValueChange={(value) =>
                      setUserDialog((current) => ({
                        ...current,
                        membershipDraft: {
                          ...current.membershipDraft,
                          role: value,
                        },
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
                </div>
              )}
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeUserDialog}
                disabled={userDialog.isSaving}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={userDialog.isSaving}>
                {userDialog.isSaving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                <Shield className="h-4 w-4" />
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
