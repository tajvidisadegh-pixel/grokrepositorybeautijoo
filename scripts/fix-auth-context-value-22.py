#!/usr/bin/env python3
from pathlib import Path
p = Path('frontend/src/contexts/auth-context.tsx')
t = p.read_text()
old = '''  const value = useMemo<AuthContextValue>(
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
    }),'''
new = '''  const value = useMemo<AuthContextValue>(
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
      isImpersonating: !!user?.isImpersonating || !!getImpersonationMeta(),
    }),'''
if old not in t:
    if 'startImpersonation,' in t and 'const value = useMemo' in t:
        # already has in value
        print('maybe already fixed')
        if 'startImpersonation,\n      stopImpersonation' in t or 'startImpersonation,\n      stop' in t:
            print('value already has methods')
            raise SystemExit(0)
    raise SystemExit('value pattern not found')
t = t.replace(old, new, 1)
# also fix dependency array if needed
old_deps = '''    [
      user,
      loading,
      hasRole,
      loginWithPassword,
      register,
      requestOtp,
      verifyOtp,
      logout,
      reload,
    ],'''
new_deps = '''    [
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
    ],'''
if old_deps in t:
    t = t.replace(old_deps, new_deps, 1)
p.write_text(t)
assert 'startImpersonation,' in t.split('const value')[1][:500]
print('value fixed ok')
