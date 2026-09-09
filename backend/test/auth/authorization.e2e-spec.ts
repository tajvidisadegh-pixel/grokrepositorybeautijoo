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
import { PrismaClient, ProfessionalStatus } from '@prisma/client';
import { userAuthCache } from '../../src/auth/user-auth-cache';

describe('Authorization / roles / 403 (e2e)', () => {
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
    userAuthCache.clear();
    await cleanupUserData(prisma);
  });

  afterAll(async () => {
    userAuthCache.clear();
    await cleanupUserData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('customer is forbidden from professional booking list (403)', async () => {
    const reg = await register(app, {
      phone: uniquePhone(),
      password,
      role: 'customer',
    });
    expect([200, 201]).toContain(reg.status);
    const token = reg.body.accessToken as string;
    expect(token).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/api/v1/bookings/professional')
      .set('Authorization', `Bearer ${token}`);

    // Must not succeed as a customer
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect([401, 403]).toContain(res.status);
  });

  it('customer is forbidden from admin stats (403)', async () => {
    const reg = await register(app, {
      phone: uniquePhone(),
      password,
      role: 'customer',
    });
    expect([200, 201]).toContain(reg.status);
    const token = reg.body.accessToken as string;
    expect(token).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect([401, 403]).toContain(res.status);
  });

  it('unauthenticated request to protected route is 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/bookings/mine');
    expect(res.status).toBe(401);
  });

  it('draft professional is not publicly visible by slug', async () => {
    const phone = uniquePhone();
    const reg = await register(app, {
      phone,
      password,
      displayName: 'Hidden Pro',
      role: 'professional',
    });
    expect([200, 201]).toContain(reg.status);
    const userId = reg.body.user?.id as string;
    expect(userId).toBeTruthy();

    let pro = await prisma.professional.findFirst({ where: { userId } });
    // Defensive: ensure draft pro exists for this user
    if (!pro) {
      pro = await prisma.professional.create({
        data: {
          userId,
          title: 'Hidden Pro',
          slug: `hidden-${Date.now().toString(36)}`,
          status: ProfessionalStatus.draft,
        },
      });
    }
    expect(pro.status).not.toBe(ProfessionalStatus.approved);

    const publicGet = await request(app.getHttpServer()).get(
      `/api/v1/professionals/${encodeURIComponent(pro.slug)}`,
    );

    expect(publicGet.status).not.toBe(200);
    expect([404, 400, 403]).toContain(publicGet.status);
  });
});
