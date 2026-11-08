#!/usr/bin/env python3
"""Fix env snapshot on save, user opt-out routes, bulk skipped list, concurrent-safe opt-out."""
from pathlib import Path

# ---------------------------------------------------------------------------
# admin.service.ts
# ---------------------------------------------------------------------------
svc = Path("backend/src/admin/admin.service.ts")
st = svc.read_text(encoding="utf-8")

# 1) getPlatformSettings returns panel view (defaults+env+stored)
#    but updatePlatformSettings must load RAW stored only — never env snapshot

# Add getStoredPlatformConfig helper if missing
if "getStoredPlatformConfig" not in st:
    st = st.replace(
        "  async getPlatformSettings() {",
        "  /** Raw panel JSON only (no env merge) — safe for read-modify-write saves. */\n"
        "  private async getStoredPlatformConfig(): Promise<Record<string, unknown>> {\n"
        "    const row = await this.prisma.platformSetting.findUnique({\n"
        "      where: { key: 'platform_config' },\n"
        "    });\n"
        "    if (row?.value && typeof row.value === 'object' && !Array.isArray(row.value)) {\n"
        "      return row.value as Record<string, unknown>;\n"
        "    }\n"
        "    return {};\n"
        "  }\n\n  async getPlatformSettings() {",
        1,
    )
    print("getStoredPlatformConfig added")

# updatePlatformSettings: start from stored raw + defaults, NOT getPlatformSettings()
old_ups_start = None
# Find updatePlatformSettings body start
if "async updatePlatformSettings" in st:
    # Replace pattern where current = await this.getPlatformSettings()
    if "const current = await this.getPlatformSettings();" in st:
        # only within updatePlatformSettings - replace first occurrence after method
        idx = st.find("async updatePlatformSettings")
        idx2 = st.find("const current = await this.getPlatformSettings();", idx)
        if idx2 > 0 and idx2 - idx < 800:
            st = st[:idx2] + (
                "const current = this.deepMerge(\n"
                "      this.platformDefaults() as unknown as Record<string, unknown>,\n"
                "      await this.getStoredPlatformConfig(),\n"
                "    ); // never seed DB with env snapshot\n"
            ) + st[idx2 + len("const current = await this.getPlatformSettings();"):]
            print("updatePlatformSettings no env snapshot")
        else:
            print("getPlatformSettings call not near update")
    else:
        print("no getPlatformSettings in update")

# bulk: report remaining as skipped
old_bulk = """    const deletedIds: string[] = [];
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
    };"""
new_bulk = """    const deletedIds: string[] = [];
    const failed: { id: string; error: string }[] = [];
    let stopAt = -1;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        await this.hardDeleteUser(id, actorId);
        deletedIds.push(id);
      } catch (e) {
        failed.push({ id, error: (e as Error)?.message || String(e) });
        stopAt = i;
        break;
      }
    }
    const skipped =
      stopAt >= 0 ? ids.slice(stopAt + 1).map((id) => ({ id, reason: 'not_attempted_after_error' })) : [];
    return {
      deleted: deletedIds.length,
      failed,
      skipped,
      cappedAt: 50,
      deletedIds,
      partial: failed.length > 0 || skipped.length > 0,
    };"""
if old_bulk in st:
    st = st.replace(old_bulk, new_bulk, 1)
    print("bulk skipped list")
else:
    print("bulk pattern miss")

svc.write_text(st, encoding="utf-8")

# ---------------------------------------------------------------------------
# admin-ops: concurrent-safe opt-out with cap
# ---------------------------------------------------------------------------
ops = Path("backend/src/admin/admin-ops.controller.ts")
ot = ops.read_text(encoding="utf-8")

# Replace addSmsOptOut / removeSmsOptOut bodies with transactional update
old_add = None
if "async addSmsOptOut" in ot:
    # rewrite both methods with a safer pattern using upsert of full list under transaction
    import re
    # Simple replace of the upsert section to use interactive transaction + max 50k
    ot2 = ot
    # Add helper method if missing
    if "private async mutateSmsOptOut" not in ot2:
        helper = '''
  private async mutateSmsOptOut(userId: string, optOut: boolean) {
    const key = 'sms_opt_out_user_ids';
    const MAX = 50_000;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.platformSetting.findUnique({ where: { key } });
      const prev = Array.isArray(row?.value)
        ? (row!.value as string[])
        : Array.isArray((row?.value as any)?.ids)
          ? ((row!.value as any).ids as string[])
          : [];
      let ids = prev.map(String);
      if (optOut) {
        if (!ids.includes(userId)) ids.push(userId);
      } else {
        ids = ids.filter((x) => x !== userId);
      }
      if (ids.length > MAX) {
        // drop oldest entries (front of array)
        ids = ids.slice(ids.length - MAX);
      }
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: ids as any },
        update: { value: ids as any },
      });
      return ids;
    });
  }
'''
        # insert helper before listSmsOptOut
        if "async listSmsOptOut" in ot2:
            ot2 = ot2.replace("  async listSmsOptOut", helper + "\n  async listSmsOptOut", 1)
            print("mutateSmsOptOut helper")

        # simplify add/remove to use helper
        # Replace addSmsOptOut body roughly
        add_pat = r"async addSmsOptOut\([\s\S]*?return \{ ok: true, ids \};\n  \}"
        add_new = """async addSmsOptOut(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('not found');
    const ids = await this.mutateSmsOptOut(id, true);
    await this.audit(actorId, 'admin.sms.opt_out.add', 'user', id, { ids: ids.length });
    return { ok: true, ids };
  }"""
        ot3, n = re.subn(add_pat, add_new, ot2, count=1)
        if n:
            ot2 = ot3
            print("addSmsOptOut rewritten")
        else:
            print("addSmsOptOut regex miss")

        rem_pat = r"async removeSmsOptOut\([\s\S]*?return \{ ok: true, ids \};\n  \}"
        rem_new = """async removeSmsOptOut(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    const ids = await this.mutateSmsOptOut(id, false);
    await this.audit(actorId, 'admin.sms.opt_out.remove', 'user', id, { ids: ids.length });
    return { ok: true, ids };
  }"""
        ot3, n = re.subn(rem_pat, rem_new, ot2, count=1)
        if n:
            ot2 = ot3
            print("removeSmsOptOut rewritten")
        else:
            print("removeSmsOptOut regex miss")

        ot = ot2

ops.write_text(ot, encoding="utf-8")

# ---------------------------------------------------------------------------
# auth.controller: fix this.authService -> this.auth, require auth (not Public)
# ---------------------------------------------------------------------------
acp = Path("backend/src/auth/auth.controller.ts")
ac = acp.read_text(encoding="utf-8")

# Fix wrong property name
ac = ac.replace("this.authService.setSmsOptOut", "this.auth.setSmsOptOut")

# Make opt-out routes authenticated: remove erroneous @Public() immediately above them
old_pub = """  @Public()

  /** User self-service: opt out of marketing/bulk SMS. */
  @Post('me/sms-opt-out')
  async smsOptOut(@CurrentUser('id') userId: string) {
    return this.auth.setSmsOptOut(userId, true);
  }

  @Post('me/sms-opt-in')
  async smsOptIn(@CurrentUser('id') userId: string) {
    return this.auth.setSmsOptOut(userId, false);
  }
"""
new_pub = """  /** User self-service: opt out of marketing/bulk SMS (authenticated). */
  @ApiBearerAuth()
  @Post('me/sms-opt-out')
  @HttpCode(200)
  async smsOptOut(@CurrentUser('id') userId: string) {
    return this.auth.setSmsOptOut(userId, true);
  }

  @ApiBearerAuth()
  @Post('me/sms-opt-in')
  @HttpCode(200)
  async smsOptIn(@CurrentUser('id') userId: string) {
    return this.auth.setSmsOptOut(userId, false);
  }
"""
if old_pub in ac:
    ac = ac.replace(old_pub, new_pub, 1)
    print("auth opt-out routes fixed")
else:
    # try if still authService
    old_pub2 = old_pub.replace("this.auth.setSmsOptOut", "this.authService.setSmsOptOut")
    if old_pub2 in ac:
        ac = ac.replace(old_pub2, new_pub, 1)
        print("auth opt-out routes fixed v2")
    else:
        print("auth routes pattern miss — trying soft fix")
        ac = ac.replace("this.authService.setSmsOptOut", "this.auth.setSmsOptOut")

acp.write_text(ac, encoding="utf-8")

# ---------------------------------------------------------------------------
# auth.service setSmsOptOut — transactional + cap (if exists)
# ---------------------------------------------------------------------------
asp = Path("backend/src/auth/auth.service.ts")
ats = asp.read_text(encoding="utf-8")
if "async setSmsOptOut" in ats:
    old_m = None
    # replace whole method with safer version
    import re
    pat = r"async setSmsOptOut\(userId: string, optOut: boolean\) \{[\s\S]*?return \{ ok: true, optOut, idsCount: ids\.length \};\n  \}"
    new_m = """async setSmsOptOut(userId: string, optOut: boolean) {
    const key = 'sms_opt_out_user_ids';
    const MAX = 50_000;
    const ids = await this.prisma.$transaction(async (tx) => {
      const row = await tx.platformSetting.findUnique({ where: { key } });
      const prev = Array.isArray(row?.value)
        ? (row!.value as string[])
        : Array.isArray((row?.value as any)?.ids)
          ? ((row!.value as any).ids as string[])
          : [];
      let next = prev.map(String);
      if (optOut) {
        if (!next.includes(userId)) next.push(userId);
      } else {
        next = next.filter((x) => x !== userId);
      }
      if (next.length > MAX) next = next.slice(next.length - MAX);
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: next as any },
        update: { value: next as any },
      });
      return next;
    });
    return { ok: true, optOut, idsCount: ids.length };
  }"""
    ats2, n = re.subn(pat, new_m, ats, count=1)
    if n:
        asp.write_text(ats2, encoding="utf-8")
        print("auth.service setSmsOptOut tx+cap")
    else:
        print("auth.service setSmsOptOut regex miss")
else:
    # add method
    print("setSmsOptOut missing — append")
    method = '''
  async setSmsOptOut(userId: string, optOut: boolean) {
    const key = 'sms_opt_out_user_ids';
    const MAX = 50_000;
    const ids = await this.prisma.$transaction(async (tx) => {
      const row = await tx.platformSetting.findUnique({ where: { key } });
      const prev = Array.isArray(row?.value)
        ? (row!.value as string[])
        : Array.isArray((row?.value as any)?.ids)
          ? ((row!.value as any).ids as string[])
          : [];
      let next = prev.map(String);
      if (optOut) {
        if (!next.includes(userId)) next.push(userId);
      } else {
        next = next.filter((x) => x !== userId);
      }
      if (next.length > MAX) next = next.slice(next.length - MAX);
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: next as any },
        update: { value: next as any },
      });
      return next;
    });
    return { ok: true, optOut, idsCount: ids.length };
  }
'''
    # before last closing brace
    idx = ats.rfind("\n}\n")
    if idx > 0:
        ats = ats[:idx] + method + ats[idx:]
        asp.write_text(ats, encoding="utf-8")
        print("setSmsOptOut appended")

print("DONE")
