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

  it('customer cannot access professional me endpoints', async () => {
    const reg = await register(app, { phone: uniquePhone(), password, role: 'customer' });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.accessToken).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    // RolesGuard → 403; unauthenticated edge → 401
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

    const pro = await prisma.professional.findFirst({
      where: { user: { phone, accountType: 'professional' } },
    });
    expect(pro).toBeTruthy();
    expect(pro!.status).toBe('draft');

    const publicGet = await request(app.getHttpServer()).get(
      `/api/v1/professionals/${pro!.slug}`,
    );
    expect([404, 400]).toContain(publicGet.status);
  });

  it('admin endpoints reject non-admin', async () => {
    const reg = await register(app, { phone: uniquePhone(), password, role: 'customer' });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.accessToken).toBeDefined();

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);

    expect([401, 403, 404]).toContain(res.status);
  });
});
