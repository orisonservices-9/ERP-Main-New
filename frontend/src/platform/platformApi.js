import axios from 'axios';
import { API } from '../api';

// The platform (Orison owner) session is kept apart from school logins and is cleared when the tab closes.
const KEY = 'orison_platform_token';
export const getToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setToken = (token) => {
  try { if (token) sessionStorage.setItem(KEY, token); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
};

const pApi = axios.create({ baseURL: `${API}/platform`, timeout: 20000 });

pApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

pApi.interceptors.response.use((res) => res, (err) => {
  const status = err.response?.status;
  const url = err.config?.url || '';
  const here = window.location.pathname;
  if (status === 401 && !url.includes('/auth/login')) {
    setToken(null);
    if (!here.startsWith('/platform/login')) window.location.href = '/platform/login';
  } else if (status === 403 && /two-step/i.test(err.response?.data?.detail || '') && !here.startsWith('/platform/setup-2fa')) {
    window.location.href = '/platform/setup-2fa';
  }
  return Promise.reject(err);
});

export const errText = (err, fallback = 'Something went wrong. Please try again.') => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, '');
  if (!err?.response) return 'The server is not reachable. Check your connection.';
  return fallback;
};

export default pApi;
