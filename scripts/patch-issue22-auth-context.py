#!/usr/bin/env python3
from pathlib import Path

def main():
    p = Path('frontend/src/contexts/auth-context.tsx')
    t = p.read_text()
    if 'startImpersonation' in t:
        print('already patched')
        return

    if "from '@/lib/impersonation-storage'" not in t:
        t = t.replace(
            "from '@/lib/auth-storage';",
            "from '@/lib/auth-storage';\nimport {\n  saveAdminAccessBackup,\n  takeAdminAccessBackup,\n  setImpersonationMeta,\n  clearImpersonationMeta,\n  getImpersonationMeta,\n} from '@/lib/impersonation-storage';\nimport { impersonateCustomer, endImpersonationAudit } from '@/lib/panel-api';",
            1,
        )

    old_type = '''  logout: () => Promise<void>;\n  reload: () => Promise<void>;\n};'''
    new_type = '''  logout: () => Promise<void>;\n  reload: () => Promise<void>;\n  startImpersonation: (customerId: string) => Promise<void>;\n  stopImpersonation: () => Promise<void>;\n  isImpersonating: boolean;\n};'''
    if old_type in t:
        t = t.replace(old_type, new_type, 1)

    old_logout = '''  const logout = useCallback(async () => {\n    try {\n      await authApi.logout();\n    } catch {\n      /* ignore network errors on logout */\n    }\n    clearTokens();\n    setUser(null);\n  }, []);'''
    new_logout = '''  const logout = useCallback(async () => {\n    if (getImpersonationMeta()) {\n      try { await endImpersonationAudit().catch(() => undefined); } catch { /* ignore */ }\n      const adminToken = takeAdminAccessBackup();\n      clearImpersonationMeta();\n      if (adminToken) {\n        setTokens(adminToken);\n        try { const me = await authApi.me(adminToken); setUser(me); return; } catch { /* fall through */ }\n      }\n    }\n    try { await authApi.logout(); } catch { /* ignore network errors on logout */ }\n    clearTokens();\n    clearImpersonationMeta();\n    setUser(null);\n  }, []);'''
    if old_logout in t:
        t = t.replace(old_logout, new_logout, 1)

    methods = '''\n  const startImpersonation = useCallback(async (customerId: string) => {\n    const current = getAccessToken();\n    if (!current) throw new Error('نشست مدیر یافت نشد');\n    const res = await impersonateCustomer(customerId);\n    saveAdminAccessBackup(current);\n    setImpersonationMeta({\n      customerId: res.customer.id,\n      customerName: res.customer.displayName,\n      customerPhone: res.customer.phone,\n      startedAt: new Date().toISOString(),\n    });\n    setTokens(res.accessToken);\n    const me = await authApi.me(res.accessToken);\n    setUser(me);\n  }, []);\n\n  const stopImpersonation = useCallback(async () => {\n    try { await endImpersonationAudit().catch(() => undefined); } catch { /* ignore */ }\n    const adminToken = takeAdminAccessBackup();\n    clearImpersonationMeta();\n    if (adminToken) {\n      setTokens(adminToken);\n      try { const me = await authApi.me(adminToken); setUser(me); return; } catch { /* fall through */ }\n    }\n    clearTokens();\n    await reload();\n  }, [reload]);\n\n'''
    vm = t.find('  const value = useMemo')
    if vm < 0:
        raise SystemExit('value missing')
    t = t[:vm] + methods + t[vm:]

    if 'startImpersonation,' not in t:
        t = t.replace(
            '    logout,\n    reload,\n  }',
            '    logout,\n    reload,\n    startImpersonation,\n    stopImpersonation,\n    isImpersonating: !!user?.isImpersonating || !!getImpersonationMeta(),\n  }',
            1,
        )
        if 'startImpersonation,' not in t:
            t = t.replace(
                'reload,\n    };',
                'reload,\n    startImpersonation,\n    stopImpersonation,\n    isImpersonating: !!user?.isImpersonating || !!getImpersonationMeta(),\n    };',
                1,
            )

    p.write_text(t)
    assert 'startImpersonation' in t
    print('auth-context patched', len(t))

if __name__ == '__main__':
    main()
