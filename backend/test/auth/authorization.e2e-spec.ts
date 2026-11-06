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
import { PrismaClient } from '@prisma/client';

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
    await cleanupUserData(prisma);
  });

  afterAll(async () => {
    await cleanupUserData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('unauthenticated access to bookings/mine is 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/bookings/mine');
    expect(res.status).toBe(401);
  });

  it('customer cannot access admin stats (403)', async () => {
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

    expect(res.status).toBe(403);
  });

  it('customer cannot list professional bookings (403)', async () => {
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

    expect(res.status).toBe(403);
  });

  it('professional can open professional booking list', async () => {
    const reg = await register(app, {
      phone: uniquePhone(),
      password,
      displayName: 'Pro Auth',
      role: 'professional',
    });
    expect([200, 201]).toContain(reg.status);
    const token = reg.body.accessToken as string;
    expect(token).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/api/v1/bookings/professional')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
  });
});
