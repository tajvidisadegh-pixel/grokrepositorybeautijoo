#!/usr/bin/env python3
"""Fix r4 regressions: bulk delete, envOverlay, media storage, SMS opt-out, Dockerfile."""
from pathlib import Path
import shutil

# ---------------------------------------------------------------------------
# admin.service.ts
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

# 1) envOverlay defaults match runtime + call from getPlatformSettings
old_env = """  private envOverlay(): Record<string, unknown> {
    return {
      booking: {
        cancelWindowHours: Number(process.env.BOOKING_FREE_CANCEL_HOURS || 2),
        holdMinutes: Number(process.env.BOOKING_HOLD_MINUTES || 15),
        minLeadHours: Number(process.env.BOOKING_MIN_LEAD_HOURS || 2),
      },
      auth: {
        maxOtpAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
        otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
        loginRateLimitPerMinute: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 10),
      },
    };
  }"""
new_env = """  private envOverlay(): Record<string, unknown> {
    // Defaults aligned with bookings/auth runtime env fallbacks
    return {
      booking: {
        cancelWindowHours: Number(process.env.BOOKING_FREE_CANCEL_HOURS || 24),
        holdMinutes: Number(process.env.BOOKING_HOLD_MINUTES || 15),
        minLeadHours: Number(process.env.BOOKING_MIN_LEAD_HOURS || 4),
      },
      auth: {
        maxOtpAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
        otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
        loginRateLimitPerMinute: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 10),
      },
    };
  }"""
if old_env in st:
    st = st.replace(old_env, new_env, 1)
    print("envOverlay defaults")
else:
    print("envOverlay block miss")

# platformDefaults cancel 24
st = st.replace(
    "        cancelWindowHours: 2,",
    "        cancelWindowHours: 24,",
    1,
)
# auth defaults closer to runtime
st = st.replace(
    """      auth: {
        otpTtlSeconds: 120,
        maxOtpAttempts: 5,
        loginRateLimitPerMinute: 10,
      },""",
    """      auth: {
        otpTtlSeconds: 300,
        maxOtpAttempts: 3,
        loginRateLimitPerMinute: 10,
      },""",
    1,
)
print("platformDefaults aligned")

old_gps = """  async getPlatformSettings() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'platform_config' },
    });
    const stored =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    return this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      stored,
    );
  }"""
new_gps = """  async getPlatformSettings() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'platform_config' },
    });
    const stored =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    // defaults <- stored panel <- env overlay (env wins for ops-critical knobs)
    const merged = this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      stored,
    );
    return this.deepMerge(merged, this.envOverlay());
  }"""
if old_gps in st:
    st = st.replace(old_gps, new_gps, 1)
    print("getPlatformSettings calls envOverlay")
else:
    print("getPlatformSettings miss")

# 2) bulkHardDeleteUsers — no fake transaction; stop before any delete if precheck fails
old_bulk = """  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean))).slice(0, 50);
    if ((userIds || []).length > 50) {
      throw new BadRequestException('حداکثر ۵۰ کاربر در هر درخواست');
    }
    // Pre-check all IDs so we fail fast before any delete (best-effort atomicity)
    const blocked: string[] = [];
    for (const id of ids) {
      const [bookings, payments] = await Promise.all([
        this.prisma.booking.count({ where: { customerId: id } }),
        this.prisma.payment.count({ where: { booking: { customerId: id } } }),
      ]);
      if (bookings > 0 || payments > 0) blocked.push(id);
    }
    if (blocked.length) {
      throw new BadRequestException(
        `حذف گروهی متوقف شد؛ این کاربران سابقه رزرو/پرداخت دارند: ${blocked.slice(0, 5).join(', ')}`,
      );
    }
    let deleted = 0;
    const failed: string[] = [];
    await this.prisma.$transaction(async () => {
      for (const id of ids) {
        try {
          await this.hardDeleteUser(id, actorId);
          deleted += 1;
        } catch (e) {
          failed.push(id);
          this.logger.warn(`bulkHardDelete fail ${id}: ${(e as Error)?.message || e}`);
          throw e; // abort remaining deletes in this batch
        }
      }
    }, { timeout: 60_000 });
    return { deleted, failed, cappedAt: 50 };
  }"""

new_bulk = """  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean))).slice(0, 50);
    if ((userIds || []).length > 50) {
      throw new BadRequestException('حداکثر ۵۰ کاربر در هر درخواست');
    }
    // All-or-nothing precheck: if any ID has history, delete none
    const blocked: string[] = [];
    for (const id of ids) {
      const [bookings, payments] = await Promise.all([
        this.prisma.booking.count({ where: { customerId: id } }),
        this.prisma.payment.count({ where: { booking: { customerId: id } } }),
      ]);
      if (bookings > 0 || payments > 0) blocked.push(id);
    }
    if (blocked.length) {
      throw new BadRequestException(
        `حذف گروهی متوقف شد؛ این کاربران سابقه رزرو/پرداخت دارند: ${blocked.slice(0, 5).join(', ')}`,
      );
    }
    // Sequential deletes after precheck (each hardDeleteUser has its own tx).
    // Not a single multi-user DB transaction — precheck prevents partial history loss.
    const deletedIds: string[] = [];
    for (const id of ids) {
      await this.hardDeleteUser(id, actorId);
      deletedIds.push(id);
    }
    return { deleted: deletedIds.length, failed: [] as string[], cappedAt: 50, deletedIds };
  }"""

if old_bulk in st:
    st = st.replace(old_bulk, new_bulk, 1)
    print("bulkHardDelete honest precheck")
else:
    print("bulk pattern miss")

# 3) hardDeleteProfessional — purge storage files first
old_hdp_tx = """    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.mediaAsset.deleteMany({ where: { professionalId: id } }).catch(() => undefined as never);
      await tx.professional.delete({ where: { id } });
    });"""
new_hdp_tx = """    const media = await this.prisma.mediaAsset.findMany({
      where: { professionalId: id },
      select: { id: true, storageKey: true, url: true },
    });
    for (const m of media) {
      const key = m.storageKey || null;
      if (key && this.storage.delete) {
        try {
          await this.storage.delete(key);
        } catch (e) {
          this.logger.warn(`hardDeleteProfessional storage delete ${key}: ${(e as Error)?.message || e}`);
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.mediaAsset.deleteMany({ where: { professionalId: id } });
      await tx.professional.delete({ where: { id } });
    });"""
if old_hdp_tx in st:
    st = st.replace(old_hdp_tx, new_hdp_tx, 1)
    print("hardDeleteProfessional storage purge")
else:
    print("hdp tx miss")

svc.write_text(st, encoding="utf-8")

# ---------------------------------------------------------------------------
# admin-ops: SMS opt-out via platform_setting list (not bio)
# ---------------------------------------------------------------------------
ops = Path("backend/src/admin/admin-ops.controller.ts")
ot = ops.read_text(encoding="utf-8")

old_opt = """      const usersRaw = await this.prisma.user.findMany({
        where: { id: { in: ids.slice(0, maxSms) }, phone: { not: null }, status: UserStatus.active },
        select: {
          id: true,
          phone: true,
          profile: { select: { bio: true } },
        },
      });
      // #r4.gap — skip explicit opt-out markers in bio (marketing:optout)
      const users = usersRaw.filter((u) => {
        const bio = (u.profile?.bio || '').toLowerCase();
        return !bio.includes('sms:optout') && !bio.includes('marketing:optout');
      });
      if (users.length < usersRaw.length) {
        smsSkippedReason = (smsSkippedReason ? smsSkippedReason + ',' : '') + 'opt_out_skipped';
      }"""

new_opt = """      const usersRaw = await this.prisma.user.findMany({
        where: { id: { in: ids.slice(0, maxSms) }, phone: { not: null }, status: UserStatus.active },
        select: { id: true, phone: true },
      });
      // #r4.bugfix — opt-out list in platform_setting (not free-text bio)
      let optOutIds = new Set<string>();
      try {
        const optRow = await this.prisma.platformSetting.findUnique({
          where: { key: 'sms_opt_out_user_ids' },
        });
        const arr = Array.isArray(optRow?.value)
          ? (optRow!.value as unknown[])
          : Array.isArray((optRow?.value as any)?.ids)
            ? (optRow!.value as any).ids
            : [];
        optOutIds = new Set(arr.map((x) => String(x)));
      } catch {
        /* ignore */
      }
      const users = usersRaw.filter((u) => !optOutIds.has(u.id));
      if (users.length < usersRaw.length) {
        smsSkippedReason = (smsSkippedReason ? smsSkippedReason + ',' : '') + 'opt_out_skipped';
      }"""

if old_opt in ot:
    ot = ot.replace(old_opt, new_opt, 1)
    ops.write_text(ot, encoding="utf-8")
    print("SMS opt-out platform_setting")
else:
    print("SMS opt pattern miss")

# ---------------------------------------------------------------------------
# Dockerfile: do not swallow symlink errors
# ---------------------------------------------------------------------------
df = Path("Dockerfile")
if df.exists():
    dt = df.read_text(encoding="utf-8")
    dt2 = dt.replace(
        "  && ln -sfn /app/.next/static /app/standalone/.next/static 2>/dev/null || true \\\n  && ln -sfn /app/public /app/standalone/public",
        "  && ln -sfn /app/.next/static /app/standalone/.next/static \\\n  && ln -sfn /app/public /app/standalone/public",
    )
    if dt2 != dt:
        df.write_text(dt2, encoding="utf-8")
        print("Dockerfile no || true")
    else:
        # broader
        if "|| true" in dt:
            dt = dt.replace(" 2>/dev/null || true", "")
            df.write_text(dt, encoding="utf-8")
            print("Dockerfile stripped || true")
        else:
            print("Dockerfile already clean")

# ---------------------------------------------------------------------------
# Remove empty junk dirs (replace with nothing — git needs delete)
# ---------------------------------------------------------------------------
for d in ["scripts/b64chunks", "scripts/buffer82", "scripts/ci-blobs", "scripts/patches"]:
    p = Path(d)
    if p.is_dir():
        shutil.rmtree(p, ignore_errors=True)
        print("rmtree", d)

# marker so commit has something if dirs were empty untracked
Path("scripts/.keep").write_text("", encoding="utf-8")

print("DONE bugfixes")
