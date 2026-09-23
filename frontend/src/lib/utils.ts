import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert Persian/Arabic digits to English digits. */
export function toEnglishDigits(input: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Parse a price string that may contain Persian/English digits and separators. */
export function parsePriceInput(raw: string | number): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
  const cleaned = toEnglishDigits(String(raw)).replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Format number with Persian digits and thousand separators + تومان. */
export function formatPrice(amount: number): string {
  const n = Math.floor(Number(amount) || 0);
  return new Intl.NumberFormat('fa-IR').format(n) + ' تومان';
}

/** Format number with thousand separators only (for inputs display). */
export function formatPriceDigits(amount: number): string {
  const n = Math.floor(Number(amount) || 0);
  return new Intl.NumberFormat('fa-IR').format(n);
}

/** Distance label for near-me (issue #24). km from Haversine; approximate = coarser wording. */
export function formatDistanceFromYou(
  km: number | null | undefined,
  approximate?: boolean,
): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const meters = Math.max(50, Math.round(km * 1000));
    const mFa = new Intl.NumberFormat('fa-IR').format(meters);
    return approximate ? `حدود ${mFa} متر از شما` : `${mFa} متر از شما`;
  }
  const rounded = approximate ? Math.round(km * 2) / 2 : Math.round(km * 10) / 10;
  const kmFa = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: approximate ? 1 : 1,
  }).format(rounded);
  return approximate ? `حدود ${kmFa} کیلومتر از شما` : `${kmFa} کیلومتر از شما`;
}

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function threeDigitsToWords(n: number): string {
  if (n <= 0) return '';
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ONES[o]);
  }
  return parts.join(' و ');
}

/** Convert a non-negative integer amount to Persian words. */
export function priceToWords(amount: number): string {
  let n = Math.floor(Number(amount) || 0);
  if (n < 0) n = 0;
  if (n === 0) return 'صفر تومان';
  const parts: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) {
      const w = threeDigitsToWords(chunk);
      const scaleWord = SCALES[scale];
      parts.unshift(scaleWord ? `${w} ${scaleWord}` : w);
    }
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return parts.join(' و ') + ' تومان';
}

/**
 * Canonical site-wide Jalali (Solar Hijri) date formatter.
 * Uses fa-IR-u-ca-persian so year/month/day are always شمسی.
 * Time is always 24-hour (e.g. ۱۳:۰۰ not ۱ PM).
 * Calendar day/time interpreted in Asia/Tehran.
 */
export function formatDate(
  iso?: string | Date | null,
  opts?: { style?: 'short' | 'long'; includeTime?: boolean },
): string {
  if (iso == null || iso === '') return '—';
  try {
    const d = typeof iso === 'string' || typeof iso === 'number' ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return String(iso);
    const style = opts?.style ?? 'long';
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: style === 'short' ? 'short' : 'long',
      day: 'numeric',
      hourCycle: 'h23',
    };
    if (opts?.includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = false;
    }
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(d);
  } catch {
    return String(iso);
  }
}

/** Shortcut: Jalali date + 24h time. */
export function formatDateTime(iso?: string | Date | null): string {
  return formatDate(iso, { style: 'short', includeTime: true });
}

/** Format time only in 24h (e.g. ۱۳:۳۰). */
export function formatTime24(iso?: string | Date | null): string {
  if (iso == null || iso === '') return '—';
  try {
    const d = typeof iso === 'string' || typeof iso === 'number' ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).format(d);
  } catch {
    return String(iso);
  }
}
