/**
 * Beautijoo Development Seed
 * Credentials (DEV ONLY — change in production):
 *   Admin:        09120000000 / Admin@12345
 *   زیباگر:       09121111111 / Zibagar@123
 *   Customer:     09123333333 / Customer@123
 *
 * SUPER_ADMIN is upserted as a system role only — not assigned to any user here.
 */
import { PrismaClient, DayOfWeek, ProfessionalStatus, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Beautijoo seed starting...');

  const roles = [
    { name: 'customer', displayName: 'مشتری', isSystem: true },
    { name: 'professional', displayName: 'زیباگر', isSystem: true },
    { name: 'staff', displayName: 'کارمند', isSystem: true },
    { name: 'admin', displayName: 'مدیر', isSystem: true },
    {
      name: 'SUPER_ADMIN',
      displayName: 'سوپر ادمین',
      description: 'نقش سیستمی سطح بالای پلتفرم؛ بدون انتساب خودکار به کاربر',
      isSystem: true,
    },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
  }

  const permCodes = [
    'user:read', 'user:update', 'professional:read', 'professional:update', 'professional:manage',
    'booking:create', 'booking:read', 'booking:update', 'booking:manage',
    'review:create', 'review:read', 'review:manage', 'admin:access', 'audit:read', 'settings:manage',
  ];
  for (const code of permCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, displayName: code },
    });
  }
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  for (const p of await prisma.permission.findMany()) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  const adminHash = await argon2.hash('Admin@12345');
  const admin = await prisma.user.upsert({
    where: { phone: '09120000000' },
    update: {},
    create: {
      phone: '09120000000',
      email: 'admin@beautijoo.local',
      passwordHash: adminHash,
      status: UserStatus.active,
      phoneVerified: true,
      emailVerified: true,
      profile: { create: { displayName: 'مدیر سیستم', firstName: 'مدیر', lastName: 'سیستم' } },
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const cats = [
    { name: 'مو', slug: 'hair', sortOrder: 1 },
    { name: 'ناخن', slug: 'nails', sortOrder: 2 },
    { name: 'پوست', slug: 'skin', sortOrder: 3 },
    { name: 'آرایش', slug: 'makeup', sortOrder: 4 },
  ];
  const catIds: Record<string, string> = {};
  for (const c of cats) {
    const row = await prisma.serviceCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, isActive: true },
    });
    catIds[c.slug] = row.id;
  }

  const servicesData = [
    { categorySlug: 'hair', name: 'کوتاهی مو', slug: 'haircut', duration: 45, price: 350000 },
    { categorySlug: 'hair', name: 'رنگ مو', slug: 'hair-color', duration: 120, price: 1200000 },
    { categorySlug: 'nails', name: 'مانیکور', slug: 'manicure', duration: 40, price: 280000 },
    { categorySlug: 'nails', name: 'پدیکور', slug: 'pedicure', duration: 50, price: 320000 },
    { categorySlug: 'skin', name: 'پاکسازی پوست', slug: 'facial', duration: 60, price: 450000 },
    { categorySlug: 'makeup', name: 'آرایش عروس', slug: 'bridal-makeup', duration: 90, price: 2500000 },
  ];
  const serviceIds: Record<string, string> = {};
  for (const s of servicesData) {
    const row = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        categoryId: catIds[s.categorySlug],
        name: s.name,
        slug: s.slug,
        isActive: true,
      },
    });
    serviceIds[s.slug] = row.id;
  }

  const proHash = await argon2.hash('Zibagar@123');
  const proUser = await prisma.user.upsert({
    where: { phone: '09121111111' },
    update: {},
    create: {
      phone: '09121111111',
      email: 'zibagar@beautijoo.local',
      passwordHash: proHash,
      status: UserStatus.active,
      phoneVerified: true,
      profile: {
        create: { displayName: 'سارا محمدی', firstName: 'سارا', lastName: 'محمدی', gender: 'female' },
      },
    },
  });
  const proRole = await prisma.role.findUniqueOrThrow({ where: { name: 'professional' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: proUser.id, roleId: proRole.id } },
    update: {},
    create: { userId: proUser.id, roleId: proRole.id },
  });
  const professional = await prisma.professional.upsert({
    where: { userId: proUser.id },
    update: { status: ProfessionalStatus.approved },
    create: {
      userId: proUser.id,
      slug: 'sara-mohammadi',
      title: 'زیباگر تخصصی مو و ناخن',
      bio: 'با بیش از ۸ سال تجربه در حوزه زیبایی.',
      status: ProfessionalStatus.approved,
      ratingAvg: 4.8,
      ratingCount: 0,
      isFeatured: true,
      verifiedAt: new Date(),
    },
  });

  let location = await prisma.location.findFirst({
    where: { name: 'سالن زیبایی سارا', city: 'تهران' },
  });
  if (!location) {
    location = await prisma.location.create({
      data: {
        name: 'سالن زیبایی سارا',
        address: 'تهران، ولیعصر، خیابان فرشته',
        city: 'تهران',
        province: 'تهران',
        isActive: true,
      },
    });
  }
  await prisma.professionalLocation.upsert({
    where: {
      professionalId_locationId: { professionalId: professional.id, locationId: location.id },
    },
    update: {},
    create: { professionalId: professional.id, locationId: location.id, isPrimary: true },
  });

  for (const s of servicesData.slice(0, 4)) {
    await prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: {
          professionalId: professional.id,
          serviceId: serviceIds[s.slug],
        },
      },
      update: { durationMin: s.duration, price: s.price, isActive: true },
      create: {
        professionalId: professional.id,
        serviceId: serviceIds[s.slug],
        durationMin: s.duration,
        bufferMin: 10,
        price: s.price,
        isActive: true,
      },
    });
  }

  const days: DayOfWeek[] = [
    DayOfWeek.saturday, DayOfWeek.sunday, DayOfWeek.monday,
    DayOfWeek.tuesday, DayOfWeek.wednesday, DayOfWeek.thursday,
  ];
  for (const day of days) {
    const existing = await prisma.workingHour.findFirst({
      where: { professionalId: professional.id, dayOfWeek: day, startTime: '10:00' },
    });
    if (!existing) {
      await prisma.workingHour.create({
        data: {
          professionalId: professional.id,
          dayOfWeek: day,
          startTime: '10:00',
          endTime: '20:00',
          isActive: true,
          breaks: { create: [{ startTime: '13:00', endTime: '14:00' }] },
        },
      });
    }
  }

  const custHash = await argon2.hash('Customer@123');
  const customer = await prisma.user.upsert({
    where: { phone: '09123333333' },
    update: {},
    create: {
      phone: '09123333333',
      passwordHash: custHash,
      status: UserStatus.active,
      phoneVerified: true,
      profile: {
        create: { displayName: 'مریم رضایی', firstName: 'مریم', lastName: 'رضایی' },
      },
    },
  });
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'customer' } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: customer.id, roleId: customerRole.id } },
    update: {},
    create: { userId: customer.id, roleId: customerRole.id },
  });

  await prisma.platformSetting.upsert({
    where: { key: 'booking.pending_ttl_minutes' },
    update: {},
    create: { key: 'booking.pending_ttl_minutes', value: 30 },
  });

  console.log('✅ Seed complete');
  console.log('  Admin:     09120000000 / Admin@12345');
  console.log('  زیباگر:    09121111111 / Zibagar@123');
  console.log('  Customer:  09123333333 / Customer@123');
  console.log('  Professional slug: sara-mohammadi');
  console.log('  SUPER_ADMIN role: seeded (not assigned to any user)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
