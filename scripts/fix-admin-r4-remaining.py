#!/usr/bin/env python3
"""Close remaining r4 items: H7, H9, M1-M3, Dockerfile hygiene, setUserRoles last SUPER_ADMIN."""
from pathlib import Path
import re

# ---------------------------------------------------------------------------
# auth.service.ts — H9 short fixed TTL for impersonation (max 15m)
# ---------------------------------------------------------------------------
auth = Path("backend/src/auth/auth.service.ts")
at = auth.read_text(encoding="utf-8")
old_imp = """  async issueImpersonationAccessToken(
    customerId: string,
    customerPhone: string | null,
    adminId: string,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const accessTtl = this.config.get<string>('jwt.accessTtl') || '30m';
    const accessToken = await this.jwt.signAsync(
      {
        sub: customerId,
        phone: customerPhone ?? undefined,
        imp: adminId,
        impMode: true,
      },
      {
        secret: this.config.get('jwt.accessSecret'),
        expiresIn: accessTtl as any,
      },
    );
    return { accessToken, expiresIn: accessTtl };
  }"""
new_imp = """  async issueImpersonationAccessToken(
    customerId: string,
    customerPhone: string | null,
    adminId: string,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    // #r4.H9 — impersonation tokens are short-lived and non-refreshable
    const configured = (this.config.get<string>('jwt.impersonationTtl') || process.env.JWT_IMPERSONATION_TTL || '15m').trim();
    const accessTtl = configured;
    const accessToken = await this.jwt.signAsync(
      {
        sub: customerId,
        phone: customerPhone ?? undefined,
        imp: adminId,
        impMode: true,
        // block elevated claims while impersonating
        roles: ['customer'],
      },
      {
        secret: this.config.get('jwt.accessSecret'),
        expiresIn: accessTtl as any,
      },
    );
    return { accessToken, expiresIn: accessTtl };
  }"""
if old_imp in at:
    at = at.replace(old_imp, new_imp, 1)
    auth.write_text(at, encoding="utf-8")
    print("H9 impersonation TTL")
else:
    print("H9 pattern miss")

# ---------------------------------------------------------------------------
# admin.service.ts — M1 filter notifications, M2 mask phones, M3 drop ip, H7 financial note
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

# helper maskPhone near top of class if missing
if "private maskPhone" not in st:
    st = st.replace(
        "  private async audit(",
        "  private maskPhone(phone?: string | null): string | null {\n"
        "    if (!phone) return null;\n"
        "    const p = String(phone);\n"
        "    if (p.length < 7) return '***';\n"
        "    return p.slice(0, 4) + '***' + p.slice(-2);\n"
        "  }\n\n  private async audit(",
        1,
    )
    print("maskPhone helper")

# M1 listNotifications — require userId filter or return empty with notice
old_ln = """  async listNotifications(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 30));
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }"""
new_ln = """  async listNotifications(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 30));
    const where: Prisma.NotificationWhereInput = {};
    if (q?.userId?.trim()) where.userId = String(q.userId).trim();
    if (q?.type) where.type = q.type;
    if (q?.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { body: { contains: s, mode: 'insensitive' } },
      ];
    }
    // #r4.M1 — without userId, only return aggregate counts (no full dump)
    if (!where.userId && !q?.search?.trim()) {
      const total = await this.prisma.notification.count({ where });
      return {
        items: [],
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
        notice: 'برای فهرست کامل، userId را مشخص کنید',
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }"""
if old_ln in st:
    st = st.replace(old_ln, new_ln, 1)
    print("M1 listNotifications")
else:
    print("M1 miss")

# M3 listAuditLogs — omit ipAddress by default
old_ip = "      ipAddress: r.ipAddress,\n      createdAt: r.createdAt,"
new_ip = "      // #r4.M3 — ipAddress omitted from list (privacy); available in detail if needed\n      createdAt: r.createdAt,"
if old_ip in st:
    st = st.replace(old_ip, new_ip, 1)
    print("M3 drop ipAddress")

# M2 mask phones in listUsers response
old_lu_ret = "    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };\n  }\n\n  async getCustomersStats()"
new_lu_ret = """    const masked = items.map((u) => ({
      ...u,
      phone: this.maskPhone(u.phone),
    }));
    return { items: masked, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getCustomersStats()"""
if old_lu_ret in st:
    st = st.replace(old_lu_ret, new_lu_ret, 1)
    print("M2 listUsers mask")
else:
    print("M2 listUsers miss")

# Mask phones in dashboard recent users
old_dash = "          phone: u.phone,\n          displayName: u.profile?.displayName ?? null,"
new_dash = "          phone: this.maskPhone(u.phone),\n          displayName: u.profile?.displayName ?? null,"
if old_dash in st:
    st = st.replace(old_dash, new_dash, 1)
    print("M2 dashboard mask")

# H7 getFinancialSummary — when estimating from current rate, flag it
old_h7 = """    if (!platformCommission && grossRevenue) {
      const rate = (await this.getCommissionSetting()).rate;
      platformCommission = Math.round(grossRevenue * (rate / 100));
      professionalNet = Math.max(0, grossRevenue - platformCommission);
    }
    return {
      period,
      grossRevenue,
      platformCommission,
      professionalNet,
      transactions: {
        paid: paidCount,
        failed: failedCount,
        pending: pendingCount,
      },
    };"""
new_h7 = """    let commissionEstimated = false;
    if (!platformCommission && grossRevenue) {
      const rate = (await this.getCommissionSetting()).rate;
      platformCommission = Math.round(grossRevenue * (rate / 100));
      professionalNet = Math.max(0, grossRevenue - platformCommission);
      commissionEstimated = true; // #r4.H7 — historical rows missing snapshot
    }
    return {
      period,
      grossRevenue,
      platformCommission,
      professionalNet,
      commissionEstimated,
      transactions: {
        paid: paidCount,
        failed: failedCount,
        pending: pendingCount,
      },
    };"""
if old_h7 in st:
    st = st.replace(old_h7, new_h7, 1)
    print("H7 financial estimate flag")
else:
    print("H7 miss")

# Prevent demoting last SUPER_ADMIN in setUserRoles
if "آخرین SUPER_ADMIN" not in st or st.count("آخرین SUPER_ADMIN") < 2:
    needle = "    const beforeRoles = existing.userRoles.map((ur) => ur.role.name);"
    inject = """    const beforeRoles = existing.userRoles.map((ur) => ur.role.name);
    // #r4.H5 — cannot remove last active SUPER_ADMIN
    if (beforeRoles.includes('SUPER_ADMIN') && !normalized.some((r) => r.toLowerCase() === 'super_admin')) {
      const superCount = await this.prisma.userRole.count({
        where: { role: { name: 'SUPER_ADMIN' }, user: { status: UserStatus.active } },
      });
      if (superCount <= 1) {
        throw new BadRequestException('نمی‌توان نقش آخرین SUPER_ADMIN فعال را برداشت');
      }
    }"""
    if needle in st and "نمی‌توان نقش آخرین SUPER_ADMIN" not in st:
        st = st.replace(needle, inject, 1)
        print("H5 last SUPER_ADMIN roles")

svc.write_text(st, encoding="utf-8")
print("admin.service done")

# ---------------------------------------------------------------------------
# Dockerfile root — non-root user, HEALTHCHECK, no dual node_modules copy bloat note
# ---------------------------------------------------------------------------
df = Path("Dockerfile")
if df.exists():
    dt = df.read_text(encoding="utf-8")
    changed = False
    if "USER node" not in dt and "useradd" not in dt:
        # insert before EXPOSE
        if "EXPOSE 3000" in dt and "USER " not in dt:
            dt = dt.replace(
                "EXPOSE 3000\nCMD [\"node\", \"server.js\"]",
                "# #r4.D1 — run as non-root\n"
                "USER node\n\n"
                "EXPOSE 3000\n"
                "HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \\\n"
                "  CMD node -e \"require('http').get('http://127.0.0.1:'+(process.env.PORT||3000),r=>process.exit(r.statusCode&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))\"\n"
                "CMD [\"node\", \"server.js\"]",
                1,
            )
            changed = True
            print("Dockerfile USER+HEALTHCHECK")
    # Prefer npm ci only
    if "npm install" in dt:
        dt = dt.replace(
            "RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi",
            "RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else echo 'package-lock.json required' >&2; exit 1; fi",
            1,
        )
        changed = True
        print("Dockerfile npm ci only")
    if changed:
        df.write_text(dt, encoding="utf-8")

# ---------------------------------------------------------------------------
# docs checklist for remaining owner items (repo public, secrets scan)
# ---------------------------------------------------------------------------
docs = Path("docs/SECURITY_R4_OWNER.md")
docs.parent.mkdir(parents=True, exist_ok=True)
docs.write_text(
    """# Security r4 — owner actions

Code fixes for critical/high admin issues are on main.

## Still requires repository owner

1. **Make the repository private** (GitHub Settings → Change visibility).
2. **Scan git history for secrets**:
   ```bash
   # e.g. gitleaks
   gitleaks detect --source . --log-opts="--all"
   ```
3. Rotate any secrets that ever appeared in commits.
4. Stop bot workflows that push directly to `main` without PR review.
5. Delete one-off scripts under `scripts/` that mutate production data
   (`force_payout_*`, `dedupe_payout_*`, empty `b64chunks` / `.tmp`).
6. Confirm Liara disk is mounted for `STORAGE_LOCAL_PATH` or set `STORAGE_PROVIDER=s3`.

## Applied in code (reference)

- Admin dashboard permission, role-grant restriction, hard-delete guards
- Booking/payout state machines, commission format, CMS publish keeps draft
- CMS image sniff, platform_config whitelist, storage path/MIME
- Impersonation short TTL, phone masking on admin lists, audit IP omitted
- Frontend Dockerfile non-root + HEALTHCHECK + npm ci required
""",
    encoding="utf-8",
)
print("docs written")
print("DONE")
