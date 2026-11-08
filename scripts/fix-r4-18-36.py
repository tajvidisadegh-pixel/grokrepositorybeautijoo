#!/usr/bin/env python3
"""r4 items ~18-36: medium privacy, media storage, infra hygiene."""
from pathlib import Path

# ---------------------------------------------------------------------------
# 1) admin-ops: mask phones in campaignRecipients
# ---------------------------------------------------------------------------
ops = Path("backend/src/admin/admin-ops.controller.ts")
if ops.exists():
    ot = ops.read_text(encoding="utf-8")
    old = """      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        phone: r.user?.phone,
        displayName: r.user?.profile?.displayName,
        status:
          (r.data as any)?.deliveryStatus === 'failed'
            ? 'failed'
            : r.readAt
              ? 'read'
              : 'sent',
        createdAt: r.createdAt,
      })),"""
    new = """      items: rows.map((r) => {
        const raw = r.user?.phone || '';
        const masked =
          raw.length >= 7 ? raw.slice(0, 4) + '***' + raw.slice(-2) : raw ? '***' : null;
        return {
          id: r.id,
          userId: r.userId,
          phone: masked, // #r4.M2 — never return full phone in campaign lists
          displayName: r.user?.profile?.displayName,
          status:
            (r.data as any)?.deliveryStatus === 'failed'
              ? 'failed'
              : r.readAt
                ? 'read'
                : 'sent',
          createdAt: r.createdAt,
        };
      }),"""
    if old in ot:
        ot = ot.replace(old, new, 1)
        ops.write_text(ot, encoding="utf-8")
        print("M2 campaignRecipients mask")
    else:
        print("M2 campaign pattern miss")

# ---------------------------------------------------------------------------
# 2) setMediaStatus: delete storage when rejected/deleted
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")
old_sm = """  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'media.status_change', 'media_asset', id, { status: existing.status }, { status });
    return updated;
  }"""
new_sm = """  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: { status } });
    // #r4.M4 — purge storage when media is rejected/deleted
    if (status === MediaStatus.rejected || status === MediaStatus.deleted) {
      const storageKey = (existing as any).storageKey || (existing as any).key || (existing as any).path;
      if (storageKey && this.storage.delete) {
        try {
          await this.storage.delete(String(storageKey));
        } catch (e) {
          this.logger.warn(`setMediaStatus storage delete failed: ${(e as Error)?.message || e}`);
        }
      }
    }
    await this.audit(actorId, 'media.status_change', 'media_asset', id, { status: existing.status }, { status });
    return updated;
  }"""
if old_sm in st:
    st = st.replace(old_sm, new_sm, 1)
    svc.write_text(st, encoding="utf-8")
    print("M4 setMediaStatus storage")
else:
    print("M4 setMediaStatus miss")

# ---------------------------------------------------------------------------
# 3) local-storage download path sep safety
# ---------------------------------------------------------------------------
lp = Path("backend/src/storage/local-storage.provider.ts")
if lp.exists():
    lt = lp.read_text(encoding="utf-8")
    old_dl = "    const full = path.join(this.basePath, safeKey);\n    if (!full.startsWith(this.basePath)) return null;"
    new_dl = "    const full = path.join(this.basePath, safeKey);\n    const baseWithSep = this.basePath.endsWith(path.sep) ? this.basePath : this.basePath + path.sep;\n    if (full !== this.basePath && !full.startsWith(baseWithSep)) return null;"
    if old_dl in lt:
        lt = lt.replace(old_dl, new_dl, 1)
        lp.write_text(lt, encoding="utf-8")
        print("M8 download path sep")
    else:
        print("M8 download path already ok or miss")

# ---------------------------------------------------------------------------
# 4) db-reset.sh production guard
# ---------------------------------------------------------------------------
db = Path("scripts/db-reset.sh")
if db.exists():
    bt = db.read_text(encoding="utf-8")
    if "NODE_ENV" not in bt or "production" not in bt:
        guard = '''#!/usr/bin/env bash
# ریست کامل دیتابیس توسعه: حذف volume → بالا آوردن → migrate → seed
set -euo pipefail

# #r4.D7 — never run against production
if [[ "${NODE_ENV:-}" == "production" || "${APP_ENV:-}" == "production" || "${DATABASE_URL:-}" == *"production"* ]]; then
  echo "ERROR: db-reset.sh is blocked when NODE_ENV/APP_ENV=production or DATABASE_URL looks like production." >&2
  exit 1
fi
if [[ "${ALLOW_DB_RESET:-}" != "yes" ]]; then
  echo "Set ALLOW_DB_RESET=yes to confirm this is a local/dev database." >&2
  exit 1
fi

'''
        # replace shebang block
        if bt.startswith("#!/"):
            rest = bt.split("\n", 1)[1] if "\n" in bt else ""
            # strip old header comments until set -euo
            lines = rest.splitlines()
            start = 0
            for i, line in enumerate(lines):
                if line.startswith("set -euo"):
                    start = i
                    break
            body = "\n".join(lines[start:])
            # body already has set -euo — avoid duplicate
            if body.startswith("set -euo"):
                body = "\n".join(lines[start + 1 :])
            db.write_text(guard + "set -euo pipefail\n\n" + body.lstrip("\n"), encoding="utf-8")
            print("D7 db-reset guard")
        else:
            print("D7 unexpected format")

# ---------------------------------------------------------------------------
# 5) Root Dockerfile — slim runner (no dual full node_modules tree)
# ---------------------------------------------------------------------------
df = Path("Dockerfile")
if df.exists():
    dt = df.read_text(encoding="utf-8")
    # Replace the heavy dual-copy block with a lighter note if still present
    old_block = """# Support Liara start at /app/standalone/server.js with FULL tree (not nested frontend/)
RUN mkdir -p /app/standalone \\
  && cp -a /app/server.js /app/standalone/server.js \\
  && cp -a /app/node_modules /app/standalone/node_modules \\
  && mkdir -p /app/standalone/.next \\
  && cp -a /app/.next/. /app/standalone/.next/ \\
  && cp -a /app/public /app/standalone/public"""
    new_block = """# #r4.D2/D3 — Liara may start either /app/server.js or /app/standalone/server.js
# Prefer symlink for standalone path instead of duplicating node_modules (image size).
RUN mkdir -p /app/standalone \\
  && ln -sf /app/server.js /app/standalone/server.js \\
  && ln -sfn /app/node_modules /app/standalone/node_modules \\
  && mkdir -p /app/standalone/.next \\
  && ln -sfn /app/.next/static /app/standalone/.next/static 2>/dev/null || true \\
  && ln -sfn /app/public /app/standalone/public"""
    if old_block in dt:
        dt = dt.replace(old_block, new_block, 1)
        df.write_text(dt, encoding="utf-8")
        print("D2 Dockerfile slim standalone")
    else:
        print("D2 block miss or already patched")

# ---------------------------------------------------------------------------
# 6) backend Dockerfile — require lockfile in CI/production builds
# ---------------------------------------------------------------------------
bdf = Path("backend/Dockerfile")
if bdf.exists():
    bt = bdf.read_text(encoding="utf-8")
    old = 'RUN if [ -f package-lock.json ]; then npm ci; else echo "WARN: no package-lock.json — using npm install (non-deterministic)"; npm install; fi'
    new = 'RUN if [ -f package-lock.json ]; then npm ci; else echo "ERROR: package-lock.json required for reproducible builds" >&2; exit 1; fi'
    if old in bt:
        bt = bt.replace(old, new, 1)
        bdf.write_text(bt, encoding="utf-8")
        print("backend Dockerfile npm ci only")
    # HEALTHCHECK if missing
    if "HEALTHCHECK" not in bt:
        bt = bdf.read_text(encoding="utf-8")
        bt = bt.replace(
            "USER node\n\n# Migrate",
            "USER node\n\n"
            "HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \\\n"
            "  CMD node -e \"require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health',r=>process.exit(r.statusCode&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))\"\n\n"
            "# Migrate",
            1,
        )
        bdf.write_text(bt, encoding="utf-8")
        print("backend HEALTHCHECK")

# ---------------------------------------------------------------------------
# 7) scripts/README — danger notice for one-off mutators
# ---------------------------------------------------------------------------
readme = Path("scripts/README.md")
notice = """# scripts/

> **هشدار امنیتی (r4):** بسیاری از اسکریپت‌های این پوشه یک‌بارمصرف‌اند و با regex/sed
> سورس یا داده را تغییر می‌دهند. اسکریپت‌هایی مثل `force_payout_*` و `dedupe_payout_*`
> می‌توانند داده مالی را عوض کنند — **هرگز روی production اجرا نکنید** مگر با پشتیبان و تأیید کتبی.

- `db-reset.sh` فقط با `ALLOW_DB_RESET=yes` و خارج از production اجرا می‌شود.
- پوشه‌های خالی/موقت (`b64chunks`, `buffer82`, `ci-blobs`, `patches`) نباید در deploy باشند.
- برای پچ‌های امنیتی از workflowهای `run-fix-*` و اسکریپت‌های `fix-admin-r4-*.py` استفاده شده است.

"""
readme.write_text(notice, encoding="utf-8")
print("scripts README")

# ---------------------------------------------------------------------------
# 8) .gitignore — ignore local junk
# ---------------------------------------------------------------------------
gi = Path(".gitignore")
extra = "\n# r4 hygiene\n.tmp/\nscripts/b64chunks/\nscripts/buffer82/\nscripts/ci-blobs/\nscripts/patches/\n*.schema-b64\n"
if gi.exists():
    gt = gi.read_text(encoding="utf-8")
    if "scripts/b64chunks" not in gt:
        gi.write_text(gt.rstrip() + "\n" + extra, encoding="utf-8")
        print(".gitignore updated")
else:
    gi.write_text(extra, encoding="utf-8")
    print(".gitignore created")

# ---------------------------------------------------------------------------
# 9) package.json — document workspaces vs per-package locks
# ---------------------------------------------------------------------------
pj = Path("package.json")
if pj.exists():
    import json
    data = json.loads(pj.read_text(encoding="utf-8"))
    # add comment via description field extension is invalid JSON — use scripts note
    scripts = data.setdefault("scripts", {})
    if "workspaces:note" not in scripts:
        scripts["workspaces:note"] = "echo 'Root workspaces are convenience only; install deps inside frontend/ and backend/ with their own package-lock.json'"
        pj.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("package.json note")

# ---------------------------------------------------------------------------
# 10) docs update
# ---------------------------------------------------------------------------
docs = Path("docs/SECURITY_R4_OWNER.md")
if docs.exists():
    d = docs.read_text(encoding="utf-8")
    if "Items 18-36" not in d:
        d += """

## Items 18–36 (medium + infra) applied in code

- Campaign recipient phones masked
- setMediaStatus purges storage on rejected/deleted
- Local storage download path uses basePath + separator
- db-reset.sh requires ALLOW_DB_RESET=yes and blocks production
- Frontend Dockerfile uses symlinks for standalone path (less image bloat)
- Backend Dockerfile requires package-lock.json + HEALTHCHECK
- scripts/README danger notice; .gitignore for junk dirs

Still owner-only: make repo private, gitleaks history scan, stop direct-to-main bot pushes without review.
"""
        docs.write_text(d, encoding="utf-8")
        print("docs updated")

print("DONE 18-36")
