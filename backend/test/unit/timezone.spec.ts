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
    // dayEnd is still on same Tehran calendar day
    expect(tehranDateStr(dayEnd)).toBe('2024-06-15');
  });

  it('crossing UTC midnight does not shift Tehran date wrongly', () => {
    // 01:30 Tehran = previous evening UTC
    const utc = tehranLocalToUtc('2024-01-10', '01:30');
    expect(tehranDateStr(utc)).toBe('2024-01-10');
    expect(tehranHHMM(utc)).toBe('01:30');
  });
});
