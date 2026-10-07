from pathlib import Path
import re

p48 = Path("frontend/src/app/professionals/[slug]/page.tsx")
t48 = p48.read_text()
if "عضو از" not in t48:
    if "آخرین فعالیت" in t48:
        pos = t48.find("آخرین فعالیت")
        end = t48.find("</div>", pos)
        end = t48.find("\n", end) + 1
        insert = "\n                {pro.createdAt && (\n                  <span className=\"text-xs text-gray\">\n                    عضو از{' '}\n                    {new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', timeZone: 'Asia/Tehran' }).format(new Date(pro.createdAt))}\n                  </span>\n                )}\n"
        t48 = t48[:end] + insert + t48[end:]
        print("48 after activity OK")
    elif "ratingCount" in t48:
        idx = t48.find("({pro.ratingCount}")
        if idx > 0:
            close = t48.find("</span>", idx)
            close = t48.find("\n", close) + 1
            insert = "                  {pro.createdAt && (\n                    <span className=\"text-xs text-gray\">\n                      عضو از{' '}\n                      {new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', timeZone: 'Asia/Tehran' }).format(new Date(pro.createdAt))}\n                    </span>\n                  )}\n"
            t48 = t48[:close] + insert + t48[close:]
            print("48 after rating OK")
        else:
            print("48 rating pos missing")
    else:
        print("48 marker weak")
    p48.write_text(t48)
else:
    print("48 skip")

p46 = Path("frontend/src/components/booking/booking-wizard.tsx")
t46 = p46.read_text()
if "نوبت باقی" not in t46:
    map_idx = t46.find("{slots.map")
    if map_idx > 0:
        insert = "{(() => {\n              const avail = slots.filter((s) => s.available !== false);\n              if (avail.length > 0 && avail.length <= 3) {\n                return (\n                  <p className=\"mb-2 text-xs font-medium text-coral\">\n                    فقط {avail.length.toLocaleString('fa-IR')} نوبت باقی مانده\n                  </p>\n                );\n              }\n              return null;\n            })()}\n            "
        t46 = t46[:map_idx] + insert + t46[map_idx:]
        print("46 capacity OK")
    else:
        print("46 map missing")
    p46.write_text(t46)
else:
    print("46 skip")

p_bk = Path("backend/src/bookings/bookings.service.ts")
t_bk = p_bk.read_text()
if "_blockedCustomerIds" not in t_bk:
    marker = "if (!customer.phoneVerified)"
    idx = t_bk.find(marker)
    if idx > 0:
        end = t_bk.find("}", idx)
        end = t_bk.find("\n", end) + 1
        block_check = "\n    {\n      const proRow = await this.prisma.professional.findUnique({\n        where: { id: professionalId },\n        select: { socialLinks: true },\n      });\n      const links = (proRow?.socialLinks as { _blockedCustomerIds?: string[] } | null) || null;\n      const blocked = Array.isArray(links?._blockedCustomerIds) ? links!._blockedCustomerIds! : [];\n      if (blocked.includes(customerId)) {\n        throw new BadRequestException('\u0645\u062a\u0623\u0633\u0641\u0627\u0646\u0647 \u0627\u0645\u06a9\u0627\u0646 \u0631\u0632\u0631\u0648 \u0646\u0632\u062f \u0627\u06cc\u0646 \u0632\u06cc\u0628\u0627\u06af\u0631 \u0628\u0631\u0627\u06cc \u0634\u0645\u0627 \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.');\n      }\n    }\n"
        t_bk = t_bk[:end] + block_check + t_bk[end:]
        print("49 booking gate OK")
    else:
        print("49 phone marker missing")
else:
    print("49 booking gate skip")
p_bk.write_text(t_bk)

p_ps = Path("backend/src/professionals/professionals.service.ts")
t_ps = p_ps.read_text()
if "blockCustomer" not in t_ps:
    m = re.search(r"import \{([^}]+)\} from '@nestjs/common';", t_ps)
    if m and "BadRequestException" not in m.group(1):
        t_ps = t_ps.replace(m.group(0), m.group(0).replace("{", "{ BadRequestException,"), 1)
    methods = "\n  async listBlockedCustomers(userId: string) {\n    const pro = await this.prisma.professional.findUnique({ where: { userId } });\n    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');\n    const links = (pro.socialLinks as { _blockedCustomerIds?: string[] } | null) || {};\n    const ids = Array.isArray(links._blockedCustomerIds) ? links._blockedCustomerIds : [];\n    if (!ids.length) return { items: [] as { id: string; phone?: string | null; displayName?: string | null }[] };\n    const users = await this.prisma.user.findMany({\n      where: { id: { in: ids } },\n      select: { id: true, phone: true, profile: { select: { displayName: true } } },\n    });\n    return { items: users.map((u) => ({ id: u.id, phone: u.phone, displayName: u.profile?.displayName ?? null })) };\n  }\n\n  async blockCustomer(userId: string, customerId: string) {\n    const pro = await this.prisma.professional.findUnique({ where: { userId } });\n    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');\n    if (customerId === userId) throw new BadRequestException('\u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u06cc\u062f \u062e\u0648\u062f\u062a\u0627\u0646 \u0631\u0627 \u0645\u0633\u062f\u0648\u062f \u06a9\u0646\u06cc\u062f');\n    const links = { ...((pro.socialLinks as Record<string, unknown>) || {}) } as Record<string, unknown>;\n    const prev = Array.isArray(links._blockedCustomerIds) ? (links._blockedCustomerIds as string[]) : [];\n    if (!prev.includes(customerId)) {\n      links._blockedCustomerIds = [...prev, customerId];\n      await this.prisma.professional.update({ where: { id: pro.id }, data: { socialLinks: links as object } });\n    }\n    return { ok: true };\n  }\n\n  async unblockCustomer(userId: string, customerId: string) {\n    const pro = await this.prisma.professional.findUnique({ where: { userId } });\n    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');\n    const links = { ...((pro.socialLinks as Record<string, unknown>) || {}) } as Record<string, unknown>;\n    const prev = Array.isArray(links._blockedCustomerIds) ? (links._blockedCustomerIds as string[]) : [];\n    links._blockedCustomerIds = prev.filter((id) => id !== customerId);\n    await this.prisma.professional.update({ where: { id: pro.id }, data: { socialLinks: links as object } });\n    return { ok: true };\n  }\n"
    last = t_ps.rfind("}")
    t_ps = t_ps[:last] + methods + "\n" + t_ps[last:]
    p_ps.write_text(t_ps)
    print("49 pro service methods OK")
else:
    print("49 pro service skip")

p_pc = Path("backend/src/professionals/professionals.controller.ts")
t_pc = p_pc.read_text()
if "blocked-customers" not in t_pc:
    if "Delete" not in t_pc:
        t_pc = t_pc.replace("Body, Controller, Get, Param, Patch, Post, Query", "Body, Controller, Delete, Get, Param, Patch, Post, Query")
    routes = "\n  @ApiBearerAuth()\n  @Roles('professional', 'admin', 'SUPER_ADMIN')\n  @Get('me/blocked-customers')\n  listBlocked(@CurrentUser('id') userId: string) {\n    return this.service.listBlockedCustomers(userId);\n  }\n\n  @ApiBearerAuth()\n  @Roles('professional', 'admin', 'SUPER_ADMIN')\n  @Post('me/blocked-customers')\n  blockCustomer(@CurrentUser('id') userId: string, @Body() body: { customerId: string }) {\n    return this.service.blockCustomer(userId, body.customerId);\n  }\n\n  @ApiBearerAuth()\n  @Roles('professional', 'admin', 'SUPER_ADMIN')\n  @Delete('me/blocked-customers/:customerId')\n  unblockCustomer(@CurrentUser('id') userId: string, @Param('customerId') customerId: string) {\n    return this.service.unblockCustomer(userId, customerId);\n  }\n\n"
    if "/** Public profile by slug" in t_pc:
        t_pc = t_pc.replace("/** Public profile by slug", routes + "  /** Public profile by slug")
        print("49 controller OK")
    elif "@Get(':slug')" in t_pc:
        t_pc = t_pc.replace("@Get(':slug')", routes + "  @Get(':slug')")
        print("49 controller alt OK")
    else:
        print("49 controller marker missing")
    p_pc.write_text(t_pc)
else:
    print("49 controller skip")

p_zb = Path("frontend/src/app/zibagar/bookings/page.tsx")
t_zb = p_zb.read_text()
if "مسدود کردن مشتری" not in t_zb:
    if "apiClient" not in t_zb:
        if "from '@/lib/panel-api'" in t_zb:
            t_zb = t_zb.replace("from '@/lib/panel-api';", "from '@/lib/panel-api';\nimport { apiClient } from '@/lib/api';")
        else:
            t_zb = "import { apiClient } from '@/lib/api';\n" + t_zb
    if "async function blockCustomer" not in t_zb:
        fn = "\n  async function blockCustomer(customerId: string) {\n    if (!customerId) return;\n    if (typeof window !== 'undefined' && !window.confirm('\u0627\u06cc\u0646 \u0645\u0634\u062a\u0631\u06cc \u062f\u06cc\u06af\u0631 \u0646\u062a\u0648\u0627\u0646\u062f \u0627\u0632 \u0634\u0645\u0627 \u0646\u0648\u0628\u062a \u0628\u06af\u06cc\u0631\u062f. \u0627\u062f\u0627\u0645\u0647 \u0645\u06cc\u200c\u062f\u0647\u06cc\u062f\u061f')) return;\n    setBusy(`${customerId}:block`);\n    setError(null);\n    try {\n      await apiClient.post('/professionals/me/blocked-customers', { customerId });\n      setActionMsg('\u0645\u0634\u062a\u0631\u06cc \u0645\u0633\u062f\u0648\u062f \u0634\u062f.');\n    } catch (e) {\n      setError(friendlyApiError(e));\n    } finally {\n      setBusy(null);\n    }\n  }\n\n"
        idx = t_zb.find("async function submitReport")
        if idx < 0:
            idx = t_zb.find("async function act(")
        if idx > 0:
            t_zb = t_zb[:idx] + fn + t_zb[idx:]
            print("49 FE fn OK")
    if "setReportFor(reportFor === b.id" in t_zb:
        needle = "setReportFor(reportFor === b.id ? null : b.id)"
        pos = t_zb.find(needle)
        if pos > 0:
            btn_end = t_zb.find("</button>", pos)
            btn_end = t_zb.find("\n", btn_end) + 1
            btn = "                            {b.customer?.id && (\n                              <button type=\"button\" className=\"text-xs text-red-600 hover:underline\" disabled={busy === `${b.customer.id}:block`} onClick={() => void blockCustomer(b.customer!.id)}>\n                                مسدود کردن مشتری\n                              </button>\n                            )}\n"
            t_zb = t_zb[:btn_end] + btn + t_zb[btn_end:]
            print("49 FE button OK")
    p_zb.write_text(t_zb)
else:
    print("49 FE skip")

p50 = Path("backend/src/reminders/reminders.service.ts")
t50 = p50.read_text()
if "sendDailyProSummaries" not in t50:
    t50 = t50.replace(
        "export type ReminderStats = {\n  reminders24h: number;\n  reminders2h: number;\n  reviewRequests: number;\n};",
        "export type ReminderStats = {\n  reminders24h: number;\n  reminders2h: number;\n  reviewRequests: number;\n  dailyProSummaries: number;\n};",
    )
    t50 = t50.replace(
        "  async runAll(): Promise<ReminderStats> {\n    const [reminders24h, reminders2h, reviewRequests] = await Promise.all([\n      this.sendWindowReminders('24h', 23, 25),\n      this.sendWindowReminders('2h', 1.5, 2.5),\n      this.sendReviewRequests(),\n    ]);\n    return { reminders24h, reminders2h, reviewRequests };\n  }",
        "  async runAll(): Promise<ReminderStats> {\n    const [reminders24h, reminders2h, reviewRequests, dailyProSummaries] = await Promise.all([\n      this.sendWindowReminders('24h', 23, 25),\n      this.sendWindowReminders('2h', 1.5, 2.5),\n      this.sendReviewRequests(),\n      this.sendDailyProSummaries(),\n    ]);\n    return { reminders24h, reminders2h, reviewRequests, dailyProSummaries };\n  }",
    )
    t50 = t50.replace(
        "Reminders done: 24h=${stats.reminders24h} 2h=${stats.reminders2h} review=${stats.reviewRequests}",
        "Reminders done: 24h=${stats.reminders24h} 2h=${stats.reminders2h} review=${stats.reviewRequests} daily=${stats.dailyProSummaries}",
    )
    method = "\n  async sendDailyProSummaries(): Promise<number> {\n    const now = new Date();\n    const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', hour12: false }).format(now);\n    const hour = parseInt(hourStr, 10);\n    if (Number.isNaN(hour) || hour < 7 || hour > 10) return 0;\n    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);\n    const startUtc = new Date(`${dayKey}T00:00:00+03:30`);\n    const endUtc = new Date(`${dayKey}T23:59:59+03:30`);\n    const bookings = await this.prisma.booking.findMany({\n      where: { status: BookingStatus.confirmed, startAt: { gte: startUtc, lte: endUtc } },\n      select: { id: true, startAt: true, professional: { select: { userId: true } } },\n      orderBy: { startAt: 'asc' },\n    });\n    const byPro = new Map<string, { count: number; first: Date }>();\n    for (const b of bookings) {\n      const uid = b.professional.userId;\n      const cur = byPro.get(uid);\n      if (!cur) byPro.set(uid, { count: 1, first: b.startAt });\n      else byPro.set(uid, { count: cur.count + 1, first: cur.first });\n    }\n    let sent = 0;\n    for (const [userId, info] of byPro) {\n      const already = await this.hasDayNotification(userId, dayKey);\n      if (already) continue;\n      const timeFa = this.formatTehran(info.first);\n      const result = await this.notifications.create({\n        userId,\n        type: NotificationType.system,\n        title: '\u062e\u0644\u0627\u0635\u0647 \u0646\u0648\u0628\u062a\u200c\u0647\u0627\u06cc \u0627\u0645\u0631\u0648\u0632',\n        body: `\u0627\u0645\u0631\u0648\u0632 ${info.count} \u0646\u0648\u0628\u062a \u062f\u0627\u0631\u06cc\u062f. \u0627\u0648\u0644\u06cc\u0646 \u0646\u0648\u0628\u062a: ${timeFa}`,\n        data: { kind: 'daily_pro_summary', dayKey, count: info.count, href: '/zibagar/bookings' },\n        sms: false,\n      });\n      if (result?.id) sent += 1;\n    }\n    return sent;\n  }\n\n  private async hasDayNotification(userId: string, dayKey: string): Promise<boolean> {\n    const rows = await this.prisma.notification.findMany({\n      where: { userId, type: NotificationType.system, createdAt: { gte: new Date(Date.now() - 2 * 24 * 3600_000) } },\n      select: { data: true },\n      take: 30,\n    });\n    for (const r of rows) {\n      const data = r.data as { kind?: string; dayKey?: string } | null;\n      if (data?.kind === 'daily_pro_summary' && data.dayKey === dayKey) return true;\n    }\n    return false;\n  }\n\n"
    if "private async hasNotification(" in t50:
        t50 = t50.replace(
            "  /** Dedup: any existing notification of this type for the same bookingId (+ optional window). */\n  private async hasNotification(",
            method + "  /** Dedup: any existing notification of this type for the same bookingId (+ optional window). */\n  private async hasNotification(",
        )
        print("50 reminders OK")
    else:
        last = t50.rfind("}")
        t50 = t50[:last] + method + t50[last:]
        print("50 reminders alt OK")
    p50.write_text(t50)
else:
    print("50 skip")

print("DONE 46-50")
