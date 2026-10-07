# -*- coding: utf-8 -*-
from pathlib import Path
import re

def read(p):
    return Path(p).read_text(encoding='utf-8')

def write(p, t):
    Path(p).write_text(t, encoding='utf-8')
    print('wrote', p, 'len', len(t))

# ---------- 51: human duration in booking wizard ----------
wiz = Path('frontend/src/components/booking/booking-wizard.tsx')
if wiz.exists():
    t = wiz.read_text(encoding='utf-8')
    if 'function formatDurationFa' not in t:
        # insert helper after imports / near top of file before component
        helper = '''
function formatDurationFa(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin || 0));
  if (m < 60) return `حدود ${m.toLocaleString('fa-IR')} دقیقه`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `حدود ${h.toLocaleString('fa-IR')} ساعت`;
  return `حدود ${h.toLocaleString('fa-IR')} ساعت و ${r.toLocaleString('fa-IR')} دقیقه`;
}

'''
        # place before type Step or export function
        if 'type Step =' in t:
            t = t.replace('type Step =', helper + 'type Step =', 1)
        else:
            t = helper + t
    # replace display of totalDuration minutes in summary and subtitle
    t = t.replace(
        "{totalDuration} دقیقه — {formatPrice(displayPrice)}",
        "{formatDurationFa(totalDuration)} — {formatPrice(displayPrice)}",
    )
    t = t.replace(
        '<dd>{totalDuration} دقیقه</dd>',
        '<dd>{formatDurationFa(totalDuration)}</dd>',
    )
    write(str(wiz), t)
else:
    print('wizard missing')

# ---------- 52: upcoming / past tabs on panel bookings ----------
pb = Path('frontend/src/app/panel/bookings/page.tsx')
if pb.exists():
    t = pb.read_text(encoding='utf-8')
    if "timeScope" not in t:
        # add state after statusFilter
        t = t.replace(
            "const [statusFilter, setStatusFilter] = useState('');",
            "const [statusFilter, setStatusFilter] = useState('');\n  const [timeScope, setTimeScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');",
            1,
        )
        # insert time scope tabs before status filter
        needle = '''      <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">'''
        tabs = '''      <div className="flex flex-wrap gap-2" aria-label="بازه زمانی">
        {([
          { v: 'upcoming' as const, l: 'آینده' },
          { v: 'past' as const, l: 'گذشته' },
          { v: 'all' as const, l: 'همه' },
        ]).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setTimeScope(o.v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              timeScope === o.v
                ? 'border-coral bg-coral text-white'
                : 'border-border bg-white hover:border-coral'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">'''
        if needle in t:
            t = t.replace(needle, tabs, 1)
        # filter items in map
        # replace items.map with filtered
        if 'const visibleItems =' not in t:
            t = t.replace(
                '{items.length === 0 ? (',
                '''{(() => {
        const now = Date.now();
        const visibleItems = items.filter((b) => {
          if (timeScope === 'all') return true;
          const start = new Date(b.startAt).getTime();
          const isPast =
            Number.isFinite(start) &&
            (start < now ||
              b.status === 'completed' ||
              b.status === 'cancelled' ||
              b.status === 'rejected' ||
              b.status === 'expired');
          return timeScope === 'past' ? isPast : !isPast;
        });
        return visibleItems.length === 0 ? (''',
                1,
            )
            # close the IIFE - find PanelEmpty closing and list
            # The structure is: items.length === 0 ? (PanelEmpty) : (ul...)
            # We changed to visibleItems.length === 0 ? (
            # Need to replace items.map with visibleItems.map and close IIFE
            t = t.replace(
                '{items.map((b) => {',
                '{visibleItems.map((b) => {',
                1,
            )
            # After the list closing, need )})()}
            # Find:        </ul>
            #      )}
            # that follows the map - replace closing
            old_close = '''        </ul>
      )}
'''
            new_close = '''        </ul>
      );
      })()}
'''
            if old_close in t:
                t = t.replace(old_close, new_close, 1)
            else:
                print('WARN: could not close IIFE cleanly')
    write(str(pb), t)
else:
    print('panel bookings missing')

# ---------- 54: SMS deep links ----------
notif = Path('backend/src/notifications/notifications.service.ts')
if notif.exists():
    t = notif.read_text(encoding='utf-8')
    if 'appendSmsLink' not in t:
        # enhance sendSmsSafe to accept optional href
        old = '''  private async sendSmsSafe(userId: string, message: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      const phone = user?.phone?.trim();
      if (!phone) return;
      await this.sms.sendNotification(phone, message);
    } catch (err) {
      this.logger.warn(`SMS failed user=${userId}: ${(err as Error)?.message}`);
    }
  }'''
        new = '''  private appendSmsLink(message: string, data?: Record<string, unknown>): string {
    const href = typeof data?.href === 'string' ? data.href.trim() : '';
    if (!href) return message;
    const base =
      (process.env.FRONTEND_URL || process.env.APP_URL || process.env.PUBLIC_WEB_URL || '').replace(/\/$/, '');
    if (!base) return message;
    const path = href.startsWith('/') ? href : `/${href}`;
    return `${message}\n${base}${path}`;
  }

  private async sendSmsSafe(
    userId: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      const phone = user?.phone?.trim();
      if (!phone) return;
      const full = this.appendSmsLink(message, data);
      await this.sms.sendNotification(phone, full);
    } catch (err) {
      this.logger.warn(`SMS failed user=${userId}: ${(err as Error)?.message}`);
    }
  }'''
        if old in t:
            t = t.replace(old, new, 1)
        else:
            print('WARN: sendSmsSafe block not found exactly')
        # update call site
        t = t.replace(
            'await this.sendSmsSafe(input.userId, input.body);',
            'await this.sendSmsSafe(input.userId, input.body, input.data);',
            1,
        )
    write(str(notif), t)

# reminder hrefs with booking id
rem = Path('backend/src/reminders/reminders.service.ts')
if rem.exists():
    t = rem.read_text(encoding='utf-8')
    t2 = t.replace(
        "href: `/panel/bookings`,",
        "href: `/panel/bookings?focus=${b.id}`,",
    )
    t2 = t2.replace(
        "href: `/zibagar/bookings`,",
        "href: `/zibagar/bookings?focus=${b.id}`,",
    )
    # only for reminder data blocks - the replace is fine globally for those exact strings
    # but daily summary also has href: '/zibagar/bookings' without template - leave it
    if t2 != t:
        write(str(rem), t2)
    else:
        print('reminders href already patched or pattern missing')

# bookings confirm/cancel SMS - ensure data has href with id (already often has bookingId)
bk = Path('backend/src/bookings/bookings.service.ts')
if bk.exists():
    t = bk.read_text(encoding='utf-8')
    # strengthen common href patterns if missing booking focus
    # leave as-is if already has href; add focus where plain /panel/bookings
    t2 = t.replace(
        "href: `/panel/bookings`",
        "href: `/panel/bookings?focus=${id}`",
    )
    t2 = t2.replace(
        "href: `/zibagar/bookings`",
        "href: `/zibagar/bookings?focus=${id}`",
    )
    if t2 != t:
        write(str(bk), t2)

print('done 51/52/54 core')
