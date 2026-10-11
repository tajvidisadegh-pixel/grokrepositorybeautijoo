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
import {
  cookieHeader,
  cookieValue,
  login,
  logoutWithCookie,
  me,
  refresh,
  refreshWithCookie,
  register,
  uniquePhone,
} from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';

const REFRESH_COOKIE = 'bj_refresh';

describe('Auth httpOnly cookie path (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const password = 'SecurePass1';

  beforeAll(async () => {
    assertTestDatabase();
    migrateTestDb();
    seedRoles();
    prisma = createPrisma();
    process.env.REFRESH_ALLOW_BODY = 'true';
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

  it('login sets bj_refresh httpOnly cookie', async () => {
    const phone = uniquePhone();
    await register(app, { phone, password, role: 'customer' });
    const res = await login(app, phone, password, 'customer');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    const raw = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(raw).toMatch(/bj_refresh=/);
    expect(raw.toLowerCase()).toMatch(/httponly/);
    const token = cookieValue(setCookie, REFRESH_COOKIE);
    expect(token).toBeTruthy();
  });

  it('refresh with Cookie header only (empty body) returns new accessToken', async () => {
    const reg = await register(app, { phone: uniquePhone(), password });
    expect(reg.status).toBe(201);
    const cookie = cookieHeader(reg.headers['set-cookie'], REFRESH_COOKIE);
    expect(cookie).toBeTruthy();

    const refreshed = await refreshWithCookie(app, cookie!);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();
    const newCookie = cookieValue(refreshed.headers['set-cookie'], REFRESH_COOKIE);
    expect(newCookie).toBeTruthy();
    expect(newCookie).not.toBe(cookieValue(reg.headers['set-cookie'], REFRESH_COOKIE));
  });

  it('refresh with cookie works for /auth/me after access is lost', async () => {
    const reg = await register(app, { phone: uniquePhone(), password });
    const cookie = cookieHeader(reg.headers['set-cookie'], REFRESH_COOKIE)!;
    const refreshed = await refreshWithCookie(app, cookie);
    expect(refreshed.status).toBe(200);
    const meRes = await me(app, refreshed.body.accessToken);
    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBeDefined();
  });

  it('logout with cookie revokes token and clears cookie', async () => {
    const reg = await register(app, { phone: uniquePhone(), password });
    const cookie = cookieHeader(reg.headers['set-cookie'], REFRESH_COOKIE)!;
    const out = await logoutWithCookie(app, cookie);
    expect(out.status).toBe(200);
    const cleared = Array.isArray(out.headers['set-cookie'])
      ? out.headers['set-cookie'].join(';')
      : String(out.headers['set-cookie'] || '');
    expect(cleared.toLowerCase()).toMatch(/bj_refresh=/);
    expect(cleared.toLowerCase()).toMatch(/max-age=0/);

    expect((await refreshWithCookie(app, cookie)).status).toBe(401);
  });

  it('refresh without cookie and without body → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({});
    expect(res.status).toBe(401);
  });

  it('when REFRESH_ALLOW_BODY=false, body-only refresh is rejected', async () => {
    const reg = await register(app, { phone: uniquePhone(), password });
    const bodyToken = reg.body.refreshToken as string | undefined;
    const token =
      bodyToken || cookieValue(reg.headers['set-cookie'], REFRESH_COOKIE);
    expect(token).toBeTruthy();

    const prev = process.env.REFRESH_ALLOW_BODY;
    process.env.REFRESH_ALLOW_BODY = 'false';
    try {
      const res = await refresh(app, token!);
      expect(res.status).toBe(401);
    } finally {
      process.env.REFRESH_ALLOW_BODY = prev;
    }
  });
});
