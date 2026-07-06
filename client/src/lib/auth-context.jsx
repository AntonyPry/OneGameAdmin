import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '@/api';
import {
  AUTH_EVENTS,
  buildAuthSession,
  clearAuthSession,
  readAuthSession,
  setSessionActiveClub,
  writeAuthSession,
} from '@/lib/auth-session';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSessionState] = useState(() => readAuthSession());
  const [isRefreshing, setIsRefreshing] = useState(() =>
    Boolean(readAuthSession().token),
  );

  const persistSession = useCallback((nextSession) => {
    const savedSession = writeAuthSession(nextSession);
    setSessionState(savedSession);
    return savedSession;
  }, []);

  const resetSession = useCallback(() => {
    const emptySession = clearAuthSession();
    setSessionState(emptySession);
    return emptySession;
  }, []);

  const refreshSession = useCallback(async () => {
    const currentSession = readAuthSession();

    if (!currentSession.token) {
      setIsRefreshing(false);
      resetSession();
      return null;
    }

    try {
      setIsRefreshing(true);
      const response = await api.get('/api/auth/me', {
        skipAuthRedirect: true,
      });
      const refreshedSession = buildAuthSession(response.data, {
        previous: currentSession,
        token: currentSession.token,
        activeClubId: currentSession.activeClubId,
      });

      return persistSession(refreshedSession);
    } catch (error) {
      resetSession();
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [persistSession, resetSession]);

  const login = useCallback(
    (payload) => {
      const currentSession = readAuthSession();
      const nextSession = buildAuthSession(payload, {
        previous: currentSession,
        token: payload?.token,
        activeClubId: currentSession.activeClubId,
      });

      return persistSession(nextSession);
    },
    [persistSession],
  );

  const logout = useCallback(() => resetSession(), [resetSession]);

  const setActiveClubId = useCallback(
    (clubId) => {
      const nextSession = setSessionActiveClub(readAuthSession(), clubId);
      return persistSession(nextSession);
    },
    [persistSession],
  );

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const handleSessionChanged = (event) => {
      setSessionState(event.detail || readAuthSession());
    };

    const handleUnauthorized = () => {
      resetSession();
    };

    window.addEventListener(AUTH_EVENTS.SESSION_CHANGED, handleSessionChanged);
    window.addEventListener(AUTH_EVENTS.UNAUTHORIZED, handleUnauthorized);

    return () => {
      window.removeEventListener(
        AUTH_EVENTS.SESSION_CHANGED,
        handleSessionChanged,
      );
      window.removeEventListener(AUTH_EVENTS.UNAUTHORIZED, handleUnauthorized);
    };
  }, [resetSession]);

  const value = useMemo(
    () => ({
      session,
      isRefreshing,
      login,
      logout,
      refreshSession,
      setActiveClubId,
    }),
    [isRefreshing, login, logout, refreshSession, session, setActiveClubId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
