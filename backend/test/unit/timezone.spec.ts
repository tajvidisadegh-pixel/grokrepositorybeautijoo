import {
  tehranDateStr,
  tehranHHMM,
  tehranLocalToUtc,
  tehranDayBounds,
  TEHRAN_TZ,
} from '../../src/common/timezone';

describe('timezone helpers (Asia/Tehran)', () => {
  it('exposes TEHRAN_TZ', () => {
    expect(TEHRAN_TZ).toBe('Asia/Tehran');
  });

  it('tehranLocalToUtc + tehranDateStr round-trip for noon', () => {
    const utc = tehranLocalToUtc('2024-03-20', '12:00');
    expect(tehranDateStr(utc)).toBe('2024-03-20');
    expect(tehranHHMM(utc)).toBe('12:00');
  });

  it('midnight edge: 00:00 Tehran stays on same calendar day', () => {
    const utc = tehranLocalToUtc('2024-06-15', '00:00');
    expect(tehranDateStr(utc)).toBe('2024-06-15');
    expect(tehranHHMM(utc)).toBe('00:00');
  });

  it('23:59 Tehran stays on same calendar day', () => {
    const utc = tehranLocalToUtc('2024-06-15', '23:59');
    expect(tehranDateStr(utc)).toBe('2024-06-15');
    expect(tehranHHMM(utc)).toBe('23:59');
  });

  it('day bounds: weekday is Tehran-local (not UTC)', () => {
    // 2024-06-15 is a Saturday in Tehran
    const { dayOfWeek, dayStart, dayEnd } = tehranDayBounds('2024-06-15');
    expect(dayOfWeek).toBe(6); // Sat
    expect(dayStart.getTime()).toBeLessThan(dayEnd.getTime());
    expect(tehranDateStr(dayStart)).toBe('2024-06-15');
    expect(tehranDateStr(dayEnd)).toBe('2024-06-15');
  });

  it('crossing UTC midnight does not shift Tehran date wrongly', () => {
    const utc = tehranLocalToUtc('2024-01-10', '01:30');
    expect(tehranDateStr(utc)).toBe('2024-01-10');
    expect(tehranHHMM(utc)).toBe('01:30');
  });

  it('rejects invalid local input', () => {
    expect(() => tehranLocalToUtc('not-a-date', '12:00')).toThrow();
    expect(() => tehranLocalToUtc('2024-01-01', 'xx:yy')).toThrow();
  });

  it('fixed offset +03:30 for sample winter date (no DST since 2022)', () => {
    const utc = tehranLocalToUtc('2024-01-15', '12:00');
    // 12:00 Tehran = 08:30 UTC
    expect(utc.toISOString()).toBe('2024-01-15T08:30:00.000Z');
  });

  it('fixed offset +03:30 for sample summer date', () => {
    const utc = tehranLocalToUtc('2024-07-15', '12:00');
    expect(utc.toISOString()).toBe('2024-07-15T08:30:00.000Z');
  });

  it('day bounds span almost 24h', () => {
    const { dayStart, dayEnd } = tehranDayBounds('2024-03-21');
    const spanMs = dayEnd.getTime() - dayStart.getTime();
    // just under 24h (dayEnd is last instant of day)
    expect(spanMs).toBeGreaterThan(23 * 3600 * 1000);
    expect(spanMs).toBeLessThanOrEqual(24 * 3600 * 1000);
  });
});
