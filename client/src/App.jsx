import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage/LoginPage';
import ExportStatisticsPage from './pages/ExportStatisticsPage/ExportStatisticsPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import HomePage from './pages/HomePage/HomePage';
import AdminPage from './pages/AdminPage/AdminPage';
import ClubSettingsPage from './pages/ClubSettingsPage/ClubSettingsPage';
import OwnerClubUsersPage from './pages/OwnerClubUsersPage/OwnerClubUsersPage';
import ProtectedRoute, {
  AuthLoadingState,
  NoClubState,
} from './components/ProtectedRoute';
import PlansPage from './pages/PlansPage/PlansPage';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import {
  CLUB_ROLES,
  SYSTEM_ROLES,
  getDefaultAuthorizedPath,
  isAuthenticatedSession,
} from '@/lib/auth-session';

const RootRedirect = () => {
  const { session, isRefreshing } = useAuth();

  if (isRefreshing) return <AuthLoadingState />;

  if (!isAuthenticatedSession(session)) {
    return <Navigate to="/login" replace />;
  }

  const defaultPath = getDefaultAuthorizedPath(session);
  return defaultPath ? <Navigate to={defaultPath} replace /> : <NoClubState />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />

    <Route element={<Layout />}>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/export"
        element={
          <ProtectedRoute
            requiredClubRoles={[CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER]}
            requiresActiveClub
          >
            <ExportStatisticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans"
        element={
          <ProtectedRoute
            requiredClubRoles={[CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER]}
            requiresActiveClub
          >
            <PlansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute
            requiredSystemRoles={[SYSTEM_ROLES.PLATFORM_ADMIN]}
            allowPlatformAdmin={false}
          >
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute
            requiredClubRoles={[CLUB_ROLES.OWNER, CLUB_ROLES.MANAGER]}
            allowPlatformAdmin={false}
            requiresActiveClub
          >
            <ClubSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute
            requiredClubRoles={[CLUB_ROLES.OWNER]}
            allowPlatformAdmin={false}
            requiresActiveClub
          >
            <OwnerClubUsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute
            requiredClubRoles={[
              CLUB_ROLES.CLUB_ADMIN,
              CLUB_ROLES.MANAGER,
              CLUB_ROLES.OWNER,
            ]}
            requiresActiveClub
          >
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<RootRedirect />} />
    </Route>
  </Routes>
);

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="onegame-theme">
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
);

export default App;
