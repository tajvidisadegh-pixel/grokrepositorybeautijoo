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

describe('Authorization (e2e)', () => {
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

  it('customer cannot access professional-only booking list', async () => {
    const reg = await register(app, { phone: uniquePhone(), password, role: 'customer' });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.accessToken).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/api/v1/bookings/professional')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    expect([401, 403]).toContain(res.status);
  });

  it('draft professional is not visible on public GET /professionals/:slug', async () => {
    const phone = uniquePhone();
    const reg = await register(app, {
      phone,
      password,
      displayName: 'Hidden Pro',
      role: 'professional',
    });
    expect([200, 201]).toContain(reg.status);
    const userId = reg.body.user?.id as string;
    expect(userId).toBeDefined();

    const pro = await prisma.professional.findFirst({ where: { userId } });
    expect(pro).toBeTruthy();
    expect(['draft', 'pending_review']).toContain(pro!.status);

    const publicGet = await request(app.getHttpServer()).get(
      `/api/v1/professionals/${encodeURIComponent(pro!.slug)}`,
    );
    // Must not expose unpublished pros
    expect(publicGet.status).not.toBe(200);
    expect([404, 400, 403]).toContain(publicGet.status);
  });

  it('admin endpoints reject non-admin', async () => {
    const reg = await register(app, { phone: uniquePhone(), password, role: 'customer' });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.accessToken).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    expect([401, 403]).toContain(res.status);
  });
});
