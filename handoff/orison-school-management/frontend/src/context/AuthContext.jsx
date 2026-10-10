import React, { createContext, useContext, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const raw = localStorage.getItem('orison_auth');
    return raw ? JSON.parse(raw) : null;
  });

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
