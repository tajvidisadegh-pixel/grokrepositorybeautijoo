import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';

function slugify(input: string): string {
  const base = input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return base || `category-${Date.now()}`;
}

@Injectable()
export class ServiceFiltersService {
  constructor(private readonly prisma: PrismaService, private readonly professionals: ProfessionalsService) {}

  async listAllowedCategories(serviceId: string) {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; slug: string; parentId: string | null; sortOrder: number }>>(Prisma.sql`
      SELECT c.id, c.name, c.slug, c.parent_id AS "parentId", scs.sort_order AS "sortOrder"
      FROM service_category_services scs JOIN service_categories c ON c.id = scs.category_id
      WHERE scs.service_id = ${serviceId}::uuid AND scs.is_active = true AND c.is_active = true
      ORDER BY scs.sort_order ASC, c.sort_order ASC, c.name ASC
    `);
  }

  async listMyCategories(userId: string, professionalServiceId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const own = await this.prisma.professionalService.findFirst({ where: { id: professionalServiceId, professionalId: pro.id }, select: { serviceId: true } });
    if (!own) throw new NotFoundException('خدمت زیباگر یافت نشد');
    return this.prisma.$queryRaw<Array<{ id: string; name: string; slug: string; parentId: string | null; allowed: boolean; status: string | null }>>(Prisma.sql`
      SELECT c.id, c.name, c.slug, c.parent_id AS "parentId", true AS allowed, psc.status::text AS status
      FROM service_category_services scs JOIN service_categories c ON c.id = scs.category_id
      LEFT JOIN professional_service_categories psc ON psc.category_id = c.id AND psc.professional_service_id = ${professionalServiceId}::uuid
      WHERE scs.service_id = ${own.serviceId}::uuid AND scs.is_active = true AND c.is_active = true
      ORDER BY scs.sort_order ASC, c.sort_order ASC, c.name ASC
    `);
  }

  async requestCategory(userId: string, professionalServiceId: string, categoryId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const own = await this.prisma.professionalService.findFirst({ where: { id: professionalServiceId, professionalId: pro.id }, select: { serviceId: true } });
    if (!own) throw new NotFoundException('خدمت زیباگر یافت نشد');
    const allowed = await this.prisma.$queryRaw<Array<{ ok: boolean }>>(Prisma.sql`SELECT EXISTS(SELECT 1 FROM service_category_services WHERE service_id = ${own.serviceId}::uuid AND category_id = ${categoryId}::uuid AND is_active = true) AS ok`);
    if (!allowed[0]?.ok) throw new BadRequestException('این دسته‌بندی برای این تخصص مجاز نیست');
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO professional_service_categories (professional_service_id, category_id, status) VALUES (${professionalServiceId}::uuid, ${categoryId}::uuid, 'pending')
      ON CONFLICT (professional_service_id, category_id) DO UPDATE SET
        status = CASE WHEN professional_service_categories.status = 'rejected' THEN 'pending' ELSE professional_service_categories.status END,
        reviewed_at = CASE WHEN professional_service_categories.status = 'rejected' THEN NULL ELSE professional_service_categories.reviewed_at END,
        reviewed_by = CASE WHEN professional_service_categories.status = 'rejected' THEN NULL ELSE professional_service_categories.reviewed_by END,
        updated_at = CURRENT_TIMESTAMP
    `);
    return this.listMyCategories(userId, professionalServiceId);
  }

  async removeMyCategory(userId: string, professionalServiceId: string, categoryId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const own = await this.prisma.professionalService.findFirst({ where: { id: professionalServiceId, professionalId: pro.id }, select: { id: true } });
    if (!own) throw new NotFoundException('خدمت زیباگر یافت نشد');
    await this.prisma.$executeRaw(Prisma.sql`DELETE FROM professional_service_categories WHERE professional_service_id = ${professionalServiceId}::uuid AND category_id = ${categoryId}::uuid AND status <> 'rejected'`);
    return this.listMyCategories(userId, professionalServiceId);
  }

  async createCategory(data: { name: string; parentId?: string | null; slug?: string; description?: string; icon?: string; sortOrder?: number; isActive?: boolean }) {
    const name = data.name.trim(); if (!name) throw new BadRequestException('نام دسته الزامی است');
    let slug = (data.slug?.trim() || slugify(name)).slice(0, 120);
    const existing = await this.prisma.serviceCategory.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`.slice(0, 120);
    if (data.parentId) { const parent = await this.prisma.serviceCategory.findUnique({ where: { id: data.parentId } }); if (!parent) throw new NotFoundException('دسته والد یافت نشد'); }
    return this.prisma.serviceCategory.create({ data: { name, slug, parentId: data.parentId ?? null, description: data.description?.trim() || null, icon: data.icon?.trim() || null, sortOrder: data.sortOrder ?? 0, isActive: data.isActive ?? true } });
  }

  async updateCategory(id: string, data: { name?: string; parentId?: string | null; slug?: string; description?: string; icon?: string; sortOrder?: number; isActive?: boolean }) {
    const existing = await this.prisma.serviceCategory.findUnique({ where: { id } }); if (!existing) throw new NotFoundException('دسته یافت نشد');
    if (data.parentId === id) throw new BadRequestException('دسته نمی‌تواند والد خودش باشد');
    if (data.parentId) { const parent = await this.prisma.serviceCategory.findUnique({ where: { id: data.parentId } }); if (!parent) throw new NotFoundException('دسته والد یافت نشد'); }
    return this.prisma.serviceCategory.update({ where: { id }, data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      ...(data.slug !== undefined ? { slug: data.slug.trim() } : {}), ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
      ...(data.icon !== undefined ? { icon: data.icon.trim() || null } : {}), ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}), ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    }});
  }

  async assignCategoryToService(serviceId: string, categoryId: string, sortOrder = 0) {
    const [service, category] = await Promise.all([this.prisma.service.findUnique({ where: { id: serviceId } }), this.prisma.serviceCategory.findUnique({ where: { id: categoryId } })]);
    if (!service) throw new NotFoundException('تخصص یافت نشد'); if (!category) throw new NotFoundException('دسته یافت نشد');
    await this.prisma.$executeRaw(Prisma.sql`INSERT INTO service_category_services (service_id, category_id, sort_order, is_active) VALUES (${serviceId}::uuid, ${categoryId}::uuid, ${sortOrder}, true) ON CONFLICT (service_id, category_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_active = true, updated_at = CURRENT_TIMESTAMP`);
    return this.listAllowedCategories(serviceId);
  }

  async unassignCategoryFromService(serviceId: string, categoryId: string) {
    await this.prisma.$executeRaw(Prisma.sql`UPDATE service_category_services SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE service_id = ${serviceId}::uuid AND category_id = ${categoryId}::uuid`);
    return this.listAllowedCategories(serviceId);
  }

  async listAdminCategories() {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; slug: string; parentId: string | null; isActive: boolean; sortOrder: number }>>(Prisma.sql`SELECT id, name, slug, parent_id AS "parentId", is_active AS "isActive", sort_order AS "sortOrder" FROM service_categories ORDER BY parent_id NULLS FIRST, sort_order ASC, name ASC`);
  }

  async listRequests(status?: 'pending' | 'approved' | 'rejected') {
    return this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT psc.professional_service_id AS "professionalServiceId", psc.category_id AS "categoryId", psc.status::text AS status,
             psc.created_at AS "createdAt", psc.reviewed_at AS "reviewedAt", c.name AS "categoryName", c.slug AS "categorySlug",
             s.id AS "serviceId", s.name AS "serviceName", p.id AS "professionalId", p.title AS "professionalTitle"
      FROM professional_service_categories psc JOIN service_categories c ON c.id = psc.category_id
      JOIN professional_services ps ON ps.id = psc.professional_service_id JOIN services s ON s.id = ps.service_id JOIN professionals p ON p.id = ps.professional_id
      ${status ? Prisma.sql`WHERE psc.status = ${status}::"ServiceCategoryAssignmentStatus"` : Prisma.empty}
      ORDER BY psc.created_at DESC
    `);
  }

  async reviewRequest(adminUserId: string, professionalServiceId: string, categoryId: string, status: 'approved' | 'rejected' | 'pending') {
    if (!['approved', 'rejected', 'pending'].includes(status)) throw new BadRequestException('وضعیت نامعتبر است');
    const result = await this.prisma.$executeRaw(Prisma.sql`UPDATE professional_service_categories SET status = ${status}::"ServiceCategoryAssignmentStatus", reviewed_at = CASE WHEN ${status}::text = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END, reviewed_by = CASE WHEN ${status}::text = 'pending' THEN NULL ELSE ${adminUserId}::uuid END, updated_at = CURRENT_TIMESTAMP WHERE professional_service_id = ${professionalServiceId}::uuid AND category_id = ${categoryId}::uuid`);
    if (!result) throw new NotFoundException('درخواست دسته‌بندی یافت نشد');
    return { professionalServiceId, categoryId, status };
  }

  async searchProfessionalsByFilter(params: { q?: string; city?: string; category?: string; page?: number; limit?: number }) {
    if (!params.category) return this.professionals.search(params);
    const matched = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT DISTINCT p.id FROM professionals p JOIN professional_services ps ON ps.professional_id = p.id AND ps.is_active = true JOIN professional_service_categories psc ON psc.professional_service_id = ps.id AND psc.status = 'approved' JOIN service_categories c ON c.id = psc.category_id AND c.is_active = true WHERE c.slug = ${params.category} AND p.status = 'approved' AND p.published_at IS NOT NULL`);
    const ids = matched.map((x) => x.id); const page = params.page || 1; const limit = Math.min(params.limit || 20, 50); const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = { id: { in: ids }, status: 'approved', publishedAt: { not: null } };
    if (params.q) where.OR = [{ title: { contains: params.q, mode: 'insensitive' } }, { bio: { contains: params.q, mode: 'insensitive' } }, { slug: { contains: params.q, mode: 'insensitive' } }];
    if (params.city) where.locations = { some: { location: { city: { contains: params.city, mode: 'insensitive' } } } };
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({ where, skip, take: limit, orderBy: [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }], include: { user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } }, locations: { include: { location: true }, where: { isPrimary: true }, take: 1 }, professionalServices: { where: { isActive: true }, take: 5, include: { service: { select: { name: true, slug: true } } } } } }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }
}
