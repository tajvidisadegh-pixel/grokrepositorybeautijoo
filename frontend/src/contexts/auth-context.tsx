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
import { tryRefresh } from '@/lib/api';
import {
  clearTokens,
  getAccessToken,
  setTokens,
} from '@/lib/auth-storage';
import {
  saveAdminAccessBackup,
  takeAdminAccessBackup,
  setImpersonationMeta,
  clearImpersonationMeta,
  getImpersonationMeta,
} from '@/lib/impersonation-storage';
import { impersonateCustomer, endImpersonationAudit } from '@/lib/panel-api';
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
    code: string,
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
  startImpersonation: (customerId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  isImpersonating: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      let token = getAccessToken();

      if (!token && typeof window !== 'undefined') {
        token = await tryRefresh();
      }

      if (!token) {
        setUser(null);
        return;
      }

      try {
        const me = await authApi.me(token);
        setUser(me);
      } catch {
        const fresh = await tryRefresh();
        if (!fresh) {
          clearTokens();
          setUser(null);
          return;
        }
        try {
          const me = await authApi.me(fresh);
          setUser(me);
        } catch {
          clearTokens();
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
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
      code: string,
      displayName?: string,
      role?: AccountType,
    ) => {
      const res = await authApi.register({
        phone,
        password,
        code,
        displayName,
        role,
      });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
      return me;
    },
    [],
  );

  const requestOtp = useCallback(
    async (
      phone: string,
      purpose = 'login',
      accountType: AccountType = 'customer',
    ) => {
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
    if (getImpersonationMeta()) {
      try {
        await endImpersonationAudit().catch(() => undefined);
      } catch {
        /* ignore */
      }
      const adminToken = takeAdminAccessBackup();
      clearImpersonationMeta();
      if (adminToken) {
        setTokens(adminToken);
        try {
          const me = await authApi.me(adminToken);
          setUser(me);
          return;
        } catch {
          /* fall through */
        }
      }
    }
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clearTokens();
    clearImpersonationMeta();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!user?.roles?.length) return false;
      const need = Array.isArray(role) ? role : [role];
      if (need.some((r) => user.roles.includes(r))) return true;
      const privileged = new Set(['SUPER_ADMIN', 'admin']);
      if (
        need.some((r) => privileged.has(r)) &&
        user.roles.some((r) => privileged.has(r))
      ) {
        return true;
      }
      return false;
    },
    [user],
  );

  const startImpersonation = useCallback(async (customerId: string) => {
    const current = getAccessToken();
    if (current) saveAdminAccessBackup(current);
    const res = await impersonateCustomer(customerId);
    setTokens(res.accessToken);
    setImpersonationMeta({ customerId });
    const me = await authApi.me(res.accessToken);
    setUser(me);
  }, []);

  const stopImpersonation = useCallback(async () => {
    try {
      await endImpersonationAudit().catch(() => undefined);
    } catch {
      /* ignore */
    }
    const adminToken = takeAdminAccessBackup();
    clearImpersonationMeta();
    if (adminToken) {
      setTokens(adminToken);
      const me = await authApi.me(adminToken);
      setUser(me);
    } else {
      clearTokens();
      setUser(null);
    }
  }, []);

  const value = useMemo(
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
      startImpersonation,
      stopImpersonation,
      isImpersonating: !!getImpersonationMeta(),
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
      startImpersonation,
      stopImpersonation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
