#!/usr/bin/env python3
from pathlib import Path
import re

def patch_panel_api():
    p = Path('frontend/src/lib/panel-api.ts')
    t = p.read_text()
    if 'impersonateCustomer' in t:
        print('panel-api ok')
        return
    snippet = '''
export async function impersonateCustomer(customerId: string): Promise<{
  accessToken: string;
  expiresIn: string;
  customer: {
    id: string;
    phone: string | null;
    displayName: string | null;
    accountType?: string;
    roles: string[];
  };
}> {
  return apiClient.post(`/admin/users/${customerId}/impersonate`, {});
}

export async function endImpersonationAudit(): Promise<{ ok: boolean }> {
  return apiClient.post('/auth/impersonate/end', {});
}

'''
    idx = t.find('export async function fetchAdminUsers')
    if idx < 0:
        t = t + snippet
    else:
        rest = t[idx:]
        n = rest.find('\nexport async function', 5)
        t = t[:idx+n] + '\n' + snippet + t[idx+n:] if n > 0 else t + snippet
    p.write_text(t)
    print('panel-api ok')

def patch_users():
    p = Path('frontend/src/app/admin/users/page.tsx')
    t = p.read_text()
    if 'ورود به حساب مشتری' in t:
        print('users ok')
        return
    if "from '@/contexts/auth-context'" not in t:
        t = t.replace("'use client';\n", "'use client';\n\nimport { useAuth } from '@/contexts/auth-context';\n", 1)
    m = re.search(r'export default function \w+\(\) \{', t)
    if m and 'startImpersonation' not in t:
        t = t[:m.end()] + '\n  const { startImpersonation, hasRole } = useAuth();\n' + t[m.end():]
    needle = "onClick={() => removeOne(detail.id)}>حذف کامل</button>"
    if needle in t:
        t = t.replace(needle, needle + '''
                    {hasRole('SUPER_ADMIN') && (
                      <button type="button" className="rounded-lg border border-coral px-3 py-1.5 text-xs text-coral" disabled={busy}
                        onClick={async () => {
                          if (!confirm('آیا می‌خواهید به عنوان این مشتری وارد شوید؟')) return;
                          setBusy(true);
                          try {
                            await startImpersonation(detail.id);
                            window.location.href = '/panel';
                          } catch (e: unknown) {
                            setActionMsg(e instanceof Error ? e.message : 'خطا در ورود به حساب مشتری');
                          } finally { setBusy(false); }
                        }}>ورود به حساب مشتری</button>
                    )}''', 1)
    p.write_text(t)
    print('users ok')

def patch_layout():
    p = Path('frontend/src/app/layout.tsx')
    t = p.read_text()
    if 'ImpersonationBanner' in t:
        print('layout ok')
        return
    t = t.replace(
        "import { AuthProvider } from '@/contexts/auth-context';",
        "import { AuthProvider } from '@/contexts/auth-context';\nimport { ImpersonationBanner } from '@/components/auth/impersonation-banner';",
        1,
    )
    t = t.replace('<AuthProvider>', '<AuthProvider>\n          <ImpersonationBanner />', 1)
    p.write_text(t)
    print('layout ok')

if __name__ == '__main__':
    patch_panel_api()
    patch_users()
    patch_layout()
