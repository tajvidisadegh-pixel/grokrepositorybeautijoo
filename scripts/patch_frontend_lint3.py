#!/usr/bin/env python3
from pathlib import Path
import re

# 1) professionals - replace any casts + remove unused onFeatured
p = Path('frontend/src/app/admin/professionals/page.tsx')
t = p.read_text()
t = t.replace(
    "const userId = (p as any).userId || (p as any).user?.id;",
    "const userId = (p as { userId?: string; user?: { id?: string } }).userId || p.user?.id;",
)
# Remove entire onFeatured function if unused
if 'onFeatured(' not in t.split('async function onFeatured')[0] and t.count('onFeatured') <= 2:
    t = re.sub(
        r"\n  async function onFeatured\(id: string, isFeatured: boolean\) \{[\s\S]*?\n  \}\n",
        "\n",
        t,
        count=1,
    )
# If adminSetProfessionalFeatured only used by onFeatured, remove import
if 'adminSetProfessionalFeatured' in t and 'adminSetProfessionalFeatured(' not in t.replace('adminSetProfessionalFeatured,', ''):
    t = t.replace('  adminSetProfessionalFeatured,\n', '')
p.write_text(t)
print('professionals fixed')

# 2) media - unused d
m = Path('frontend/src/app/admin/media/page.tsx')
mt = m.read_text()
mt = mt.replace(
    "        const d = await apiClient.get<MediaItem>(`/admin/media`).catch(() => null);\n        setDetail((prev) => (prev ? { ...prev, status: next } : prev));",
    "        setDetail((prev) => (prev ? { ...prev, status: next } : prev));",
)
m.write_text(mt)
print('media fixed')

# 3) users - unused imports
u = Path('frontend/src/app/admin/users/page.tsx')
ut = u.read_text()
ut = ut.replace('  adminNotifyByFilter,\n', '')
ut = ut.replace('  adminSoftDeleteUser,\n', '')
u.write_text(ut)
print('users fixed')

# 4) site-builder - remove unused resolveCmsUrl if never called
sb = Path('frontend/src/app/admin/site-builder/page.tsx')
if sb.exists():
    st = sb.read_text()
    if 'function resolveCmsUrl' in st and 'resolveCmsUrl(' not in st.replace('function resolveCmsUrl', ''):
        st = re.sub(
            r"\nfunction resolveCmsUrl\([\s\S]*?\n\}\n",
            "\n",
            st,
            count=1,
        )
        sb.write_text(st)
        print('site-builder resolveCmsUrl removed')
    else:
        # if defined but only used in definition
        calls = len(re.findall(r'resolveCmsUrl\(', st))
        print('site-builder resolveCmsUrl calls', calls)
        if calls <= 1:  # only definition
            st = re.sub(r"\nfunction resolveCmsUrl\([\s\S]*?\n\}\n", "\n", st, count=1)
            sb.write_text(st)
            print('site-builder resolveCmsUrl stripped')

# 5) auth-storage - drop unused param
auth = Path('frontend/src/lib/auth-storage.ts')
at = auth.read_text()
at = at.replace(
    'export function setTokens(accessToken: string, _rt?: string): void {',
    'export function setTokens(accessToken: string, _unused?: string): void {',
)
# still unused - omit second param entirely; callers may still pass 2 args which is fine in JS
at = at.replace(
    'export function setTokens(accessToken: string, _unused?: string): void {',
    'export function setTokens(accessToken: string): void {',
)
auth.write_text(at)
print('auth fixed')

print('DONE')
