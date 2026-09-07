/**
 * Asia/Tehran timezone helpers.
 * Iran currently observes fixed UTC+03:30 (no DST since 2022),
 * but we use the IANA zone so any future policy change is handled by the runtime.
 */

export const TEHRAN_TZ = 'Asia/Tehran';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TEHRAN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TEHRAN_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TEHRAN_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false,
});

/** YYYY-MM-DD in Asia/Tehran for a given instant. */
export function tehranDateStr(d: Date): string {
  // en-CA yields YYYY-MM-DD
  return dayFormatter.format(d);
}

/** HH:MM in Asia/Tehran for a given instant. */
export function tehranHHMM(d: Date): string {
  // en-GB 24h → "HH:MM"
  return timeFormatter.format(d);
}

/**
 * Convert a local Tehran wall-clock (date YYYY-MM-DD + HH:MM) to a UTC Date.
 * Uses iterative offset resolution so it stays correct if DST is ever reintroduced.
 */
export function tehranLocalToUtc(dateStr: string, hhmm: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  if ([y, mo, d, h, mi].some((n) => Number.isNaN(n))) {
    throw new Error('Invalid date or time');
  }

  // First guess: treat the numbers as if they were UTC, then correct by the real offset.
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0, 0));

  for (let i = 0; i < 3; i++) {
    const parts = partsFormatter.formatToParts(guess);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);

    const ty = get('year');
    const tmo = get('month');
    const td = get('day');
    const th = get('hour');
    const tmi = get('minute');

    const desiredAsUtc = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
    const actualAsUtc = Date.UTC(ty, tmo - 1, td, th, tmi, 0, 0);
    const diff = desiredAsUtc - actualAsUtc;

    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

/**
 * UTC bounds of a full calendar day in Asia/Tehran for the given YYYY-MM-DD.
 * dayStart = local midnight, dayEnd = just before next local midnight.
 */
export function tehranDayBounds(dateStr: string): {
  dayStart: Date;
  dayEnd: Date;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (UTC day of the noon instant)
} {
  const dayStart = tehranLocalToUtc(dateStr, '00:00');
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  // Safer next-day calculation via date arithmetic
  const [y, mo, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const dayEnd = new Date(tehranLocalToUtc(nextStr, '00:00').getTime() - 1);

  const noon = tehranLocalToUtc(dateStr, '12:00');
  const dayOfWeek = noon.getUTCDay();

  return { dayStart, dayEnd, dayOfWeek };
}

/** Minutes since local Tehran midnight for an instant that falls on that day. */
export function minutesSinceTehranMidnight(instant: Date, dayStart: Date): number {
  return (instant.getTime() - dayStart.getTime()) / 60_000;
}
