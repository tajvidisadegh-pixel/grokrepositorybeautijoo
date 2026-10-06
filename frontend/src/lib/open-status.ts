/**
 * Open / closed status for today in Asia/Tehran (issue #40 item 17).
 */

export type HourSlot = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive?: boolean | null;
  breaks?: { startTime: string; endTime: string }[];
};

export type OpenStatus = {
  hasHoursToday: boolean;
  isOpenNow: boolean;
  todayRangeLabel: string | null;
  badge: string;
  kind: 'open' | 'closed' | 'unknown';
};

function tehranWeekdayKey(): string {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'long',
  }).format(new Date());
  return wd.toLowerCase();
}

function toMinutes(t: string): number {
  const parts = String(t || '').split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function tehranNowMinutes(): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return toMinutes(s.replace(/\u200e/g, '').trim());
}

function fmtFaTime(t: string): string {
  const parts = String(t || '').split(':');
  if (parts.length < 2) return t;
  const h = String(Number(parts[0]));
  const m = parts[1].padStart(2, '0');
  try {
    const faDigits = (n: string) => n.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    return faDigits(h) + ':' + faDigits(m);
  } catch {
    return `${h}:${m}`;
  }
}

function normalizeDay(d: string): string {
  return String(d || '').toLowerCase().trim();
}

export function getOpenStatus(hours: HourSlot[] | null | undefined): OpenStatus {
  const list = (hours || []).filter((h) => h && h.isActive !== false);
  if (!list.length) {
    return {
      hasHoursToday: false,
      isOpenNow: false,
      todayRangeLabel: null,
      badge: 'ساعات نامشخص',
      kind: 'unknown',
    };
  }

  const today = tehranWeekdayKey();
  const todaySlots = list.filter((h) => normalizeDay(h.dayOfWeek) === today);

  if (!todaySlots.length) {
    return {
      hasHoursToday: false,
      isOpenNow: false,
      todayRangeLabel: null,
      badge: 'امروز بسته',
      kind: 'closed',
    };
  }

  let minStart = Infinity;
  let maxEnd = -Infinity;
  let minStartStr = '';
  let maxEndStr = '';
  for (const s of todaySlots) {
    const a = toMinutes(s.startTime);
    const b = toMinutes(s.endTime);
    if (Number.isFinite(a) && a < minStart) {
      minStart = a;
      minStartStr = s.startTime;
    }
    if (Number.isFinite(b) && b > maxEnd) {
      maxEnd = b;
      maxEndStr = s.endTime;
    }
  }
  const todayRangeLabel =
    minStartStr && maxEndStr
      ? `${fmtFaTime(minStartStr)} تا ${fmtFaTime(maxEndStr)}`
      : null;

  const now = tehranNowMinutes();
  let isOpenNow = false;
  if (Number.isFinite(now)) {
    for (const s of todaySlots) {
      const a = toMinutes(s.startTime);
      const b = toMinutes(s.endTime);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (now < a || now >= b) continue;
      const inBreak = (s.breaks || []).some((br) => {
        const x = toMinutes(br.startTime);
        const y = toMinutes(br.endTime);
        return Number.isFinite(x) && Number.isFinite(y) && now >= x && now < y;
      });
      if (!inBreak) {
        isOpenNow = true;
        break;
      }
    }
  }

  return {
    hasHoursToday: true,
    isOpenNow,
    todayRangeLabel,
    badge: isOpenNow ? 'الان باز است' : 'امروز بسته',
    kind: isOpenNow ? 'open' : 'closed',
  };
}
