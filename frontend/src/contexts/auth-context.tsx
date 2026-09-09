'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/auth-api';
import {
  clearTokens,
  getAccessToken,
  setTokens,
} from '@/lib/auth-storage';
import type { AuthMeResponse } from '@/types/auth';

type AuthContextValue = {
  user: AuthMeResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  register: (
    phone: string,
    password: string,
    displayName?: string,
    role?: 'customer' | 'professional',
  ) => Promise<AuthMeResponse>;
  requestOtp: (phone: string, purpose?: string) => Promise<{ expiresIn: number }>;
  verifyOtp: (phone: string, code: string, purpose?: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    let token = getAccessToken();
    // Silent session restore via httpOnly refresh cookie when memory is empty (e.g. page reload)
    if (!token) {
      try {
        const tokens = await authApi.refresh();
        if (tokens?.accessToken) {
          setTokens(tokens.accessToken);
          token = tokens.accessToken;
        }
      } catch {
        clearTokens();
        setUser(null);
        setLoading(false);
        return;
      }
    }
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me(token);
      setUser(me);
    } catch {
      try {
        const tokens = await authApi.refresh();
        setTokens(tokens.accessToken);
        const me = await authApi.me(tokens.accessToken);
        setUser(me);
      } catch {
        clearTokens();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const loginWithPassword = useCallback(async (phone: string, password: string) => {
    const res = await authApi.login({ phone, password });
    setTokens(res.accessToken);
    const me = await authApi.me(res.accessToken);
    setUser(me);
  }, []);

  const register = useCallback(
    async (
      phone: string,
      password: string,
      displayName?: string,
      role?: 'customer' | 'professional',
    ) => {
      const res = await authApi.register({ phone, password, displayName, role });
      setTokens(res.accessToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
      return me;
    },
    [],
  );

  const requestOtp = useCallback(async (phone: string, purpose = 'login') => {
    const res = await authApi.requestOtp({ phone, purpose });
    return { expiresIn: res.expiresIn };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string, purpose = 'login') => {
      const res = await authApi.verifyOtp({ phone, code, purpose });
      setTokens(res.accessToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clearTokens();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!user?.roles?.length) return false;
      const need = Array.isArray(role) ? role : [role];
      return need.some((r) => user.roles.includes(r));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      hasRole,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logout,
      reload,
    }),
    [
      user,
      loading,
      hasRole,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logout,
      reload,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
