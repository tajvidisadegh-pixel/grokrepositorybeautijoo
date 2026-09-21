/** Minimal Jalali (Persian) calendar helpers — no external deps */

export type DayOfWeekValue =
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

export const PERSIAN_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

const MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Gregorian → Jalali (algorithm from jalaali-js simplified) */
export function toJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Jalali → Gregorian */
export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  const days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  let d = days % 146097;
  if (d > 36524) {
    gy += 100 * Math.floor(--d / 36524);
    d %= 36524;
    if (d >= 365) d++;
  }
  gy += 4 * Math.floor(d / 1461);
  d %= 1461;
  if (d > 365) {
    gy += Math.floor((d - 1) / 365);
    d = (d - 1) % 365;
  }
  const gd = d + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let v = gd;
  for (let i = 0; i < 13; i++) {
    const v2 = v - sal_a[i];
    if (v2 <= 0) {
      gm = i;
      break;
    }
    v = v2;
  }
  return { gy, gm, gd: v };
}

export function jalaliMonthName(jm: number): string {
  return MONTH_NAMES[(jm - 1 + 12) % 12] || String(jm);
}

export function addJalaliMonths(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  let m = jm + delta;
  let y = jy;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { jy: y, jm: m };
}

/** ISO date YYYY-MM-DD in Tehran calendar day → DayOfWeekValue (Sat=0 in Persian week) */
export function dayOfWeekFromIso(iso: string): DayOfWeekValue {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const js = dt.getUTCDay();
  const map: DayOfWeekValue[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return map[js];
}

export function isoToJalaliLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const { jy, jm, jd } = toJalali(y, m, d);
  return `${jd} ${jalaliMonthName(jm)} ${jy}`;
}

/** Today as YYYY-MM-DD in Asia/Tehran */
export function todayIsoTehran(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const offsetMs = 3.5 * 60 * 60 * 1000;
    const tehran = new Date(Date.now() + offsetMs);
    return `${tehran.getUTCFullYear()}-${pad2(tehran.getUTCMonth() + 1)}-${pad2(tehran.getUTCDate())}`;
  }
}

/** Asia/Tehran calendar date YYYY-MM-DD for any instant. */
export function tehranDateStr(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function tehranTodayIso(): string {
  return todayIsoTehran();
}

export type MonthCell = {
  iso: string;
  jy: number;
  jm: number;
  jd: number;
  inMonth: boolean;
};

/** Build 6x7 grid starting Saturday for a Jalali month */
export function buildJalaliMonthGrid(jy: number, jm: number): MonthCell[] {
  const { gy, gm, gd } = toGregorian(jy, jm, 1);
  const firstIso = `${gy}-${pad2(gm)}-${pad2(gd)}`;
  const firstDow = dayOfWeekFromIso(firstIso);
  const order: DayOfWeekValue[] = [
    'saturday',
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ];
  const startOffset = order.indexOf(firstDow);

  const daysInMonth =
    jm <= 6 ? 31 : jm <= 11 ? 30 : isJalaliLeap(jy) ? 30 : 29;

  const cells: MonthCell[] = [];
  const prev = addJalaliMonths(jy, jm, -1);
  const prevDays =
    prev.jm <= 6 ? 31 : prev.jm <= 11 ? 30 : isJalaliLeap(prev.jy) ? 30 : 29;
  for (let i = 0; i < startOffset; i++) {
    const jd = prevDays - startOffset + i + 1;
    const g = toGregorian(prev.jy, prev.jm, jd);
    cells.push({
      iso: `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`,
      jy: prev.jy,
      jm: prev.jm,
      jd,
      inMonth: false,
    });
  }
  for (let jd = 1; jd <= daysInMonth; jd++) {
    const g = toGregorian(jy, jm, jd);
    cells.push({
      iso: `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`,
      jy,
      jm,
      jd,
      inMonth: true,
    });
  }
  const next = addJalaliMonths(jy, jm, 1);
  let n = 1;
  while (cells.length < 42) {
    const g = toGregorian(next.jy, next.jm, n);
    cells.push({
      iso: `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`,
      jy: next.jy,
      jm: next.jm,
      jd: n,
      inMonth: false,
    });
    n += 1;
  }
  return cells;
}

function isJalaliLeap(jy: number): boolean {
  const breaks = [1, 5, 9, 13, 17, 22, 26, 30];
  const cy = jy % 33;
  return breaks.includes(cy);
}
