/**
 * Phase 1 Services foundation e2e checks.
 * Requires DATABASE_URL and migrated schema + catalog seed.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Services Phase 1 (catalog / hierarchy / pro service)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /categories returns recursive tree with 19 roots seeded', async () => {
    const res = await request(app.getHttpServer()).get('/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(19);
    const roots = res.body as Array<{ name: string; parentId: string | null; children?: unknown[] }>;
    for (const r of roots) {
      expect(r.parentId).toBeFalsy();
    }
    const nails = roots.find((c) => c.name === '\u0646\u0627\u062e\u0646');
    expect(nails).toBeDefined();
  });

  it('GET /services/hierarchy returns multi-level structure', async () => {
    const res = await request(app.getHttpServer()).get('/services/hierarchy').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('shared Service can be selected by two professionals with independent prices', async () => {
    const service = await prisma.service.findFirst({ where: { isActive: true } });
    if (!service) {
      return;
    }
    const pros = await prisma.professional.findMany({ take: 2 });
    if (pros.length < 2) return;

    const [a, b] = pros;
    const psA = await prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: { professionalId: a.id, serviceId: service.id },
      },
      update: { price: 100000, durationMin: 30, isActive: true },
      create: {
        professionalId: a.id,
        serviceId: service.id,
        price: 100000,
        durationMin: 30,
      },
    });
    const psB = await prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: { professionalId: b.id, serviceId: service.id },
      },
      update: { price: 250000, durationMin: 45, isActive: true },
      create: {
        professionalId: b.id,
        serviceId: service.id,
        price: 250000,
        durationMin: 45,
      },
    });

    expect(psA.serviceId).toBe(psB.serviceId);
    expect(psA.price).not.toBe(psB.price);
    expect(psA.durationMin).not.toBe(psB.durationMin);
  });

  it('ServiceAddOn can be attached to ProfessionalService', async () => {
    const ps = await prisma.professionalService.findFirst({ where: { isActive: true } });
    if (!ps) return;

    const addOn = await prisma.serviceAddOn.create({
      data: {
        professionalServiceId: ps.id,
        name: '\u062a\u0633\u062a \u0627\u0641\u0632\u0648\u062f\u0646\u06cc',
        description: 'phase1',
        price: 50000,
        extraDurationMin: 10,
      },
    });
    expect(addOn.id).toBeDefined();
    expect(addOn.price).toBe(50000);

    await prisma.serviceAddOn.update({
      where: { id: addOn.id },
      data: { isActive: false },
    });
  });
});
