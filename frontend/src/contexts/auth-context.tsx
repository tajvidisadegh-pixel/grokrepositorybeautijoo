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

  /**
   * Bootstrap session:
   * 1) Use in-memory access token if present
   * 2) Otherwise silent refresh via httpOnly cookie (survives F5)
   * 3) Load /auth/me
   */
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
      try { await endImpersonationAudit().catch(() => undefined); } catch { /* ignore */ }
      const adminToken = takeAdminAccessBackup();
      clearImpersonationMeta();
      if (adminToken) {
        setTokens(adminToken);
        try { const me = await authApi.me(adminToken); setUser(me); return; } catch { /* fall through */ }
      }
    }
    try { await authApi.logout(); } catch { /* ignore network errors on logout */ }
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
    if (!current) throw new Error('نشست مدیر یافت نشد');
    const res = await impersonateCustomer(customerId);
    saveAdminAccessBackup(current);
    setImpersonationMeta({
      customerId: res.customer.id,
      customerName: res.customer.displayName,
      customerPhone: res.customer.phone,
      startedAt: new Date().toISOString(),
    });
    setTokens(res.accessToken);
    const me = await authApi.me(res.accessToken);
    setUser(me);
  }, []);

  const stopImpersonation = useCallback(async () => {
    try { await endImpersonationAudit().catch(() => undefined); } catch { /* ignore */ }
    const adminToken = takeAdminAccessBackup();
    clearImpersonationMeta();
    if (adminToken) {
      setTokens(adminToken);
      try { const me = await authApi.me(adminToken); setUser(me); return; } catch { /* fall through */ }
    }
    clearTokens();
    await reload();
  }, [reload]);

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
