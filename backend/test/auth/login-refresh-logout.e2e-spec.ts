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
import { login, logout, me, refresh, register, uniquePhone } from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';

describe('Auth Login / Refresh / Logout / me (e2e)', () => {
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

  it('customer login returns tokens and roles', async () => {
    const phone = uniquePhone();
    await register(app, { phone, password, role: 'customer' });
    const res = await login(app, phone, password, 'customer');
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toEqual(['customer']);
    expect(res.body.accessToken).toBeDefined();
    // Non-production may still return refresh in body; cookie path also set
    expect(res.body.refreshToken || res.headers['set-cookie']).toBeTruthy();
  });

  it('professional login returns professional role', async () => {
    const phone = uniquePhone();
    await register(app, {
      phone,
      password,
      role: 'professional',
      displayName: 'Pro Login',
    });
    const res = await login(app, phone, password, 'professional');
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toContain('professional');
    expect(res.body.accessToken).toBeDefined();
  });

  it('refresh rotates token and invalidates previous', async () => {
    const reg = await register(app, { phone: uniquePhone(), password });
    expect(reg.status).toBe(201);
    const oldRefresh = reg.body.refreshToken as string;
    expect(oldRefresh).toBeDefined();
    const refreshed = await refresh(app, oldRefresh);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();
    if (refreshed.body.refreshToken) {
      expect(refreshed.body.refreshToken).not.toBe(oldRefresh);
    }
    expect((await refresh(app, oldRefresh)).status).toBe(401);
  });

  it('logout revokes refresh token', async () => {
    const reg = await register(app, { phone: uniquePhone(), password });
    expect(reg.status).toBe(201);
    expect((await logout(app, reg.body.refreshToken)).status).toBe(200);
    expect((await refresh(app, reg.body.refreshToken)).status).toBe(401);
  });

  it('GET /auth/me without token → 401', async () => {
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me')).status).toBe(401);
  });

  it('GET /auth/me with valid token → 200', async () => {
    const phone = uniquePhone();
    const reg = await register(app, {
      phone,
      password,
      displayName: 'Me User',
      role: 'customer',
    });
    expect(reg.status).toBe(201);
    const res = await me(app, reg.body.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe(phone);
    expect(res.body.roles).toEqual(['customer']);
    expect(res.body.professional).toBeNull();
  });
});
