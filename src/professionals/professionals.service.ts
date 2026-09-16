import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalStatus, Prisma } from '@prisma/client';

export type CompletionFieldKey =
  | 'title'
  | 'firstName'
  | 'lastName'
  | 'avatarOrCover'
  | 'location'
  | 'service'
  | 'workingHours';

export type CompletionResult = {
  percent: number;
  complete: boolean;
  fields: Array<{ key: CompletionFieldKey; label: string; done: boolean }>;
};

const COMPLETION_LABELS: Record<CompletionFieldKey, string> = {
  title: '\u0639\u0646\u0648\u0627\u0646 \u062d\u0631\u0641\u0647\u200c\u0627\u06cc',
  firstName: '\u0646\u0627\u0645',
  lastName: '\u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc',
  avatarOrCover: '\u062a\u0635\u0648\u06cc\u0631 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u06cc\u0627 \u06a9\u0627\u0648\u0631',
  location: '\u0645\u0648\u0642\u0639\u06cc\u062a \u0645\u06a9\u0627\u0646\u06cc',
  service: '\u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u062a\u062e\u0635\u0635',
  workingHours: '\u0633\u0627\u0639\u0627\u062a \u06a9\u0627\u0631\u06cc',
};

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    q?: string; city?: string; category?: string; page?: number; limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = { status: ProfessionalStatus.approved, publishedAt: { not: null } };
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { slug: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.city) {
      where.locations = {
        some: { location: { city: { contains: params.city, mode: 'insensitive' } } },
      };
    }
    if (params.category) {
      where.professionalServices = {
        some: { service: { category: { slug: params.category } }, isActive: true },
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where, skip, take: limit,
        orderBy: [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }],
        include: {
          user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          locations: { include: { location: true }, where: { isPrimary: true }, take: 1 },
          professionalServices: {
            where: { isActive: true }, take: 5,
            include: { service: { select: { name: true, slug: true } } },
          },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async findBySlug(slug: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { slug },
      include: this.publicInclude(),
    });
    if (!pro || pro.status !== ProfessionalStatus.approved || !pro.publishedAt) {
      throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    }
    return pro;
  }

  async getOwn(userId: string) {
    const pro = await this.loadOwnFull(userId);
    return { ...pro, completion: this.computeCompletion(pro) };
  }

  async getOwnPreview(userId: string) {
    return this.loadOwnFull(userId);
  }

  async createForUser(userId: string, data: { slug: string; title: string; bio?: string }) {
    const existing = await this.prisma.professional.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u0642\u0628\u0644\u0627\u064b \u0627\u06cc\u062c\u0627\u062f \u0634\u062f\u0647 \u0627\u0633\u062a');
    const slugTaken = await this.prisma.professional.findUnique({ where: { slug: data.slug } });
    if (slugTaken) throw new ConflictException('\u0627\u06cc\u0646 \u0627\u0633\u0644\u0627\u06af \u0642\u0628\u0644\u0627\u064b \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0634\u062f\u0647 \u0627\u0633\u062a');
    const proRole = await this.prisma.role.findUnique({ where: { name: 'professional' } });
    if (proRole) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: proRole.id } },
        update: {},
        create: { userId, roleId: proRole.id },
      });
    }
    return this.prisma.professional.create({
      data: {
        userId, slug: data.slug, title: data.title, bio: data.bio,
        status: ProfessionalStatus.draft,
      },
    });
  }

  async updateOwn(userId: string, data: {
    title?: string; bio?: string; coverImageUrl?: string; logoUrl?: string;
    firstName?: string; lastName?: string; displayName?: string;
    avatarUrl?: string; profileBio?: string;
    selectedCategoryIds?: string[];
  }) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');

    const proData: Prisma.ProfessionalUpdateInput = {};
    if (data.title !== undefined) {
      const t = data.title.trim();
      if (t.length < 2) throw new BadRequestException('\u0639\u0646\u0648\u0627\u0646 \u0628\u0627\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 \u06f2 \u06a9\u0627\u0631\u0627\u06a9\u062a\u0631 \u0628\u0627\u0634\u062f');
      proData.title = t;
    }
    if (data.bio !== undefined) proData.bio = data.bio.trim() || null;
    if (data.coverImageUrl !== undefined) proData.coverImageUrl = data.coverImageUrl.trim() || null;
    if (data.selectedCategoryIds !== undefined) {
      proData.selectedCategoryIds = data.selectedCategoryIds as Prisma.InputJsonValue;
    }
    if (data.logoUrl !== undefined) proData.logoUrl = data.logoUrl.trim() || null;

    const profileData: Prisma.ProfileUpdateInput = {};
    if (data.firstName !== undefined) profileData.firstName = data.firstName.trim() || null;
    if (data.lastName !== undefined) profileData.lastName = data.lastName.trim() || null;
    if (data.displayName !== undefined && data.displayName.trim()) profileData.displayName = data.displayName.trim();
    if (data.avatarUrl !== undefined) profileData.avatarUrl = data.avatarUrl.trim() || null;
    if (data.profileBio !== undefined) profileData.bio = data.profileBio.trim() || null;

    if (Object.keys(proData).length) {
      await this.prisma.professional.update({ where: { id: pro.id }, data: proData });
    }
    if (Object.keys(profileData).length) {
      await this.prisma.profile.upsert({
        where: { userId },
        update: profileData,
        create: {
          userId,
          displayName: (data.displayName || data.firstName || 'User').trim(),
          firstName: data.firstName?.trim() || null,
          lastName: data.lastName?.trim() || null,
          avatarUrl: data.avatarUrl?.trim() || null,
          bio: data.profileBio?.trim() || null,
        },
      });
    }
    return this.getOwn(userId);
  }

  async publish(userId: string) {
    const pro = await this.loadOwnFull(userId);
    const completion = this.computeCompletion(pro);
    if (!completion.complete) {
      throw new BadRequestException({
        message: '\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0646\u0627\u0642\u0635 \u0627\u0633\u062a',
        completion,
      });
    }
    // Submit for admin review — never auto-approve / auto-publish
    const updated = await this.prisma.professional.update({
      where: { id: pro.id },
      data: {
        status: ProfessionalStatus.pending_review,
        publishedAt: null,
      },
    });
    // Notify professional that profile is awaiting review
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'system',
          title: '\u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631 \u0628\u0631\u0631\u0633\u06cc',
          body: '\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631\u06cc \u0634\u0645\u0627 \u0628\u0631\u0627\u06cc \u0628\u0631\u0631\u0633\u06cc \u0627\u0631\u0633\u0627\u0644 \u0634\u062f. \u067e\u0633 \u0627\u0632 \u062a\u0623\u06cc\u06cc\u062f \u0645\u062f\u06cc\u0631 \u062f\u0631 \u0633\u0627\u06cc\u062a \u0645\u0646\u062a\u0634\u0631 \u0645\u06cc\u200c\u0634\u0648\u062f.',
          data: { professionalId: pro.id, status: 'pending_review' },
        },
      });
    } catch {
      /* non-blocking */
    }
    return { ...updated, completion };
  }

  async unpublish(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException();
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { status: ProfessionalStatus.draft, publishedAt: null },
    });
    return this.getOwn(userId);
  }

  async requireOwnProfessional(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    return pro;
  }

  computeCompletion(pro: {
    title?: string | null; bio?: string | null; coverImageUrl?: string | null;
    selectedCategoryIds?: unknown;
    user?: { profile?: {
      firstName?: string | null; lastName?: string | null;
      avatarUrl?: string | null; bio?: string | null;
    } | null } | null;
    locations?: unknown[];
    professionalServices?: { isActive?: boolean | null }[];
    workingHours?: { isActive?: boolean | null }[];
  }) {
    const profile = pro.user?.profile;
    const hasTitle = !!(pro.title && pro.title.trim().length >= 2);
    const hasFirst = !!(profile?.firstName && profile.firstName.trim());
    const hasLast = !!(profile?.lastName && profile.lastName.trim());
    const hasImage = !!(
      (pro.coverImageUrl && pro.coverImageUrl.trim()) ||
      ((pro as { logoUrl?: string | null }).logoUrl && String((pro as { logoUrl?: string | null }).logoUrl).trim()) ||
      (profile?.avatarUrl && profile.avatarUrl.trim())
    );
    const hasLocation = Array.isArray(pro.locations) && pro.locations.length > 0;
    const selectedCats = Array.isArray(pro.selectedCategoryIds)
      ? (pro.selectedCategoryIds as unknown[]).filter((x) => typeof x === 'string' && String(x).length > 0)
      : [];
    const hasService =
      selectedCats.length > 0 ||
      (Array.isArray(pro.professionalServices) &&
        pro.professionalServices.some((s) => s.isActive !== false));
    const hasHours =
      Array.isArray(pro.workingHours) &&
      pro.workingHours.some((h) => h.isActive !== false);

    const fields: CompletionResult['fields'] = [
      { key: 'title', label: COMPLETION_LABELS.title, done: hasTitle },
      { key: 'firstName', label: COMPLETION_LABELS.firstName, done: hasFirst },
      { key: 'lastName', label: COMPLETION_LABELS.lastName, done: hasLast },
      { key: 'avatarOrCover', label: COMPLETION_LABELS.avatarOrCover, done: hasImage },
      { key: 'location', label: COMPLETION_LABELS.location, done: hasLocation },
      { key: 'service', label: COMPLETION_LABELS.service, done: hasService },
      { key: 'workingHours', label: COMPLETION_LABELS.workingHours, done: hasHours },
    ];
    const required = fields;
    const doneCount = required.filter((f) => f.done).length;
    const percent = Math.round((doneCount / required.length) * 100);
    return { percent, complete: percent === 100, fields };
  }

  private publicInclude() {
    return {
      user: {
        select: {
          profile: {
            select: {
              displayName: true, firstName: true, lastName: true, avatarUrl: true,
            },
          },
        },
      },
      locations: { include: { location: true } },
      professionalServices: {
        where: { isActive: true },
        include: {
          service: { include: { category: true } },
          mediaAssets: { orderBy: { sortOrder: 'asc' as const } },
          addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
          priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
          durationRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },
      workingHours: { where: { isActive: true }, include: { breaks: true } },
      reviews: {
        where: { isPublished: true }, take: 10, orderBy: { createdAt: 'desc' as const },
        include: { customer: { select: { profile: { select: { displayName: true } } } } },
      },
    };
  }

  private async loadOwnFull(userId: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { userId },
      include: {
        user: { select: { phone: true, profile: true } },
        locations: { include: { location: true } },
        professionalServices: { include: { service: { include: { category: true } } } },
        workingHours: { include: { breaks: true } },
      },
    });
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    return pro;
  }
}
