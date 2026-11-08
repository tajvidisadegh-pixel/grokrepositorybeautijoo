#!/usr/bin/env python3
"""Apply #82.r3 admin-ops security patches."""
from pathlib import Path

p = Path("backend/src/admin/admin-ops.controller.ts")
t = p.read_text(encoding="utf-8")

t = t.replace(
    "if (depth > 12) return null;",
    "if (depth > 12) return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').slice(0, 5000) : value;",
    1,
)

if "rawSize > 400_000" not in t:
    t = t.replace(
        "async putContent(@Body() body: any, @CurrentUser('id') actorId?: string) {\n    const cleaned = stripHtmlDeep({",
        "async putContent(@Body() body: any, @CurrentUser('id') actorId?: string) {\n    const rawSize = Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8');\n    if (rawSize > 400_000) throw new BadRequestException('payload too large');\n    const cleaned = stripHtmlDeep({",
        1,
    )

if "listRaw.length > 200" in t and "sbSize" not in t:
    t = t.replace(
        "if (listRaw.length > 200) throw new BadRequestException",
        "const sbSize = Buffer.byteLength(JSON.stringify(listRaw), 'utf8');\n    if (sbSize > 400_000) throw new BadRequestException('payload too large');\n    if (listRaw.length > 200) throw new BadRequestException",
        1,
    )

t = t.replace(
    "deliveryStatus: 'sent',\n              smsRequested: !!dto.sms,",
    "deliveryStatus: dto.sms ? 'pending' : 'sent',\n              smsRequested: !!dto.sms,",
)
t = t.replace(
    "data: { campaignId, deliveryStatus: 'sent', smsRequested: !!dto.sms } as any,",
    "data: { campaignId, deliveryStatus: dto.sms ? 'pending' : 'sent', smsRequested: !!dto.sms } as any,",
)

old = "const maxSms = Math.min(ids.length, Number(process.env.BULK_SMS_MAX || 200));"
new = (
    "const envMax = parseInt(process.env.BULK_SMS_MAX || '200', 10);\n"
    "      const hardMax = Math.min(200, Number.isFinite(envMax) && envMax > 0 ? envMax : 200);\n"
    "      const maxSms = Math.min(ids.length, hardMax);"
)
if old in t:
    t = t.replace(old, new, 1)
    print("hardcap")

oldi = "const idsList = [campaignId, ...(Array.isArray(prev) ? prev : [])].slice(0, 500);"
newi = (
    "const prevIds = Array.isArray(prev) ? prev.filter((x: string) => x !== campaignId) : [];\n"
    "      const idsList = [campaignId, ...prevIds].slice(0, 500);"
)
if oldi in t:
    t = t.replace(oldi, newi, 1)
    print("idx")

t = t.replace(
    "where: { id: { in: ids.slice(0, maxSms) }, phone: { not: null } },",
    "where: { id: { in: ids.slice(0, maxSms) }, phone: { not: null }, status: UserStatus.active },",
    1,
)

p.write_text(t, encoding="utf-8")
print("done", "hardMax" in t, "400_000" in t, "dto.sms ? 'pending'" in t)
