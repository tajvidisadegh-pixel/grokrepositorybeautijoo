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
import { tehranDateStr, tehranLocalToUtc } from '../../src/common/timezone';

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

    // Find a real available slot within the next week (must match availability API)
    let start: Date | null = null;
    for (let addDays = 1; addDays <= 8; addDays++) {
      const probe = new Date(Date.now() + addDays * 86_400_000);
      const dateStr = tehranDateStr(probe);
      const avail = await request(app.getHttpServer())
        .get(`/api/v1/professionals/${pro!.id}/availability`)
        .query({ date: dateStr, durationMin: '30' });
      expect(avail.status).toBe(200);
      const slots = (avail.body?.slots || []) as { start: string; end: string }[];
      if (slots.length > 0) {
        const candidate = tehranLocalToUtc(dateStr, slots[0].start);
        if (candidate.getTime() > Date.now() + 60_000) {
          start = candidate;
          break;
        }
      }
    }
    if (!start) {
      throw new Error(`No future availability slots found for pro=${pro!.id}`);
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
        `first booking failed status=${first.status} body=${JSON.stringify(first.body)} start=${body.startAt}`,
      );
    }

    const second = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token2}`)
      .send(body);
    expect(second.status).toBe(409);
  });

  it('concurrent dual requests yield at most one successful booking', async () => {
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
    expect(successes).toBeLessThanOrEqual(1);
    expect(successes).toBeGreaterThanOrEqual(1);

    const count = await prisma.booking.count({
      where: {
        professionalId: pro!.id,
        status: { in: ['pending', 'confirmed'] },
      },
    });
    expect(count).toBe(1);
  });
});
