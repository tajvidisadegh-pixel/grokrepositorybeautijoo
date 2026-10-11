/**
 * Pure slot / time helpers for availability (unit-testable, no DB).
 * Overlap rule: half-open style [start, end) — two ranges overlap iff
 * aStart < bEnd && aEnd > bStart.
 */

export function parseTimeToMinutes(t: string): number {
  const parts = String(t).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`Invalid time: ${t}`);
  }
  return h * 60 + m;
}

export function formatMinutes(mins: number): string {
  const total = ((Math.floor(mins) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd) in minute-of-day space. */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type BusyRange = { start: number; end: number };

/**
 * Build candidate slots from work window, excluding breaks and busy ranges.
 * stepMin defaults to durationMin (non-overlapping consecutive candidates).
 */
export function buildAvailableSlots(opts: {
  workStart: number;
  workEnd: number;
  durationMin: number;
  stepMin?: number;
  breaks?: BusyRange[];
  busy?: BusyRange[];
}): { start: string; end: string; available: boolean }[] {
  const {
    workStart,
    workEnd,
    durationMin,
    stepMin = durationMin,
    breaks = [],
    busy = [],
  } = opts;
  if (durationMin < 1 || stepMin < 1) return [];
  const slots: { start: string; end: string; available: boolean }[] = [];
  for (let t = workStart; t + durationMin <= workEnd; t += stepMin) {
    const slotEnd = t + durationMin;
    const inBreak = breaks.some((b) => rangesOverlap(t, slotEnd, b.start, b.end));
    const inBusy = busy.some((b) => rangesOverlap(t, slotEnd, b.start, b.end));
    slots.push({
      start: formatMinutes(t),
      end: formatMinutes(slotEnd),
      available: !inBreak && !inBusy,
    });
  }
  return slots;
}
