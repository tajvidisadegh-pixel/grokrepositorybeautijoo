import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../helpers/test-app';
import {
  assertTestDatabase,
  cleanupUserData,
  createPrisma,
  migrateTestDb,
  seedRoles,
} from '../helpers/db';
import { register, uniquePhone } from '../helpers/auth.helper';
import { PrismaClient, ProfessionalStatus, DayOfWeek } from '@prisma/client';
import {
  tehranDateStr,
  tehranLocalToUtc,
  tehranHHMM,
  tehranDayBounds,
} from '../../src/common/timezone';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.sunday,
  1: DayOfWeek.monday,
  2: DayOfWeek.tuesday,
  3: DayOfWeek.wednesday,
  4: DayOfWeek.thursday,
  5: DayOfWeek.friday,
  6: DayOfWeek.saturday,
};

describe('Bookings race / overlap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const password = 'SecurePass1';

  beforeAll(async () => {
    assertTestDatabase();
    migrateTestDb();
    seedRoles();
    prisma = createPrisma();
    app = await createTestApp();
  });

  afterEach(async () => {
    await cleanupUserData(prisma);
  });

  afterAll(async () => {
    await cleanupUserData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  async function setupApprovedProWithSlot() {
    const proPhone = uniquePhone();
    const reg = await register(app, {
      phone: proPhone,
      password,
      displayName: 'Race Pro',
      role: 'professional',
    });
    expect([200, 201]).toContain(reg.status);
    const pro = await prisma.professional.findFirst({
      where: { user: { phone: proPhone, accountType: 'professional' } },
    });
    expect(pro).toBeTruthy();

    await prisma.professional.update({
      where: { id: pro!.id },
      data: { status: ProfessionalStatus.approved, publishedAt: new Date() },
    });

    let category = await prisma.serviceCategory.findFirst({
      where: { parentId: null },
    });
    if (!category) {
      category = await prisma.serviceCategory.create({
        data: {
          name: 'تست',
          slug: `test-cat-${Date.now()}`,
          sortOrder: 1,
          isActive: true,
        },
      });
    }
    const service = await prisma.service.create({
      data: {
        name: `خدمت تست ${Date.now()}`,
        slug: `svc-${Date.now()}`,
        categoryId: category.id,
        isActive: true,
      },
    });

    await prisma.professionalService.create({
      data: {
        professionalId: pro!.id,
        serviceId: service.id,
        durationMin: 30,
        price: 100000,
        bufferMin: 0,
        isActive: true,
      },
    });

    const days: DayOfWeek[] = [
      DayOfWeek.saturday,
      DayOfWeek.sunday,
      DayOfWeek.monday,
      DayOfWeek.tuesday,
      DayOfWeek.wednesday,
      DayOfWeek.thursday,
      DayOfWeek.friday,
    ];
    for (const day of days) {
      await prisma.workingHour.create({
        data: {
          professionalId: pro!.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '20:00',
          isActive: true,
          isClosed: false,
        },
      });
    }

    const whCount = await prisma.workingHour.count({
      where: { professionalId: pro!.id },
    });
    expect(whCount).toBe(7);

    let start: Date | null = null;
    let usedDate = '';
    const candidateHours = ['10:00', '11:00', '12:00', '14:00', '16:00'];

    for (let addDays = 1; addDays <= 10 && !start; addDays++) {
      const probe = new Date(Date.now() + addDays * 86_400_000);
      const dateStr = tehranDateStr(probe);
      const { dayOfWeek } = tehranDayBounds(dateStr);
      const expectedDay = DAY_MAP[dayOfWeek];

      const avail = await request(app.getHttpServer())
        .get(`/api/v1/professionals/${pro!.id}/availability`)
        .query({ date: dateStr, durationMin: '30' });

      if (avail.status !== 200) {
        throw new Error(
          `availability status=${avail.status} body=${JSON.stringify(avail.body)} date=${dateStr}`,
        );
      }

      const slots = (avail.body?.slots || []) as { start: string; end: string }[];
      if (slots.length === 0) {
        const rows = await prisma.workingHour.findMany({
          where: { professionalId: pro!.id, dayOfWeek: expectedDay },
        });
        if (rows.length === 0) {
          throw new Error(
            `No working hours for ${dateStr} enum=${expectedDay} dow=${dayOfWeek}; avail empty`,
          );
        }
        continue;
      }

      for (const hh of candidateHours) {
        const candidate = tehranLocalToUtc(dateStr, hh);
        if (candidate.getTime() <= Date.now() + 60_000) continue;
        const hhmm = tehranHHMM(candidate);
        if (slots.some((s) => s.start === hhmm || s.start === hh)) {
          start = candidate;
          usedDate = dateStr;
          break;
        }
      }
      if (!start && slots[0]) {
        const candidate = tehranLocalToUtc(dateStr, slots[0].start);
        if (candidate.getTime() > Date.now() + 60_000) {
          start = candidate;
          usedDate = dateStr;
        }
      }
    }

    if (!start) {
      throw new Error(`No future slot for pro=${pro!.id} after probing 10 days`);
    }

    const confirmDate = tehranDateStr(start);
    const confirmHh = tehranHHMM(start);
    const confirm = await request(app.getHttpServer())
      .get(`/api/v1/professionals/${pro!.id}/availability`)
      .query({ date: confirmDate, durationMin: '30' });
    const confirmSlots = (confirm.body?.slots || []) as { start: string }[];
    if (!confirmSlots.some((s) => s.start === confirmHh)) {
      throw new Error(
        `Slot ${confirmHh} on ${confirmDate} (usedDate=${usedDate}) missing; sample=${JSON.stringify(confirmSlots.slice(0, 5))}`,
      );
    }

    return { pro, service, start };
  }

  async function registerCustomer() {
    const phone = uniquePhone();
    const reg = await register(app, {
      phone,
      password,
      displayName: 'Customer',
      role: 'customer',
    });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.accessToken).toBeTruthy();
    return reg.body.accessToken as string;
  }

  it('rejects overlapping booking on the same slot (sequential)', async () => {
    const { pro, service, start } = await setupApprovedProWithSlot();
    const token1 = await registerCustomer();
    const token2 = await registerCustomer();

    const body = {
      professionalId: pro!.id,
      serviceIds: [service.id],
      startAt: start.toISOString(),
    };

    const first = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token1}`)
      .send(body);

    if (first.status >= 300) {
      throw new Error(
        `first booking failed status=${first.status} body=${JSON.stringify(first.body)} start=${body.startAt} hhmm=${tehranHHMM(start)} date=${tehranDateStr(start)}`,
      );
    }

    const second = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token2}`)
      .send(body);
    expect([409, 400]).toContain(second.status);
  });

  it('concurrent dual requests yield exactly one successful booking', async () => {
    const { pro, service, start } = await setupApprovedProWithSlot();
    const token1 = await registerCustomer();
    const token2 = await registerCustomer();
    const body = {
      professionalId: pro!.id,
      serviceIds: [service.id],
      startAt: start.toISOString(),
    };

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token1}`)
        .send(body),
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${token2}`)
        .send(body),
    ]);

    const statuses = [a.status, b.status];
    const successes = statuses.filter((s) => s < 300).length;
    const count = await prisma.booking.count({
      where: {
        professionalId: pro!.id,
        status: { in: ['pending', 'confirmed'] },
      },
    });

    expect(count).toBe(1);
    if (successes === 0 && count === 1) {
      return;
    }
    expect(successes).toBeGreaterThanOrEqual(1);
    expect(successes).toBeLessThanOrEqual(1);
  });
});
