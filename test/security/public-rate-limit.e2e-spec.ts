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
import { PrismaClient } from '@prisma/client';

/**
 * Asserts global / public throttles on scrape-prone endpoints (#17).
 * Uses real Throttler storage (enableThrottle: true).
 */
describe('Public endpoints rate-limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    assertTestDatabase();
    migrateTestDb();
    seedRoles();
    prisma = createPrisma();
    app = await createTestApp({ enableThrottle: true });
  });

  afterAll(async () => {
    await cleanupUserData(prisma);
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /professionals returns 200 and eventually 429 under burst', async () => {
    const server = app.getHttpServer();
    let sawOk = false;
    let saw429 = false;
    // public limit is 40/min; send more to force 429
    for (let i = 0; i < 55; i++) {
      const res = await request(server).get('/api/v1/professionals').query({ page: 1, limit: 5 });
      if (res.status === 200) sawOk = true;
      if (res.status === 429) {
        saw429 = true;
        expect(res.body?.statusCode).toBe(429);
        break;
      }
    }
    expect(sawOk).toBe(true);
    expect(saw429).toBe(true);
  });

  it('GET /health is not rate-limited (SkipThrottle)', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 15; i++) {
      const res = await request(server).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body?.status).toBeDefined();
    }
  });
});
