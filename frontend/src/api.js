import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const API = `${BACKEND_URL.replace(/\/$/, '')}/api`;

const api = axios.create({ baseURL: API, timeout: 15000 });

const announceApiStatus = (status, detail = '') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('orison-api-status', {
      detail: { status, detail },
    }));
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('orison_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    announceApiStatus('online');
    return res;
  },
  (err) => {
    if (!err.response) {
      announceApiStatus(
        'offline',
        err.code === 'ECONNABORTED'
          ? 'The server is taking too long to respond.'
          : 'The school server is currently unreachable.'
      );
    }
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('orison_token');
      localStorage.removeItem('orison_auth');
      if (window.location.pathname !== '/') window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
