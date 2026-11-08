#!/usr/bin/env python3
"""Replace sequential bulk SMS loop with concurrent batches + deliveryStatus updates."""
from pathlib import Path

p = Path("backend/src/admin/admin-ops.controller.ts")
t = p.read_text(encoding="utf-8")

old = """      const msg = `${title}
${body}`.slice(0, 400);
      for (const u of users) {
        if (!u.phone) continue;
        try {
          await this.sms.sendNotification(u.phone, msg);
          smsSent++;
        } catch (e) {
          smsFailed++;
          this.logger.warn(`bulk SMS fail user=${u.id}: ${e}`);
        }
      }
      if (ids.length > maxSms) {
        smsSkippedReason = `capped_at_${maxSms}`;
      }"""

new = """      const msg = `${title}\n${body}`.slice(0, 400);
      if (ids.length > maxSms) smsSkippedReason = `capped_at_${maxSms}`;
      const concurrency = 10;
      for (let i = 0; i < users.length; i += concurrency) {
        const slice = users.slice(i, i + concurrency);
        const results = await Promise.all(
          slice.map(async (u) => {
            if (!u.phone) return { ok: false as const, id: u.id };
            try {
              await this.sms.sendNotification(u.phone, msg);
              return { ok: true as const, id: u.id };
            } catch (e) {
              this.logger.warn(`bulk SMS fail user=${u.id}: ${e}`);
              return { ok: false as const, id: u.id };
            }
          }),
        );
        for (const r of results) {
          if (r.ok) smsSent++;
          else smsFailed++;
          try {
            await this.prisma.notification.updateMany({
              where: {
                userId: r.id,
                data: { path: ['campaignId'], equals: campaignId },
              },
              data: {
                data: {
                  campaignId,
                  deliveryStatus: r.ok ? 'sent' : 'failed',
                  smsRequested: true,
                  smsDelivered: r.ok,
                } as any,
              },
            });
          } catch {
            /* non-blocking */
          }
        }
      }"""

if old not in t:
    # try with escaped newline representation as single line template
    old2 = old.replace("${title}\n${body}", "${title}\n${body}")
    if old not in t:
        print("loop pattern not found; trying flexible match")
        start = t.find("const msg = `${title}")
        end = t.find("if (ids.length > maxSms)", start)
        if start < 0 or end < 0:
            print("FAIL: cannot locate SMS loop")
            raise SystemExit(1)
        # include the if block after loop
        end2 = t.find("}", end)
        # find closing of if (ids.length > maxSms) block
        end_block = t.find("}", t.find("smsSkippedReason", end)) + 1
        print("found region", start, end_block)
        t = t[:start] + new + "\n" + t[end_block:]
        p.write_text(t, encoding="utf-8")
        print("replaced flexible", "concurrency" in t, "smsDelivered" in t)
        raise SystemExit(0)

t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("ok", "concurrency" in t, "smsDelivered" in t)
