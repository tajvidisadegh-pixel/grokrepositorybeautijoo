/**
 * E2E coverage for production bugs
 */
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

describe('Production bug fixes (e2e)', () => {
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
    await app.close();
    await prisma.$disconnect();
  });

  async function registerPro() {
    const phone = uniquePhone();
    const res = await register(app, {
      phone,
      password,
      displayName: 'تست باگ',
      role: 'professional',
    });
    expect(res.status).toBe(201);
    return {
      phone,
      token: res.body.accessToken as string,
      userId: res.body.user.id as string,
      roles: res.body.user.roles as string[],
    };
  }

  it('BUG3: professional registration has only professional role (no customer)', async () => {
    const { roles, token } = await registerPro();
    expect(roles).toContain('professional');
    expect(roles).not.toContain('customer');

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.roles).toContain('professional');
    expect(me.body.roles).not.toContain('customer');
  });

  it('BUG3: enable-customer-role adds customer independently', async () => {
    const { token } = await registerPro();
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/enable-customer-role')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 201]).toContain(res.status);
    expect(res.body.roles).toEqual(expect.arrayContaining(['professional', 'customer']));
  });

  it('BUG2: selectedCategoryIds persist and survive reload', async () => {
    const { token } = await registerPro();
    const cats = await request(app.getHttpServer()).get('/api/v1/categories');
    const list = Array.isArray(cats.body) ? cats.body : cats.body.items || [];
    const roots = list.filter((c: { parentId?: string | null }) => !c.parentId);
    const rootId = roots[0].id;

    const patch = await request(app.getHttpServer())
      .patch('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedCategoryIds: [rootId] });
    expect(patch.status).toBe(200);
    expect(patch.body.selectedCategoryIds).toEqual([rootId]);

    const me = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.selectedCategoryIds).toEqual([rootId]);
  });

  it('BUG5: professional can create category and service nodes', async () => {
    const { token } = await registerPro();
    const cats = await request(app.getHttpServer()).get('/api/v1/categories');
    const list = Array.isArray(cats.body) ? cats.body : cats.body.items || [];
    const roots = list.filter((c: { parentId?: string | null }) => !c.parentId);
    const parentId = roots[0].id;

    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `سفارشی-${Date.now()}`, parentId });
    expect([200, 201]).toContain(cat.status);
    expect(cat.body.id).toBeDefined();

    const svc = await request(app.getHttpServer())
      .post('/api/v1/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `خدمت-سفارشی-${Date.now()}`, categoryId: parentId });
    expect([200, 201]).toContain(svc.status);
    expect(svc.body.id).toBeDefined();
  });
});
