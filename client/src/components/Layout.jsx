import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  LogOut,
  Moon,
  Settings,
  Sun,
  Table,
  User,
  Users,
} from 'lucide-react';
import api from '@/api';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import {
  CLUB_ROLES,
  ROLE_LABELS,
  SYSTEM_ROLES,
  getActiveMembership,
  getDefaultAuthorizedPath,
  hasRouteAccess,
  isPlatformAdminSession,
} from '@/lib/auth-session';

const navItems = [
  {
    path: '/dashboard',
    icon: Building2,
    label: 'Клубы и пользователи',
    requiredSystemRoles: [SYSTEM_ROLES.PLATFORM_ADMIN],
    allowPlatformAdmin: false,
  },
  {
    path: '/admin',
    icon: User,
    label: 'Панель админа',
    requiredClubRoles: [
      CLUB_ROLES.CLUB_ADMIN,
      CLUB_ROLES.MANAGER,
      CLUB_ROLES.OWNER,
    ],
    allowPlatformAdmin: true,
    requiresActiveClub: true,
  },
  {
    path: '/plans',
    icon: CalendarDays,
    label: 'Планы продаж',
    requiredClubRoles: [CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER],
    allowPlatformAdmin: true,
    requiresActiveClub: true,
  },
  {
    path: '/settings',
    icon: Settings,
    label: 'Настройки клуба',
    requiredClubRoles: [CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER],
    allowPlatformAdmin: false,
    requiresActiveClub: true,
  },
  {
    path: '/users',
    icon: Users,
    label: 'Пользователи',
    requiredClubRoles: [CLUB_ROLES.OWNER],
    allowPlatformAdmin: false,
    requiresActiveClub: true,
  },
  {
    path: '/export',
    icon: Table,
    label: 'Экспорт статистики',
    requiredClubRoles: [CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER],
    allowPlatformAdmin: true,
    requiresActiveClub: true,
  },
];

const getRouteAccess = (pathname) =>
  navItems.find((item) => item.path === pathname) || null;

const roleLabel = (session) => {
  if (isPlatformAdminSession(session)) return ROLE_LABELS.platform_admin;
  return ROLE_LABELS[session.activeClubRole] || 'Пользователь';
};

const getClubName = (club) => club?.name || `Клуб #${club?.id || ''}`;

const ClubSwitcher = ({
  session,
  onClubChange,
  platformClubs = [],
  isLoadingPlatformClubs = false,
  platformClubsError = '',
}) => {
  if (isPlatformAdminSession(session)) {
    if (isLoadingPlatformClubs) {
      return (
        <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
          Загрузка клубов...
        </div>
      );
    }

    if (platformClubsError) {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {platformClubsError}
        </div>
      );
    }

    if (platformClubs.length > 0) {
      return (
        <Select value={session.activeClubId || ''} onValueChange={onClubChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите клуб" />
          </SelectTrigger>
          <SelectContent>
            {platformClubs.map((club) => (
              <SelectItem key={club.id} value={String(club.id)}>
                {getClubName(club)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
        Клубы не найдены
      </div>
    );
  }

  const memberships = session.memberships || [];
  const activeMembership = getActiveMembership(session);

  if (memberships.length > 1) {
    return (
      <Select value={session.activeClubId || ''} onValueChange={onClubChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите клуб" />
        </SelectTrigger>
        <SelectContent>
          {memberships.map((membership) => (
            <SelectItem key={membership.clubId} value={membership.clubId}>
              {membership.club.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (memberships.length === 1 && activeMembership) {
    return (
      <div className="min-w-0 rounded-md border border-border px-3 py-2 text-sm">
        <div className="truncate font-medium">{activeMembership.club.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {ROLE_LABELS[activeMembership.role] || activeMembership.role}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
      Клуб не назначен
    </div>
  );
};

const NavItems = ({ items, mobile = false }) => (
  <nav
    className={
      mobile
        ? 'flex gap-2 overflow-x-auto px-3 pb-3'
        : 'flex flex-1 flex-col gap-1 p-4'
    }
  >
    {items.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) =>
          [
            'flex items-center gap-3 rounded-md text-sm font-medium transition-colors',
            mobile
              ? 'min-w-fit px-3 py-2'
              : 'px-3 py-2.5',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          ].join(' ')
        }
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={mobile ? 'whitespace-nowrap' : ''}>{item.label}</span>
      </NavLink>
    ))}
  </nav>
);

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { session, logout, setActiveClubId } = useAuth();
  const [platformClubs, setPlatformClubs] = useState([]);
  const [isLoadingPlatformClubs, setIsLoadingPlatformClubs] = useState(false);
  const [platformClubsError, setPlatformClubsError] = useState('');

  const loadPlatformClubs = useCallback(async () => {
    if (!isPlatformAdminSession(session)) {
      setPlatformClubs([]);
      setPlatformClubsError('');
      setIsLoadingPlatformClubs(false);
      return;
    }

    try {
      setIsLoadingPlatformClubs(true);
      setPlatformClubsError('');
      const response = await api.get('/api/platform/clubs', {
        skipClubHeader: true,
      });
      setPlatformClubs(response.data?.clubs || []);
    } catch (error) {
      setPlatformClubs([]);
      setPlatformClubsError(
        error.response?.data?.message || 'Не удалось загрузить клубы',
      );
    } finally {
      setIsLoadingPlatformClubs(false);
    }
  }, [session.systemRole]);

  useEffect(() => {
    loadPlatformClubs();
  }, [loadPlatformClubs]);

  const visibleNavItems = navItems.filter((item) => {
    const canOpen = hasRouteAccess(session, item);
    const hasClubContext = !item.requiresActiveClub || session.activeClubId;
    return canOpen && hasClubContext;
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleClubChange = (clubId) => {
    const nextSession = setActiveClubId(clubId);
    const routeAccess = getRouteAccess(location.pathname);

    if (
      routeAccess &&
      (!hasRouteAccess(nextSession, routeAccess) ||
        (routeAccess.requiresActiveClub && !nextSession.activeClubId))
    ) {
      navigate(getDefaultAuthorizedPath(nextSession) || '/', { replace: true });
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            OneGame Admin
          </h1>
        </div>

        <div className="space-y-3 border-b border-border p-4">
          <ClubSwitcher
            session={session}
            onClubChange={handleClubChange}
            platformClubs={platformClubs}
            isLoadingPlatformClubs={isLoadingPlatformClubs}
            platformClubsError={platformClubsError}
          />
          <div className="min-w-0 text-xs text-muted-foreground">
            <div className="truncate">{session.user?.email || ''}</div>
            <div className="truncate">{roleLabel(session)}</div>
          </div>
        </div>

        <NavItems items={visibleNavItems} />

        <div className="flex flex-col gap-2 border-t border-border p-4">
          <Button
            type="button"
            variant="ghost"
            className="justify-start gap-3"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )}
            {theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="justify-start gap-3 text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Выйти
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-40 border-b border-border bg-card md:hidden">
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="truncate text-base font-bold">OneGame Admin</div>
              <div className="truncate text-xs text-muted-foreground">
                {roleLabel(session)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title="Сменить тему"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Выйти"
              >
                <LogOut className="h-5 w-5 text-red-500" />
              </Button>
            </div>
          </div>
          <div className="px-3 pb-3">
            <ClubSwitcher
              session={session}
              onClubChange={handleClubChange}
              platformClubs={platformClubs}
              isLoadingPlatformClubs={isLoadingPlatformClubs}
              platformClubsError={platformClubsError}
            />
          </div>
          <NavItems items={visibleNavItems} mobile />
        </header>

        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
