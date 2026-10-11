import {
  parseTimeToMinutes,
  formatMinutes,
  rangesOverlap,
  buildAvailableSlots,
} from '../../src/availability/slot-math';

describe('slot-math', () => {
  describe('parseTimeToMinutes / formatMinutes', () => {
    it('parses HH:MM', () => {
      expect(parseTimeToMinutes('09:30')).toBe(9 * 60 + 30);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('23:59')).toBe(23 * 60 + 59);
    });

    it('round-trips common times', () => {
      for (const t of ['00:00', '08:15', '12:00', '18:45', '23:59']) {
        expect(formatMinutes(parseTimeToMinutes(t))).toBe(t);
      }
    });

    it('rejects invalid time', () => {
      expect(() => parseTimeToMinutes('25:00')).toThrow(/Invalid time/);
      expect(() => parseTimeToMinutes('12:99')).toThrow(/Invalid time/);
    });
  });

  describe('rangesOverlap', () => {
    it('detects overlap', () => {
      expect(rangesOverlap(60, 120, 90, 150)).toBe(true);
      expect(rangesOverlap(0, 60, 30, 90)).toBe(true);
    });

    it('adjacent half-open ranges do not overlap', () => {
      // [9:00, 10:00) and [10:00, 11:00)
      expect(rangesOverlap(9 * 60, 10 * 60, 10 * 60, 11 * 60)).toBe(false);
    });

    it('identical ranges overlap', () => {
      expect(rangesOverlap(100, 200, 100, 200)).toBe(true);
    });

    it('disjoint ranges do not overlap', () => {
      expect(rangesOverlap(0, 30, 60, 90)).toBe(false);
    });
  });

  describe('buildAvailableSlots', () => {
    it('fills work window with duration steps', () => {
      const slots = buildAvailableSlots({
        workStart: 9 * 60,
        workEnd: 11 * 60,
        durationMin: 60,
      });
      expect(slots).toEqual([
        { start: '09:00', end: '10:00', available: true },
        { start: '10:00', end: '11:00', available: true },
      ]);
    });

    it('marks break and busy as unavailable', () => {
      const slots = buildAvailableSlots({
        workStart: 9 * 60,
        workEnd: 12 * 60,
        durationMin: 60,
        breaks: [{ start: 10 * 60, end: 11 * 60 }],
        busy: [{ start: 11 * 60, end: 12 * 60 }],
      });
      expect(slots.find((s) => s.start === '09:00')?.available).toBe(true);
      expect(slots.find((s) => s.start === '10:00')?.available).toBe(false);
      expect(slots.find((s) => s.start === '11:00')?.available).toBe(false);
    });

    it('returns empty when duration does not fit', () => {
      expect(
        buildAvailableSlots({
          workStart: 9 * 60,
          workEnd: 9 * 60 + 30,
          durationMin: 60,
        }),
      ).toEqual([]);
    });
  });
});
