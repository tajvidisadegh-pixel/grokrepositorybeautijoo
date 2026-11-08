#!/usr/bin/env python3
"""Final r4 gap fixes."""
from pathlib import Path

# ---------------------------------------------------------------------------
# 1) getPlatformSettings: stored panel wins over env
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

old_gps = """    // defaults <- stored panel <- env overlay (env wins for ops-critical knobs)
    const merged = this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      stored,
    );
    return this.deepMerge(merged, this.envOverlay());"""
new_gps = """    // defaults <- env fallbacks <- stored panel (panel wins when set)
    const withEnv = this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      this.envOverlay(),
    );
    return this.deepMerge(withEnv, stored);"""
if old_gps in st:
    st = st.replace(old_gps, new_gps, 1)
    print("settings: panel wins")
else:
    print("settings pattern miss")

# bulkHardDelete: accurate reporting on mid-loop failure
old_bulk_end = """    // Sequential deletes after precheck (each hardDeleteUser has its own tx).
    // Not a single multi-user DB transaction — precheck prevents partial history loss.
    const deletedIds: string[] = [];
    for (const id of ids) {
      await this.hardDeleteUser(id, actorId);
      deletedIds.push(id);
    }
    return { deleted: deletedIds.length, failed: [] as string[], cappedAt: 50, deletedIds };
  }"""
new_bulk_end = """    // Sequential deletes after precheck (each hardDeleteUser has its own tx).
    const deletedIds: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of ids) {
      try {
        await this.hardDeleteUser(id, actorId);
        deletedIds.push(id);
      } catch (e) {
        failed.push({ id, error: (e as Error)?.message || String(e) });
        // Stop further deletes; report partial success accurately
        break;
      }
    }
    return {
      deleted: deletedIds.length,
      failed,
      cappedAt: 50,
      deletedIds,
      partial: failed.length > 0,
    };
  }"""
if old_bulk_end in st:
    st = st.replace(old_bulk_end, new_bulk_end, 1)
    print("bulk report fixed")
else:
    print("bulk end miss")

svc.write_text(st, encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) admin-ops: SMS opt-out write endpoints + transactional phone update
# ---------------------------------------------------------------------------
ops = Path("backend/src/admin/admin-ops.controller.ts")
ot = ops.read_text(encoding="utf-8")

# Fix updateUserProfile phone+revoke in one transaction
old_phone = """      dto.phone = nextPhone;
      await this.prisma.user.update({ where: { id }, data: { phone: nextPhone, phoneVerified: false } }); await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }"""
new_phone = """      dto.phone = nextPhone;
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { phone: nextPhone, phoneVerified: false },
        });
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    }"""
if old_phone in ot:
    ot = ot.replace(old_phone, new_phone, 1)
    print("phone+revoke transaction")
else:
    # try multiline variant
    old2 = """      await this.prisma.user.update({ where: { id }, data: { phone: nextPhone, phoneVerified: false } }); await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });"""
    if old2 in ot:
        ot = ot.replace(old2, """      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { phone: nextPhone, phoneVerified: false } });
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      });""", 1)
        print("phone+revoke transaction v2")
    else:
        print("phone pattern miss")

# Add SMS opt-out endpoints before end of class if missing
if "sms_opt_out_user_ids" in ot and "setSmsOptOut" not in ot and "sms-opt-out" not in ot:
    # insert before last closing of class - find last method end
    marker = "  @RequirePermissions('admin.professionals.write')\n  @Patch('professionals/:id/feature')"
    inject = '''
  /** Read SMS opt-out user id list (#r4). */
  @RequirePermissions('admin.users.read')
  @Get('sms-opt-out')
  async listSmsOptOut() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'sms_opt_out_user_ids' } });
    const ids = Array.isArray(row?.value)
      ? (row!.value as string[])
      : Array.isArray((row?.value as any)?.ids)
        ? ((row!.value as any).ids as string[])
        : [];
    return { ids };
  }

  /** Add user to SMS opt-out list. */
  @RequirePermissions('admin.users.write')
  @Post('users/:id/sms-opt-out')
  async addSmsOptOut(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('not found');
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'sms_opt_out_user_ids' } });
    const prev = Array.isArray(row?.value)
      ? (row!.value as string[])
      : Array.isArray((row?.value as any)?.ids)
        ? ((row!.value as any).ids as string[])
        : [];
    const ids = Array.from(new Set([...prev.map(String), id]));
    await this.prisma.platformSetting.upsert({
      where: { key: 'sms_opt_out_user_ids' },
      create: { key: 'sms_opt_out_user_ids', value: ids as any },
      update: { value: ids as any },
    });
    await this.audit(actorId, 'admin.sms.opt_out.add', 'user', id, { ids: ids.length });
    return { ok: true, ids };
  }

  /** Remove user from SMS opt-out list. */
  @RequirePermissions('admin.users.write')
  @Post('users/:id/sms-opt-in')
  async removeSmsOptOut(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'sms_opt_out_user_ids' } });
    const prev = Array.isArray(row?.value)
      ? (row!.value as string[])
      : Array.isArray((row?.value as any)?.ids)
        ? ((row!.value as any).ids as string[])
        : [];
    const ids = prev.map(String).filter((x) => x !== id);
    await this.prisma.platformSetting.upsert({
      where: { key: 'sms_opt_out_user_ids' },
      create: { key: 'sms_opt_out_user_ids', value: ids as any },
      update: { value: ids as any },
    });
    await this.audit(actorId, 'admin.sms.opt_out.remove', 'user', id, { ids: ids.length });
    return { ok: true, ids };
  }

'''
    if marker in ot:
        ot = ot.replace(marker, inject + marker, 1)
        print("sms opt-out endpoints added")
    else:
        # append before final closing brace of class
        idx = ot.rfind("\n}\n")
        if idx > 0:
            ot = ot[:idx] + "\n" + inject + ot[idx:]
            print("sms opt-out endpoints appended")
        else:
            print("could not insert endpoints")

ops.write_text(ot, encoding="utf-8")

# ---------------------------------------------------------------------------
# 3) User self-service SMS opt-out on auth controller if present
# ---------------------------------------------------------------------------
auth_c = Path("backend/src/auth/auth.controller.ts")
if auth_c.exists():
    ac = auth_c.read_text(encoding="utf-8")
    if "sms-opt-out" not in ac and "SmsOpt" not in ac:
        # inject a simple endpoint near other me routes
        if "@Get('me')" in ac or '@Get("me")' in ac:
            # find class end and inject is fragile; add after a known method
            needle = None
            for cand in ["  @Post('logout')", '  @Post("logout")', "  @Get('me')"]:
                if cand in ac:
                    needle = cand
                    break
            block = '''
  /** User self-service: opt out of marketing/bulk SMS. */
  @Post('me/sms-opt-out')
  async smsOptOut(@CurrentUser('id') userId: string) {
    return this.authService.setSmsOptOut(userId, true);
  }

  @Post('me/sms-opt-in')
  async smsOptIn(@CurrentUser('id') userId: string) {
    return this.authService.setSmsOptOut(userId, false);
  }

'''
            # place before logout if found
            if needle and needle.startswith("  @Post('logout')"):
                ac = ac.replace(needle, block + needle, 1)
                auth_c.write_text(ac, encoding="utf-8")
                print("auth controller opt-out routes")
            else:
                print("auth controller inject skipped (structure)")

# auth.service setSmsOptOut
auth_s = Path("backend/src/auth/auth.service.ts")
if auth_s.exists():
    ats = auth_s.read_text(encoding="utf-8")
    if "setSmsOptOut" not in ats:
        # append method before last closing of class
        method = '''
  async setSmsOptOut(userId: string, optOut: boolean) {
    const key = 'sms_opt_out_user_ids';
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    const prev = Array.isArray(row?.value)
      ? (row!.value as string[])
      : Array.isArray((row?.value as any)?.ids)
        ? ((row!.value as any).ids as string[])
        : [];
    let ids = prev.map(String);
    if (optOut) ids = Array.from(new Set([...ids, userId]));
    else ids = ids.filter((x) => x !== userId);
    await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: ids as any },
      update: { value: ids as any },
    });
    return { ok: true, optOut, idsCount: ids.length };
  }
'''
        # insert before final `}\n` of file (class end)
        # find last occurrence of "\n}\n" at class level - after recordImpersonationEnd or issueImpersonation
        anchor = "  async issueImpersonationAccessToken"
        if anchor in ats:
            # insert method after recordImpersonationEnd if exists
            if "async recordImpersonationEnd" in ats:
                # find end of recordImpersonationEnd
                i = ats.find("async recordImpersonationEnd")
                # find next async after it
                j = ats.find("\n  async ", i + 10)
                if j > 0:
                    ats = ats[:j] + "\n" + method + ats[j:]
                    auth_s.write_text(ats, encoding="utf-8")
                    print("auth.service setSmsOptOut")
                else:
                    print("auth.service insert fail")
            else:
                print("no recordImpersonationEnd")
        else:
            print("no issueImpersonation anchor")

print("DONE final gaps")
