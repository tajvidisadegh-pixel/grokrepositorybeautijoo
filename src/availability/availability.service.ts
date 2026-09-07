import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';
import {
  tehranDayBounds,
  minutesSinceTehranMidnight,
  tehranLocalToUtc,
  TEHRAN_TZ,
} from '../common/timezone';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.sunday,
  1: DayOfWeek.monday,
  2: DayOfWeek.tuesday,
  3: DayOfWeek.wednesday,
  4: DayOfWeek.thursday,
  5: DayOfWeek.friday,
  6: DayOfWeek.saturday,
};

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSlots(professionalId: string, dateStr: string, durationMin: number) {
    if (!durationMin || durationMin < 5) throw new BadRequestException('مدت نامعتبر');
    const pro = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');

    let bounds: { dayStart: Date; dayEnd: Date; dayOfWeek: number };
    try {
      bounds = tehranDayBounds(dateStr);
    } catch {
      throw new BadRequestException('تاریخ نامعتبر');
    }
    const { dayStart, dayEnd, dayOfWeek: dow } = bounds;
    const dayOfWeek = DAY_MAP[dow];

    const hours = await this.prisma.workingHour.findMany({
      where: { professionalId, dayOfWeek, isActive: true },
      include: { breaks: true },
    });
    if (hours.length === 0) return { date: dateStr, slots: [] };

    const [timeOffs, manuals, bookings] = await Promise.all([
      this.prisma.timeOff.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      }),
      this.prisma.manualReservation.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          professionalId,
          status: { in: ['pending', 'confirmed'] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const busy: { start: number; end: number }[] = [];
    for (const t of timeOffs) {
      busy.push({
        start: Math.max(0, minutesSinceTehranMidnight(t.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(t.endAt, dayStart)),
      });
    }
    for (const m of manuals) {
      busy.push({
        start: Math.max(0, minutesSinceTehranMidnight(m.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(m.endAt, dayStart)),
      });
    }
    for (const b of bookings) {
      busy.push({
        start: Math.max(0, minutesSinceTehranMidnight(b.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(b.endAt, dayStart)),
      });
    }

    const slots: { start: string; end: string }[] = [];
    const step = 15;

    for (const wh of hours) {
      const whStart = parseTime(wh.startTime);
      const whEnd = parseTime(wh.endTime);
      const breaks = wh.breaks.map((b) => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime),
      }));

      for (let t = whStart; t + durationMin <= whEnd; t += step) {
        const slotEnd = t + durationMin;
        const inBreak = breaks.some((b) => t < b.end && slotEnd > b.start);
        if (inBreak) continue;
        const inBusy = busy.some((b) => t < b.end && slotEnd > b.start);
        if (inBusy) continue;
        slots.push({ start: formatTime(t), end: formatTime(slotEnd) });
      }
    }

    return { date: dateStr, professionalId, durationMin, slots, timezone: TEHRAN_TZ };
  }

  /**
   * Build a UTC Date for local Tehran wall-clock time on dateStr (YYYY-MM-DD) + HH:MM.
   */
  static tehranLocalToUtc(dateStr: string, hhmm: string): Date {
    return tehranLocalToUtc(dateStr, hhmm);
  }
}
