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

/**
 * Smoke path: public list + published pro detail (#12).
 */
describe('Public professionals smoke (e2e)', () => {
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

  it('lists empty professionals then shows approved published pro', async () => {
    const listEmpty = await request(app.getHttpServer()).get('/api/v1/professionals');
    expect(listEmpty.status).toBe(200);
    expect(Array.isArray(listEmpty.body?.items)).toBe(true);

    const phone = uniquePhone();
    const slug = `smoke-pro-${Date.now()}`;
    const reg = await register(app, {
      phone,
      password,
      displayName: 'Smoke Pro',
      role: 'professional',
    });
    expect([200, 201]).toContain(reg.status);

    const pro = await prisma.professional.findFirst({
      where: { user: { phone, accountType: 'professional' } },
    });
    expect(pro).toBeTruthy();

    await prisma.professional.update({
      where: { id: pro!.id },
      data: {
        status: ProfessionalStatus.approved,
        publishedAt: new Date(),
        slug,
        title: 'Smoke Title',
      },
    });

    const list = await request(app.getHttpServer()).get('/api/v1/professionals');
    expect(list.status).toBe(200);
    const items = list.body?.items || [];
    expect(items.some((p: { slug?: string }) => p.slug === slug)).toBe(true);

    const detail = await request(app.getHttpServer()).get(`/api/v1/professionals/${slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body?.slug).toBe(slug);
  });

  it('health endpoint responds ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(['ok', 'degraded']).toContain(res.body?.status);
  });
});
