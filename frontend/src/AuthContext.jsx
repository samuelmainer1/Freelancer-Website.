import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

export const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('fh_user') || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('fh_token'));
  const [user, setUser] = useState(readStoredUser);
  const [booting, setBooting] = useState(() => !!localStorage.getItem('fh_token'));

  // Validate the stored token against the API on first load
  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    api('/auth/me', { token })
      .then((d) => persist(d.token ?? token, d.user))
      .catch(() => persist(null, null))
      .finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(t, u) {
    setToken(t);
    setUser(u);
    if (t) {
      localStorage.setItem('fh_token', t);
      localStorage.setItem('fh_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('fh_token');
      localStorage.removeItem('fh_user');
    }
  }

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    persist(d.token, d.user);
    return d.user;
  }, []);

  const register = useCallback(async (payload) => {
    const d = await api('/auth/register', { method: 'POST', body: payload });
    persist(d.token, d.user);
    return d.user;
  }, []);

  const logout = useCallback(() => persist(null, null), []);

  // Re-fetch the signed-in user (e.g. after saving profile changes)
  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const d = await api('/auth/me', { token });
    persist(d.token ?? token, d.user);
    return d.user;
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, user, booting, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
