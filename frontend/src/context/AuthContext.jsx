import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [activeBranch, setActiveBranchState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('orison_active_branch')) || { id: 'BR-MAIN', name: 'Orison Main Campus' }; } catch { return { id: 'BR-MAIN', name: 'Orison Main Campus' }; }
  });
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
        if (data.default_branch && !data.branch_ids?.includes('*') && !data.branch_ids?.includes(activeBranch.id)) {
          setActiveBranch(data.default_branch);
        }
      })
      .catch((err) => {
        if (err.response?.status === 401 && active) setAuth(null);
      });

    return () => { active = false; };
    // Validate only when a stored session is first restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (role, credentials = {}) => {
    const { data } = await api.post('/auth/login', { role, ...credentials });
    localStorage.setItem('orison_token', data.token);
    localStorage.setItem('orison_auth', JSON.stringify(data));
    if (data.default_branch) {
      localStorage.setItem('orison_active_branch', JSON.stringify(data.default_branch));
      localStorage.setItem('orison_branch_id', data.default_branch.id);
      setActiveBranchState(data.default_branch);
    }
    setAuth(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('orison_token');
    localStorage.removeItem('orison_auth');
    setAuth(null);
  };
  const setActiveBranch = (branch) => {
    const selected = branch || { id: 'BR-MAIN', name: 'Orison Main Campus' };
    localStorage.setItem('orison_active_branch', JSON.stringify(selected));
    localStorage.setItem('orison_branch_id', selected.id);
    setActiveBranchState(selected);
  };

  useEffect(() => { localStorage.setItem('orison_branch_id', activeBranch.id || 'BR-MAIN'); }, [activeBranch]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, activeBranch, setActiveBranch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
