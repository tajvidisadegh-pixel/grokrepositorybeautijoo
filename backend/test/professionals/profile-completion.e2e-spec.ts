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

describe('Profile completion & publish (e2e)', () => {
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

  async function registerPro() {
    const phone = uniquePhone();
    const res = await register(app, {
      phone,
      password,
      displayName: 'تست تکمیل',
      role: 'professional',
    });
    expect(res.status).toBe(201);
    return { phone, token: res.body.accessToken as string, userId: res.body.user.id as string };
  }

  it('1. Draft cannot be publicly accessed by slug', async () => {
    const { token } = await registerPro();
    const me = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.status).toBe('draft');
    const slug = me.body.slug;
    const pub = await request(app.getHttpServer()).get(`/api/v1/professionals/${slug}`);
    expect(pub.status).toBe(404);
  });

  it('2. Draft cannot appear in search', async () => {
    const { token } = await registerPro();
    const me = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${token}`);
    const title = me.body.title;
    const search = await request(app.getHttpServer()).get(`/api/v1/professionals?q=${encodeURIComponent(title)}`);
    expect(search.status).toBe(200);
    const items = search.body.items || search.body;
    const found = Array.isArray(items) && items.some((i: { slug?: string }) => i.slug === me.body.slug);
    expect(found).toBe(false);
  });

  it('3. Incomplete profile cannot publish', async () => {
    const { token } = await registerPro();
    const res = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/publish')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('4. Completion is calculated server-side', async () => {
    const { token } = await registerPro();
    const me = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.body.completion).toBeDefined();
    expect(typeof me.body.completion.percent).toBe('number');
    expect(Array.isArray(me.body.completion.fields)).toBe(true);
    expect(me.body.completion.fields.length).toBe(8);
  });

  it('5. Completion changes after saving required data', async () => {
    const { token } = await registerPro();
    const before = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/completion')
      .set('Authorization', `Bearer ${token}`);
    const pctBefore = before.body.percent;

    await request(app.getHttpServer())
      .patch('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'میکاپ حرفه‌ای',
        firstName: 'مریم',
        lastName: 'تستی',
        bio: 'بیوگرافی کامل برای تست تکمیل پروفایل زیباگر',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

    const after = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/completion')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.percent).toBeGreaterThan(pctBefore);
  });

  it('6-9. Complete profile can publish, is public, can unpublish, then hidden', async () => {
    const { token, userId } = await registerPro();

    const pro = await prisma.professional.findUnique({ where: { userId } });
    expect(pro).not.toBeNull();

    let service = await prisma.service.findFirst();
    if (!service) {
      const cat = await prisma.serviceCategory.create({
        data: { name: 'آرایشی', slug: `cat-${Date.now()}`, isActive: true },
      });
      service = await prisma.service.create({
        data: { name: 'میکاپ', slug: `svc-${Date.now()}`, categoryId: cat.id, isActive: true },
      });
    }
    const loc = await prisma.location.create({
      data: { name: 'سالن تست', address: 'خیابان تست ۱۲۳', city: 'تهران', isActive: true },
    });
    await prisma.professionalLocation.create({
      data: { professionalId: pro!.id, locationId: loc.id, isPrimary: true },
    });
    await prisma.professionalService.create({
      data: {
        professionalId: pro!.id,
        serviceId: service.id,
        durationMin: 60,
        price: 500000,
        isActive: true,
      },
    });
    await prisma.workingHour.create({
      data: {
        professionalId: pro!.id,
        dayOfWeek: 'saturday',
        startTime: '10:00',
        endTime: '18:00',
        isActive: true,
      },
    });
    await prisma.professional.update({
      where: { id: pro!.id },
      data: {
        title: 'میکاپ آرتیست تست',
        bio: 'بیوگرافی کامل برای رسیدن به صد درصد تکمیل پروفایل',
        coverImageUrl: 'https://example.com/cover.jpg',
      },
    });
    await prisma.profile.update({
      where: { userId },
      data: { firstName: 'مریم', lastName: 'تستی', avatarUrl: 'https://example.com/a.jpg' },
    });

    const completion = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/completion')
      .set('Authorization', `Bearer ${token}`);
    expect(completion.body.complete).toBe(true);
    expect(completion.body.percent).toBe(100);

    const pub = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/publish')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 201]).toContain(pub.status);
    expect(pub.body.status).toBe('approved');
    expect(pub.body.publishedAt).toBeTruthy();

    const slug = pub.body.slug;
    const publicView = await request(app.getHttpServer()).get(`/api/v1/professionals/${slug}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.slug).toBe(slug);

    const unpub = await request(app.getHttpServer())
      .post('/api/v1/professionals/me/unpublish')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 201]).toContain(unpub.status);
    expect(unpub.body.status).toBe('draft');

    const hidden = await request(app.getHttpServer()).get(`/api/v1/professionals/${slug}`);
    expect(hidden.status).toBe(404);
  });

  it('10. Owner can preview own draft', async () => {
    const { token } = await registerPro();
    const res = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/preview')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
  });

  it('11. Owner cannot preview another owner draft (auth still returns own)', async () => {
    const a = await registerPro();
    const b = await registerPro();
    const res = await request(app.getHttpServer())
      .get('/api/v1/professionals/me/preview')
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(200);
    const aMe = await request(app.getHttpServer())
      .get('/api/v1/professionals/me')
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.body.slug).not.toBe(aMe.body.slug);
  });
});
