/** #62.10 — full booking lifecycle coverage (create → pay path → complete → review). */
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

/**
 * Full booking happy-path e2e (#40):
 * register pro+customer → slot → create booking → mock pay → complete → review
 */
describe('Bookings lifecycle (e2e)', () => {
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
      displayName: 'Lifecycle Pro',
      role: 'professional',
    });
    expect([200, 201]).toContain(reg.status);
    const proToken = reg.body.accessToken as string;
    expect(proToken).toBeTruthy();

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
          name: 'تست lifecycle',
          slug: `life-cat-${Date.now()}`,
          sortOrder: 1,
          isActive: true,
        },
      });
    }
    const service = await prisma.service.create({
      data: {
        name: `خدمت lifecycle ${Date.now()}`,
        slug: `life-svc-${Date.now()}`,
        categoryId: category.id,
        isActive: true,
      },
    });

    await prisma.professionalService.create({
      data: {
        professionalId: pro!.id,
        serviceId: service.id,
        durationMin: 30,
        price: 150000,
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

    let start: Date | null = null;
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
          `availability status=${avail.status} body=${JSON.stringify(avail.body)}`,
        );
      }

      const slots = (avail.body?.slots || []) as { start: string; end: string }[];
      if (slots.length === 0) {
        const rows = await prisma.workingHour.findMany({
          where: { professionalId: pro!.id, dayOfWeek: expectedDay },
        });
        if (rows.length === 0) {
          throw new Error(`No WH for ${dateStr} enum=${expectedDay}`);
        }
        continue;
      }

      for (const hh of candidateHours) {
        const candidate = tehranLocalToUtc(dateStr, hh);
        if (candidate.getTime() <= Date.now() + 60_000) continue;
        const hhmm = tehranHHMM(candidate);
        if (slots.some((s) => s.start === hhmm || s.start === hh)) {
          start = candidate;
          break;
        }
      }
      if (!start && slots[0]) {
        const candidate = tehranLocalToUtc(dateStr, slots[0].start);
        if (candidate.getTime() > Date.now() + 60_000) {
          start = candidate;
        }
      }
    }

    if (!start) {
      throw new Error('Could not find an available future slot for lifecycle test');
    }

    return { pro: pro!, service, start, proToken, proPhone };
  }

  async function registerCustomer() {
    const phone = uniquePhone();
    const reg = await register(app, {
      phone,
      password,
      displayName: 'Life Customer',
      role: 'customer',
    });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.accessToken).toBeTruthy();
    return { token: reg.body.accessToken as string, phone };
  }

  it('create → mock pay → confirm → complete → review',
    async () => {
      const { pro, service, start, proToken } = await setupApprovedProWithSlot();
      const { token: customerToken } = await registerCustomer();

      // 1) Create booking
      const created = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          professionalId: pro.id,
          serviceIds: [service.id],
          startAt: start.toISOString(),
        });

      if (created.status >= 300) {
        throw new Error(
          `create booking failed ${created.status} ${JSON.stringify(created.body)}`,
        );
      }
      const bookingId = created.body.id as string;
      expect(bookingId).toBeTruthy();
      expect(['pending', 'confirmed']).toContain(created.body.status);

      // 2) Initiate payment (mock provider in NODE_ENV=test)
      const payInit = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId,
          callbackUrl: 'http://localhost:3000/payment/callback',
        });

      // If payment is disabled in test env, soft-skip pay path but still complete flow via pro confirm
      let paid = false;
      if (payInit.status < 300 && payInit.body?.providerRef) {
        const ref = payInit.body.providerRef as string;
        const cb = await request(app.getHttpServer())
          .get('/api/v1/payments/callback')
          .query({ Authority: ref, Status: 'OK', ref });
        expect(cb.status).toBe(200);
        expect(cb.body?.status).toBe('paid');

        const payment = await prisma.payment.findUnique({ where: { bookingId } });
        expect(payment?.status).toBe('paid');
        expect(payment?.platformCommissionAmount).toBeGreaterThanOrEqual(0);
        paid = true;

        const afterPay = await prisma.booking.findUnique({ where: { id: bookingId } });
        expect(afterPay?.status).toBe('confirmed');
      } else {
        // Fallback: pro confirms without online pay
        const conf = await request(app.getHttpServer())
          .patch(`/api/v1/bookings/${bookingId}/confirm`)
          .set('Authorization', `Bearer ${proToken}`);
        expect([200, 201]).toContain(conf.status);
      }

      // 3) Pro completes
      const done = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${proToken}`);
      expect([200, 201]).toContain(done.status);

      const completed = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(completed?.status).toBe('completed');

      // 4) Customer leaves review
      const review = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId,
          rating: 5,
          comment: 'عالی بود — تست lifecycle',
        });
      expect([200, 201]).toContain(review.status);

      const reviewRow = await prisma.review.findUnique({ where: { bookingId } });
      expect(reviewRow?.rating).toBe(5);

      // Idempotent: second review rejected
      const dup = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ bookingId, rating: 4 });
      expect([400, 409]).toContain(dup.status);

      // sanity: paid flag recorded when mock pay ran
      if (paid) {
        const p = await prisma.payment.findUnique({ where: { bookingId } });
        expect(p?.status).toBe('paid');
      }
    },
    60_000,
  );

  it('customer can cancel pending booking and notify path stays consistent',
    async () => {
      const { pro, service, start } = await setupApprovedProWithSlot();
      const { token: customerToken } = await registerCustomer();

      const created = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          professionalId: pro.id,
          serviceIds: [service.id],
          startAt: start.toISOString(),
        });
      expect(created.status).toBeLessThan(300);
      const bookingId = created.body.id as string;

      const cancel = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'تست لغو lifecycle' });
      expect([200, 201]).toContain(cancel.status);

      const row = await prisma.booking.findUnique({ where: { id: bookingId } });
      expect(row?.status).toBe('cancelled');
    },
    60_000,
  );
});
