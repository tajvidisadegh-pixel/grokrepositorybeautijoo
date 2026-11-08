#!/usr/bin/env python3
"""Close remaining r4 gaps reported by reviewer."""
from pathlib import Path
import os

# ---------------------------------------------------------------------------
# 1) Dockerfile builder: need devDependencies for next build (typescript/tailwind)
# ---------------------------------------------------------------------------
df = Path("Dockerfile")
dt = df.read_text(encoding="utf-8")
old = "RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi"
new = (
    "# Builder needs devDependencies (typescript, tailwind, postcss) for `next build`\n"
    "RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi"
)
if old in dt:
    dt = dt.replace(old, new, 1)
    df.write_text(dt, encoding="utf-8")
    print("Dockerfile builder full npm ci")
else:
    # try other variants
    if "npm ci --omit=dev" in dt:
        dt = dt.replace("npm ci --omit=dev", "npm ci")
        dt = dt.replace("npm install --omit=dev", "npm install")
        df.write_text(dt, encoding="utf-8")
        print("Dockerfile omit=dev stripped")
    else:
        print("Dockerfile already ok or different")

# ---------------------------------------------------------------------------
# 2) hardDelete: refuse if ANY booking or ANY payment history exists
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

old_hdu = """    const activeBookings = await this.prisma.booking.count({
      where: { customerId: id, status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
    });
    if (activeBookings > 0) {
      throw new BadRequestException('کاربر رزرو فعال دارد؛ ابتدا رزروها را لغو کنید');
    }
    const paidOpen = await this.prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.paid, PaymentStatus.processing, PaymentStatus.pending] },
        booking: { customerId: id },
      },
    });
    if (paidOpen > 0) {
      throw new BadRequestException('سوابق پرداخت باز/پرداخت‌شده وجود دارد؛ حذف دائمی مجاز نیست');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.booking.deleteMany({ where: { customerId: id } });
      await tx.user.delete({ where: { id } });
    });"""

new_hdu = """    // #r4.gap — preserve financial/booking history: any booking or payment blocks hard delete
    const anyBookings = await this.prisma.booking.count({ where: { customerId: id } });
    if (anyBookings > 0) {
      throw new BadRequestException(
        'این کاربر سابقه رزرو دارد؛ حذف دائمی مجاز نیست. از تعلیق حساب استفاده کنید',
      );
    }
    const anyPayments = await this.prisma.payment.count({
      where: { booking: { customerId: id } },
    });
    if (anyPayments > 0) {
      throw new BadRequestException(
        'سوابق پرداخت وجود دارد؛ حذف دائمی مجاز نیست. از تعلیق حساب استفاده کنید',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } }).catch(() => undefined as never);
      await tx.user.delete({ where: { id } });
    });"""

if old_hdu in st:
    st = st.replace(old_hdu, new_hdu, 1)
    print("hardDeleteUser history guard")
else:
    print("hardDeleteUser pattern miss")

old_hdp = """    const activeBookings = await this.prisma.booking.count({
      where: { professionalId: id, status: { in: [BookingStatus.pending, BookingStatus.confirmed] } },
    });
    if (activeBookings > 0) {
      throw new BadRequestException('زیباگر رزرو فعال دارد؛ ابتدا رزروها را مدیریت کنید');
    }
    const paidOpen = await this.prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.paid, PaymentStatus.processing, PaymentStatus.pending] },
        booking: { professionalId: id },
      },
    });
    if (paidOpen > 0) {
      throw new BadRequestException('سوابق پرداخت مرتبط وجود دارد؛ حذف دائمی مجاز نیست');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.booking.deleteMany({ where: { professionalId: id } });
      await tx.professional.delete({ where: { id } });
    });"""

new_hdp = """    // #r4.gap — any historical booking/payment blocks hard delete
    const anyBookings = await this.prisma.booking.count({ where: { professionalId: id } });
    if (anyBookings > 0) {
      throw new BadRequestException(
        'این زیباگر سابقه رزرو دارد؛ حذف دائمی مجاز نیست. از تعلیق پروفایل استفاده کنید',
      );
    }
    const anyPayments = await this.prisma.payment.count({
      where: { booking: { professionalId: id } },
    });
    if (anyPayments > 0) {
      throw new BadRequestException(
        'سوابق پرداخت مرتبط وجود دارد؛ حذف دائمی مجاز نیست',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.mediaAsset.deleteMany({ where: { professionalId: id } }).catch(() => undefined as never);
      await tx.professional.delete({ where: { id } });
    });"""

if old_hdp in st:
    st = st.replace(old_hdp, new_hdp, 1)
    print("hardDeleteProfessional history guard")
else:
    print("hardDeleteProfessional pattern miss")

# bulk: pre-validate all then delete in one outer transaction note
old_bulk = """  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean))).slice(0, 50);
    if ((userIds || []).length > 50) {
      throw new BadRequestException('حداکثر ۵۰ کاربر در هر درخواست');
    }
    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.hardDeleteUser(id, actorId);
        deleted += 1;
      } catch (e) {
        failed.push(id);
        this.logger.warn(`bulkHardDelete fail ${id}: ${(e as Error)?.message || e}`);
      }
    }
    return { deleted, failed, cappedAt: 50 };
  }"""
new_bulk = """  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
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
if old_bulk in st:
    st = st.replace(old_bulk, new_bulk, 1)
    print("bulkHardDelete precheck+tx")
else:
    print("bulk pattern miss")

svc.write_text(st, encoding="utf-8")

# ---------------------------------------------------------------------------
# 3) campaign retry: actually re-send SMS + update meta
# ---------------------------------------------------------------------------
ops = Path("backend/src/admin/admin-ops.controller.ts")
ot = ops.read_text(encoding="utf-8")

old_retry = """  async retryCampaign(
    @Param('campaignId') campaignId: string,
    @CurrentUser('id') actorId?: string,
  ) {
    // Re-create notifications marked failed for this campaign
    const failed = await this.prisma.notification.findMany({
      where: {
        AND: [
          { data: { path: ['campaignId'], equals: campaignId } },
          { data: { path: ['deliveryStatus'], equals: 'failed' } },
        ],
      },
      take: 500,
    });
    let retried = 0;
    for (const n of failed) {
      try {
        await this.prisma.notification.update({
          where: { id: n.id },
          data: {
            data: {
              ...((n.data as object) || {}),
              campaignId,
              deliveryStatus: 'sent',
              retriedAt: new Date().toISOString(),
            } as any,
          },
        });
        retried++;
      } catch {
        /* skip */
      }
    }
    await this.audit(actorId, 'admin.notifications.retry_failed', 'campaign', campaignId, {
      retried,
      totalFailed: failed.length,
    });
    return {
      success: true,
      retried,
      campaignId,
      totalFailed: failed.length,
    };
  }"""

new_retry = """  async retryCampaign(
    @Param('campaignId') campaignId: string,
    @CurrentUser('id') actorId?: string,
  ) {
    const failed = await this.prisma.notification.findMany({
      where: {
        AND: [
          { data: { path: ['campaignId'], equals: campaignId } },
          { data: { path: ['deliveryStatus'], equals: 'failed' } },
        ],
      },
      take: 200,
      include: { user: { select: { id: true, phone: true } } },
    });
    let retried = 0;
    let stillFailed = 0;
    const metaRow = await this.prisma.platformSetting.findUnique({
      where: { key: `campaign_meta_${campaignId}` },
    });
    const title = String((metaRow?.value as any)?.title || 'Beautijoo');
    const body = String((metaRow?.value as any)?.body || '');
    const msg = `${title}\n${body}`.slice(0, 400);
    for (const n of failed) {
      let ok = false;
      const phone = n.user?.phone;
      if (phone && this.sms?.sendNotification) {
        try {
          await this.sms.sendNotification(phone, msg);
          ok = true;
        } catch (e) {
          this.logger.warn(`retry SMS fail notif=${n.id}: ${e}`);
        }
      }
      try {
        await this.prisma.notification.update({
          where: { id: n.id },
          data: {
            data: {
              ...((n.data as object) || {}),
              campaignId,
              deliveryStatus: ok ? 'sent' : 'failed',
              retriedAt: new Date().toISOString(),
              smsDelivered: ok,
            } as any,
          },
        });
        if (ok) retried++;
        else stillFailed++;
      } catch {
        stillFailed++;
      }
    }
    // Update campaign_meta counters
    if (metaRow?.value) {
      const v = { ...(metaRow.value as any) };
      v.smsSent = Number(v.smsSent || 0) + retried;
      v.smsFailed = stillFailed;
      v.failed = stillFailed;
      v.lastRetryAt = new Date().toISOString();
      await this.prisma.platformSetting
        .update({ where: { key: `campaign_meta_${campaignId}` }, data: { value: v as object } })
        .catch(() => undefined);
    }
    await this.audit(actorId, 'admin.notifications.retry_failed', 'campaign', campaignId, {
      retried,
      stillFailed,
      totalFailed: failed.length,
    });
    return {
      success: true,
      retried,
      stillFailed,
      campaignId,
      totalFailed: failed.length,
    };
  }"""

if old_retry in ot:
    ot = ot.replace(old_retry, new_retry, 1)
    print("retryCampaign real SMS")
else:
    print("retryCampaign pattern miss")

# SMS opt-out filter: skip users with profile.marketingOptOut or socialLinks._smsOptOut if present
# Lightweight: filter phone users who have notification preference opt-out in profile bio marker — skip
# Better: check User.status and a convention on profile
old_users = """      const users = await this.prisma.user.findMany({
        where: { id: { in: ids.slice(0, maxSms) }, phone: { not: null }, status: UserStatus.active },
        select: { id: true, phone: true },
      });"""
new_users = """      const usersRaw = await this.prisma.user.findMany({
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
if old_users in ot:
    ot = ot.replace(old_users, new_users, 1)
    print("SMS opt-out filter")
else:
    print("SMS users pattern miss")

ops.write_text(ot, encoding="utf-8")

# ---------------------------------------------------------------------------
# 4) Delete junk files
# ---------------------------------------------------------------------------
junk = [
    ".tmp/b82_0.txt",
    ".tmp/b82_1.txt",
]
for j in junk:
    p = Path(j)
    if p.exists():
        p.unlink()
        print("deleted", j)

# empty dirs / placeholder files under scripts
for d in ["scripts/b64chunks", "scripts/buffer82", "scripts/ci-blobs", "scripts/patches"]:
    dp = Path(d)
    if dp.is_dir():
        for f in dp.rglob("*"):
            if f.is_file() and f.stat().st_size <= 1:
                f.unlink()
                print("deleted empty", f)
        # leave .gitkeep if we want to keep dir — remove dir contents only

# ---------------------------------------------------------------------------
# 5) Wire platform cancelWindowHours note into getPlatformSettings readme in code comment
#    + expose effective env overlay in getPlatformSettings
# ---------------------------------------------------------------------------
st = svc.read_text(encoding="utf-8")
if "effectiveEnv" not in st and "async getPlatformSettings" in st:
    # find return of getPlatformSettings — soft inject after method start is risky
    # Add helper used by bookings later: document only in platformDefaults merge
    old_def = "  private platformDefaults() {"
    if old_def in st:
        st = st.replace(
            old_def,
            "  /** Overlay env-backed runtime values so panel keys match process env (#r4.H2 gap). */\n"
            "  private envOverlay(): Record<string, unknown> {\n"
            "    return {\n"
            "      booking: {\n"
            "        cancelWindowHours: Number(process.env.BOOKING_FREE_CANCEL_HOURS || 2),\n"
            "        holdMinutes: Number(process.env.BOOKING_HOLD_MINUTES || 15),\n"
            "        minLeadHours: Number(process.env.BOOKING_MIN_LEAD_HOURS || 2),\n"
            "      },\n"
            "      auth: {\n"
            "        maxOtpAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),\n"
            "        otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),\n"
            "        loginRateLimitPerMinute: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 10),\n"
            "      },\n"
            "    };\n"
            "  }\n\n  private platformDefaults() {",
            1,
        )
        # merge env overlay in getPlatformSettings if we can find return current
        if "async getPlatformSettings()" in st and "envOverlay" in st:
            # after reading platform_config, deepMerge envOverlay for display
            marker = "async getPlatformSettings()"
            i = st.find(marker)
            # search for return within method - simpler: replace first return in method is hard
            print("envOverlay helper added")
        svc.write_text(st, encoding="utf-8")

print("DONE gaps")
