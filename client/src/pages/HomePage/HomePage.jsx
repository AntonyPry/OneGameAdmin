import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Table, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  CLUB_ROLES,
  SYSTEM_ROLES,
  hasRouteAccess,
} from '@/lib/auth-session';

const cards = [
  {
    to: '/dashboard',
    title: 'Клубы и пользователи',
    icon: Building2,
    requiredSystemRoles: [SYSTEM_ROLES.PLATFORM_ADMIN],
    allowPlatformAdmin: false,
  },
  {
    to: '/admin',
    title: 'Панель администратора',
    icon: User,
    requiredClubRoles: [
      CLUB_ROLES.CLUB_ADMIN,
      CLUB_ROLES.MANAGER,
      CLUB_ROLES.OWNER,
    ],
    requiresActiveClub: true,
  },
  {
    to: '/plans',
    title: 'Планы продаж',
    icon: CalendarDays,
    requiredClubRoles: [CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER],
    requiresActiveClub: true,
  },
  {
    to: '/export',
    title: 'Экспорт статистики',
    icon: Table,
    requiredClubRoles: [CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER],
    requiresActiveClub: true,
  },
];

const HomePage = () => {
  const { session } = useAuth();
  const visibleCards = cards.filter(
    (card) =>
      hasRouteAccess(session, card) &&
      (!card.requiresActiveClub || session.activeClubId),
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="flex min-h-32 items-center justify-between rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-accent/40"
          >
            <h3 className="text-xl font-semibold tracking-tight">
              {card.title}
            </h3>
            <card.icon className="h-10 w-10 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
