import axios from 'axios';
import {
  AUTH_EVENTS,
  clearAuthSession,
  getAccessToken,
  getActiveClubId,
} from '@/lib/auth-session';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || '',
});

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    const activeClubId = getActiveClubId();
    config.headers = config.headers || {};

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (activeClubId && !config.skipClubHeader) {
      config.headers['X-Club-ID'] = activeClubId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const shouldRedirect = !error.config?.skipAuthRedirect;

    if (status === 401) {
      clearAuthSession();
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.UNAUTHORIZED));

      if (shouldRedirect && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    if (status === 403) {
      window.dispatchEvent(new CustomEvent(AUTH_EVENTS.FORBIDDEN));
    }

    return Promise.reject(error);
  },
);

export default api;
