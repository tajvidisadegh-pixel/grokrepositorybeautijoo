#!/usr/bin/env python3
"""Issue #37 users page role UI via anchors."""
from pathlib import Path

ROLE_CARD = r'''
                {(hasRole(['SUPER_ADMIN', 'admin'])) && (
                  <Card className="space-y-3 p-4">
                    <h3 className="font-semibold text-sm">نقش‌های ادمین (ایشو ۳۷)</h3>
                    <p className="text-xs text-gray">نقش‌های کانالی فقط دسترسی همان بخش.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        { name: 'admin', label: 'مدیر کامل' },
                        { name: 'admin_customers', label: 'ادمین مشتریان' },
                        { name: 'admin_professionals', label: 'ادمین زیباگرها' },
                        { name: 'admin_bookings', label: 'ادمین رزروها' },
                        { name: 'admin_finance', label: 'ادمین مالی' },
                        { name: 'admin_content', label: 'ادمین محتوا' },
                        { name: 'admin_support', label: 'ادمین پشتیبانی' },
                      ] as const).map((opt) => (
                        <label key={opt.name} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={editRoles.includes(opt.name)}
                            onChange={(e) => {
                              setEditRoles((prev) =>
                                e.target.checked
                                  ? [...prev.filter((x) => x !== opt.name), opt.name]
                                  : prev.filter((x) => x !== opt.name),
                              );
                            }}
                          />
                          {opt.label}
                          <span className="text-xs text-gray-muted" dir="ltr">({opt.name})</span>
                        </label>
                      ))}
                    </div>
                    {hasRole('SUPER_ADMIN') && (
                      <label className="flex items-center gap-2 text-sm text-coral">
                        <input type="checkbox" checked={editRoles.includes('SUPER_ADMIN')}
                          onChange={(e) => {
                            setEditRoles((prev) =>
                              e.target.checked
                                ? [...prev.filter((x) => x !== 'SUPER_ADMIN'), 'SUPER_ADMIN']
                                : prev.filter((x) => x !== 'SUPER_ADMIN'),
                            );
                          }}
                        />
                        سوپر ادمین
                      </label>
                    )}
                    <div className="flex items-center gap-2">
                      <button type="button" className="rounded-lg bg-blue px-3 py-1.5 text-xs text-white disabled:opacity-50" disabled={busy}
                        onClick={async () => {
                          if (!detail) return;
                          setBusy(true);
                          setRolesMsg(null);
                          try {
                            const ASSIGNABLE = new Set([
                              'admin', 'SUPER_ADMIN',
                              'admin_customers', 'admin_professionals', 'admin_bookings',
                              'admin_finance', 'admin_content', 'admin_support',
                            ]);
                            const base = (editRoles || []).filter((r) => !ASSIGNABLE.has(r));
                            const orig = (detail.roles || []) as string[];
                            for (const r of orig) {
                              if (!ASSIGNABLE.has(r) && !base.includes(r)) base.push(r);
                            }
                            if (!base.includes('customer') && detail.accountType === 'customer' && !base.includes('professional')) {
                              base.push('customer');
                            }
                            const next = Array.from(new Set([...base, ...editRoles.filter((r) => ASSIGNABLE.has(r))]));
                            if (!next.length) next.push('customer');
                            await adminSetUserRoles(detail.id, next);
                            setRolesMsg('نقش‌ها ذخیره شد');
                            await openDetail(detail.id);
                          } catch (e) {
                            setRolesMsg(friendlyApiError(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        ذخیره نقش‌ها
                      </button>
                      {rolesMsg && <span className="text-xs text-coral">{rolesMsg}</span>}
                    </div>
                  </Card>
                )}
'''

def main():
    p = Path("frontend/src/app/admin/users/page.tsx")
    u = p.read_text()
    if "adminSetUserRoles" in u and "admin_customers" in u:
        print("already")
        return
    if "adminSetUserRoles" not in u:
        u = u.replace(
            "  adminUpdateUserProfile,\n",
            "  adminUpdateUserProfile,\n  adminSetUserRoles,\n",
        )
    if "const [editRoles" not in u:
        u = u.replace(
            "  const [editPhone, setEditPhone] = useState('');",
            "  const [editPhone, setEditPhone] = useState('');\n  const [editRoles, setEditRoles] = useState<string[]>([]);\n  const [rolesMsg, setRolesMsg] = useState<string | null>(null);",
        )
    if "setEditRoles(" not in u:
        u = u.replace(
            "      setEditPhone(d.phone || '');",
            "      setEditPhone(d.phone || '');\n      const roleList = (d.roles || (d as { userRoles?: { role?: { name?: string } }[] }).userRoles?.map((ur) => ur.role?.name).filter(Boolean) || []) as string[];\n      setEditRoles(roleList);\n      setRolesMsg(null);",
        )
    if "admin_customers" not in u:
        anchor = "                  </div>\n                </Card>\n              </div>\n            ) : null}"
        if anchor not in u:
            raise SystemExit("anchor missing")
        u = u.replace(anchor, "                  </div>\n                </Card>\n" + ROLE_CARD + "              </div>\n            ) : null}", 1)
    p.write_text(u)
    print("users ok", u.count("admin_customers"))

if __name__ == "__main__":
    main()
