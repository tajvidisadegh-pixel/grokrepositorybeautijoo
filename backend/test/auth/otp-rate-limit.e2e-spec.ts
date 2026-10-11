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
import { uniquePhone } from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';

describe('OTP rate-limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.OTP_COOLDOWN_SECONDS = '60';
    process.env.OTP_MAX_PER_HOUR = '3';
    process.env.OTP_MAX_PER_DAY = '8';
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

  async function requestOtp(phone: string) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'login', accountType: 'customer' });
  }

  it('first OTP request succeeds', async () => {
    const phone = uniquePhone();
    const res = await requestOtp(phone);
    expect(res.status).toBeLessThan(300);
    const count = await prisma.otpCode.count({ where: { phone } });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('second OTP within cooldown is rejected', async () => {
    const phone = uniquePhone();
    const first = await requestOtp(phone);
    expect(first.status).toBeLessThan(300);
    const second = await requestOtp(phone);
    expect(second.status).toBe(400);
    const msg = String(second.body?.message || '');
    expect(msg.includes('صبر') || msg.includes('ثانیه')).toBe(true);
  });

  it('hourly OTP cap is enforced', async () => {
    const phone = uniquePhone();
    const purpose = 'login:customer';
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await prisma.otpCode.create({
        data: {
          phone,
          purpose,
          codeHash: '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$dGVzdGhhc2g',
          expiresAt: new Date(now + 300_000),
          createdAt: new Date(now - 120_000 - i * 1000),
        },
      });
    }
    const res = await requestOtp(phone);
    expect(res.status).toBe(400);
    const msg = String(res.body?.message || '');
    expect(msg.includes('ساعت') || msg.includes('حد مجاز')).toBe(true);
  });
});
