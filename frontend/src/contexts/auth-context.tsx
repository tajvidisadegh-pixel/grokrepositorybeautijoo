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
  getRefreshToken,
  setTokens,
} from '@/lib/auth-storage';
import type { AccountType, AuthMeResponse } from '@/types/auth';

type AuthContextValue = {
  user: AuthMeResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
  loginWithPassword: (
    phone: string,
    password: string,
    accountType: AccountType,
  ) => Promise<void>;
  register: (
    phone: string,
    password: string,
    displayName?: string,
    role?: AccountType,
  ) => Promise<AuthMeResponse>;
  requestOtp: (
    phone: string,
    purpose?: string,
    accountType?: AccountType,
  ) => Promise<{ expiresIn: number }>;
  verifyOtp: (
    phone: string,
    code: string,
    purpose?: string,
    accountType?: AccountType,
  ) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me(token);
      setUser(me);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearTokens();
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const tokens = await authApi.refresh(refresh);
        setTokens(tokens.accessToken, tokens.refreshToken);
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

  const loginWithPassword = useCallback(
    async (phone: string, password: string, accountType: AccountType) => {
      const res = await authApi.login({ phone, password, accountType });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
    },
    [],
  );

  const register = useCallback(
    async (
      phone: string,
      password: string,
      displayName?: string,
      role?: AccountType,
    ) => {
      const res = await authApi.register({ phone, password, displayName, role });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
      return me;
    },
    [],
  );

  const requestOtp = useCallback(
    async (phone: string, purpose = 'login', accountType: AccountType = 'customer') => {
      const res = await authApi.requestOtp({ phone, purpose, accountType });
      return { expiresIn: res.expiresIn };
    },
    [],
  );

  const verifyOtp = useCallback(
    async (
      phone: string,
      code: string,
      purpose = 'login',
      accountType: AccountType = 'customer',
    ) => {
      const res = await authApi.verifyOtp({ phone, code, purpose, accountType });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        /* ignore network errors on logout */
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!user?.roles?.length) return false;
      const need = Array.isArray(role) ? role : [role];
      if (need.some((r) => user.roles.includes(r))) return true;
      // SUPER_ADMIN and legacy `admin` are equivalent privileged roles
      const privileged = new Set(['SUPER_ADMIN', 'admin']);
      if (need.some((r) => privileged.has(r)) && user.roles.some((r) => privileged.has(r))) {
        return true;
      }
      return false;
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
