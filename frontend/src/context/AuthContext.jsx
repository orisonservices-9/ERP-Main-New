import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem('orison_auth');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (!auth || !localStorage.getItem('orison_token')) return;

    let active = true;
    api.get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        const verified = { ...auth, ...data };
        localStorage.setItem('orison_auth', JSON.stringify(verified));
        setAuth(verified);
      })
      .catch((err) => {
        if (err.response?.status === 401 && active) setAuth(null);
      });

    return () => { active = false; };
    // Validate only when a stored session is first restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (role) => {
    const { data } = await api.post('/auth/login', { role });
    localStorage.setItem('orison_token', data.token);
    localStorage.setItem('orison_auth', JSON.stringify(data));
    setAuth(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('orison_token');
    localStorage.removeItem('orison_auth');
    setAuth(null);
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
