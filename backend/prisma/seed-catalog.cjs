/**
 * Production-safe catalog seed (categories + optional sample hierarchy).
 * Idempotent: creates missing rows only — never overwrites admin edits or reactivates soft-deletes.
 * Safe to run on every deploy/start (issue #26).
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** 19 root categories — hard-coded seed only; structure remains dynamic */
const ROOT_CATEGORIES = [
  { name: 'کوتاهی', slug: 'cut', sortOrder: 1 },
  { name: 'رنگ و لایت', slug: 'color-light', sortOrder: 2 },
  { name: 'کراتین، فر و احیا', slug: 'keratin-perm-restore', sortOrder: 3 },
  { name: 'ناخن', slug: 'nails', sortOrder: 4 },
  { name: 'مژه', slug: 'lashes', sortOrder: 5 },
  { name: 'ابرو', slug: 'brows', sortOrder: 6 },
  { name: 'پوست و فیشیال', slug: 'skin-facial', sortOrder: 7 },
  { name: 'میکاپ و گریم', slug: 'makeup-grooming', sortOrder: 8 },
  { name: 'اصلاح', slug: 'shaping', sortOrder: 9 },
  { name: 'اپیلاسیون', slug: 'epilation', sortOrder: 10 },
  { name: 'ماساژ', slug: 'massage', sortOrder: 11 },
  { name: 'اسپا', slug: 'spa', sortOrder: 12 },
  { name: 'آرایش دائم', slug: 'permanent-makeup', sortOrder: 13 },
  { name: 'تتو', slug: 'tattoo', sortOrder: 14 },
  { name: 'اکستنشن و بافت', slug: 'extension-braid', sortOrder: 15 },
  { name: 'خدمات آقایان', slug: 'mens-services', sortOrder: 16 },
  { name: 'خدمات کودک', slug: 'kids-services', sortOrder: 17 },
  { name: 'خدمات عروس', slug: 'bridal-services', sortOrder: 18 },
  { name: 'خدمات داماد', slug: 'groom-services', sortOrder: 19 },
];

const SAMPLE_HIERARCHY = [
  {
    parentSlug: 'nails',
    name: 'کاشت',
    slug: 'nails-extension',
    sortOrder: 1,
    children: [
      {
        name: 'کاشت با ژل',
        slug: 'nails-gel-extension',
        sortOrder: 1,
        services: [
          { name: 'کاشت ژل بلند', slug: 'nails-gel-long' },
          { name: 'کاشت ژل کوتاه', slug: 'nails-gel-short' },
        ],
      },
    ],
  },
];

/** Create-only upsert: never clobber admin name/isActive/parent changes (#26). */
async function ensureCategory({ name, slug, sortOrder, parentId }) {
  return prisma.serviceCategory.upsert({
    where: { slug },
    update: {},
    create: {
      name,
      slug,
      sortOrder,
      isActive: true,
      parentId: parentId || null,
    },
  });
}

async function ensureService({ name, slug, categoryId }) {
  return prisma.service.upsert({
    where: { slug },
    update: {},
    create: { name, slug, categoryId, isActive: true },
  });
}

async function seedSampleBranch(node, parentId) {
  const row = await ensureCategory({
    name: node.name,
    slug: node.slug,
    sortOrder: node.sortOrder ?? 0,
    parentId,
  });
  let serviceCount = 0;
  for (const s of node.services || []) {
    await ensureService({ ...s, categoryId: row.id });
    serviceCount++;
  }
  for (const child of node.children || []) {
    serviceCount += await seedSampleBranch(child, row.id);
  }
  return serviceCount;
}

async function main() {
  let serviceCount = 0;

  for (const cat of ROOT_CATEGORIES) {
    await ensureCategory({
      name: cat.name,
      slug: cat.slug,
      sortOrder: cat.sortOrder,
    });
  }

  for (const branch of SAMPLE_HIERARCHY) {
    const parent = await prisma.serviceCategory.findUnique({
      where: { slug: branch.parentSlug },
    });
    if (!parent) {
      console.warn(`Parent category ${branch.parentSlug} not found, skip sample`);
      continue;
    }
    serviceCount += await seedSampleBranch(branch, parent.id);
  }

  console.log(
    `Catalog seed OK — ${ROOT_CATEGORIES.length} root categories ensured (no overwrite), ${serviceCount} sample services ensured`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
