import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import {
  getDefaultAuthorizedPath,
  hasRouteAccess,
  isAuthenticatedSession,
  isPlatformAdminSession,
} from '@/lib/auth-session';

export const AuthLoadingState = () => (
  <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" />
    Загрузка сессии...
  </div>
);

export const NoClubState = () => {
  const { session } = useAuth();
  const isPlatformAdmin = isPlatformAdminSession(session);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader>
          <CardTitle>
            {isPlatformAdmin ? 'Клуб не выбран' : 'Нет доступных клубов'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {isPlatformAdmin
            ? 'Для клубных экранов выберите активный support-клуб в переключателе.'
            : 'Ваш аккаунт пока не привязан к клубу. Обратитесь к владельцу или платформенному администратору.'}
        </CardContent>
      </Card>
    </div>
  );
};

const ProtectedRoute = ({
  children,
  requiredSystemRoles = [],
  requiredClubRoles = [],
  allowPlatformAdmin = true,
  requiresActiveClub = false,
}) => {
  const location = useLocation();
  const { session, isRefreshing } = useAuth();

  if (isRefreshing) {
    return <AuthLoadingState />;
  }

  if (!isAuthenticatedSession(session)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const hasAccess = hasRouteAccess(session, {
    requiredSystemRoles,
    requiredClubRoles,
    allowPlatformAdmin,
  });

  if (!hasAccess) {
    const fallbackPath = getDefaultAuthorizedPath(session);
    return fallbackPath ? (
      <Navigate to={fallbackPath} replace />
    ) : (
      <NoClubState />
    );
  }

  if (requiresActiveClub && !session.activeClubId) {
    return <NoClubState />;
  }

  return children;
};

export default ProtectedRoute;
