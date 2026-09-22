import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../cache/app-cache.service';
import { ProfessionalStatus, Prisma } from '@prisma/client';
import { boundingBox, haversineKm, parseGeoQuery } from '../common/geo';

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
  // restored: getEarnings + requestPayout (#8) — CI green
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  async search(params: {
    q?: string;
    city?: string;
    category?: string;
    page?: number;
    limit?: number;
    minRating?: number;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    availableDate?: string;
    ids?: string[];
    lat?: string | number;
    lng?: string | number;
    radiusKm?: string | number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const skip = (page - 1) * limit;

    const cacheKey =
      !params.ids || params.ids.length === 0
        ? `catalog:search:${JSON.stringify({
            q: params.q || '',
            city: params.city || '',
            category: params.category || '',
            page,
            limit,
            minRating: params.minRating ?? null,
            minPrice: params.minPrice ?? null,
            maxPrice: params.maxPrice ?? null,
            sort: params.sort || '',
            availableDate: params.availableDate || '',
            lat: params.lat ?? '',
            lng: params.lng ?? '',
            radiusKm: params.radiusKm ?? '',
          })}`
        : null;
    if (cacheKey) {
      const hit = this.cache.get<{ items: unknown; meta: unknown }>(cacheKey);
      if (hit) return hit as any;
    }
    const where: Prisma.ProfessionalWhereInput = {
      status: ProfessionalStatus.approved,
      publishedAt: { not: null },
    };

    if (params.ids && params.ids.length > 0) {
      where.id = { in: params.ids };
    }

    if (params.q) {
      const q = params.q.trim();
      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { bio: { contains: q, mode: 'insensitive' } },
          {
            professionalServices: {
              some: {
                isActive: true,
                OR: [
                  { description: { contains: q, mode: 'insensitive' } },
                  { service: { name: { contains: q, mode: 'insensitive' } } },
                ],
              },
            },
          },
        ];
      }
    }

    if (params.city) {
      where.locations = {
        some: { location: { city: { contains: params.city, mode: 'insensitive' } } },
      };
    }

    const geo = parseGeoQuery({
      lat: params.lat as any,
      lng: params.lng as any,
      radiusKm: params.radiusKm as any,
    });
    if (geo) {
      const box = boundingBox(geo.lat, geo.lng, geo.radiusKm);
      const locFilter: Prisma.LocationWhereInput = {
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      };
      if (where.locations && typeof where.locations === 'object' && 'some' in where.locations) {
        const prev = (where.locations as any).some || {};
        where.locations = {
          some: {
            ...prev,
            location: { ...(prev.location || {}), ...locFilter },
          },
        };
      } else {
        where.locations = { some: { location: locFilter } };
      }
    }

    // Price + category filter on professionalServices
    const priceFilter: { gte?: number; lte?: number } = {};
    if (params.minPrice != null && Number.isFinite(params.minPrice)) priceFilter.gte = params.minPrice;
    if (params.maxPrice != null && Number.isFinite(params.maxPrice)) priceFilter.lte = params.maxPrice;
    const hasPrice = Object.keys(priceFilter).length > 0;
    if (params.category || hasPrice) {
      const svcSome: Prisma.ProfessionalServiceWhereInput = { isActive: true };
      if (params.category) {
        svcSome.service = { category: { slug: params.category } };
      }
      if (hasPrice) {
        svcSome.price = priceFilter;
      }
      where.professionalServices = { some: svcSome };
    }

    if (params.minRating != null && Number.isFinite(params.minRating)) {
      where.ratingAvg = { gte: params.minRating };
    }

    // Soft availability: has working hour for that weekday (Tehran) and not fully time-off
    if (params.availableDate) {
      const d = new Date(params.availableDate + 'T12:00:00+03:30');
      if (!Number.isNaN(d.getTime())) {
        // JS getUTCDay: 0=Sun..6=Sat. Map to Prisma DayOfWeek (saturday-first)
        const utcDay = d.getUTCDay(); // using noon Tehran already in ISO with offset
        // Recompute with explicit Tehran offset
        const tehran = new Date(d.getTime());
        const dayIdx = tehran.getUTCDay(); // 0 Sun .. 6 Sat
        const map: Record<number, string> = {
          0: 'sunday',
          1: 'monday',
          2: 'tuesday',
          3: 'wednesday',
          4: 'thursday',
          5: 'friday',
          6: 'saturday',
        };
        const dayOfWeek = map[dayIdx] as any;
        const dayStart = new Date(params.availableDate + 'T00:00:00+03:30');
        const dayEnd = new Date(params.availableDate + 'T23:59:59+03:30');
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            workingHours: {
              some: {
                dayOfWeek,
                isActive: true,
                isClosed: false,
              },
            },
          },
          {
            NOT: {
              timeOffs: {
                some: {
                  startAt: { lte: dayEnd },
                  endAt: { gte: dayStart },
                },
              },
            },
          },
        ];
      }
    }

    let orderBy: Prisma.ProfessionalOrderByWithRelationInput[] = [
      { isFeatured: 'desc' },
      { ratingAvg: 'desc' },
    ];
    const sort = params.sort || 'rating';
    if (sort === 'rating_asc') {
      orderBy = [{ ratingAvg: 'asc' }, { isFeatured: 'desc' }];
    } else if (sort === 'rating' || sort === 'rating_desc') {
      orderBy = [{ ratingAvg: 'desc' }, { isFeatured: 'desc' }];
    } else if (sort === 'newest') {
      orderBy = [{ publishedAt: 'desc' }, { isFeatured: 'desc' }];
    }
    // price_asc / price_desc sorted in-memory after fetch (need service price)

    const include = {
      user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      locations: { include: { location: true }, where: { isPrimary: true }, take: 1 },
      professionalServices: {
        where: { isActive: true },
        take: 5,
        orderBy: { price: 'asc' as const },
        include: { service: { select: { name: true, slug: true } } },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      }),
      this.prisma.professional.count({ where }),
    ]);

    let sorted = items;
    if (sort === 'price_asc' || sort === 'price_desc') {
      const dir = sort === 'price_asc' ? 1 : -1;
      sorted = [...items].sort((a, b) => {
        const pa = a.professionalServices?.[0]?.price ?? Number.POSITIVE_INFINITY;
        const pb = b.professionalServices?.[0]?.price ?? Number.POSITIVE_INFINITY;
        return (pa - pb) * dir;
      });
    }

    let withDistance: any[] = sorted;
    if (geo) {
      withDistance = sorted
        .map((item) => {
          const loc = item.locations?.[0]?.location;
          const plat = loc?.latitude != null ? Number(loc.latitude) : NaN;
          const plng = loc?.longitude != null ? Number(loc.longitude) : NaN;
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
            return { ...item, distanceKm: null as number | null };
          }
          const distanceKm = Math.round(haversineKm(geo.lat, geo.lng, plat, plng) * 10) / 10;
          return { ...item, distanceKm };
        })
        .filter((item) => item.distanceKm == null || item.distanceKm <= geo.radiusKm);
      if (params.sort === 'distance' || !params.sort || params.sort === 'featured') {
        withDistance = [...withDistance].sort((a, b) => {
          const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
          const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
          return da - db;
        });
      }
    }

    const result = {
      items: withDistance,
      meta: {
        page,
        limit,
        total,
        sort,
        filters: {
          minRating: params.minRating ?? null,
          minPrice: params.minPrice ?? null,
          maxPrice: params.maxPrice ?? null,
          availableDate: params.availableDate ?? null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          radiusKm: geo?.radiusKm ?? null,
        },
      },
    };
    if (cacheKey) this.cache.set(cacheKey, result);
    return result;
  }

  async findBySlug(slug: string) {
    const cacheKey = `catalog:slug:${slug}`;
    const hit = this.cache.get<unknown>(cacheKey);
    if (hit) return hit as any;

    const pro = await this.prisma.professional.findUnique({
      where: { slug },
      include: this.publicInclude(),
    });
    if (!pro || pro.status !== ProfessionalStatus.approved || !pro.publishedAt) {
      throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    }
    this.cache.set(cacheKey, pro, 120_000);
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
      this.cache.invalidateCatalog();
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
    const updated = await this.prisma.professional.update({
      where: { id: pro.id },
      data: {
        status: ProfessionalStatus.pending_review,
        publishedAt: null,
      },
    });
    this.cache.invalidateCatalog();
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
    this.cache.invalidateCatalog();
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

  async getEarnings(userId: string, page = 1, limit = 20) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const take = Math.min(50, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const paidWhere = {
      status: 'paid' as const,
      booking: { professionalId: pro.id },
    };

    const now = new Date();
    // Asia/Tehran approx: use local UTC+3:30 for period bounds
    const tehranOffsetMs = 3.5 * 3600 * 1000;
    const tehranNow = new Date(now.getTime() + tehranOffsetMs);
    const startOfTodayTehran = new Date(Date.UTC(
      tehranNow.getUTCFullYear(),
      tehranNow.getUTCMonth(),
      tehranNow.getUTCDate(),
      0, 0, 0, 0,
    ) - tehranOffsetMs);
    // Saturday start of week in Tehran
    const tehranDow = tehranNow.getUTCDay(); // 0=Sun..6=Sat in the shifted clock
    // After adding offset, getUTCDay reflects Tehran calendar day-ish
    const daysSinceSat = (tehranDow + 1) % 7;
    const startOfWeekTehran = new Date(startOfTodayTehran.getTime() - daysSinceSat * 86400000);
    const startOfMonthTehran = new Date(Date.UTC(
      tehranNow.getUTCFullYear(),
      tehranNow.getUTCMonth(),
      1, 0, 0, 0, 0,
    ) - tehranOffsetMs);

    const sumNet = async (from?: Date) => {
      const where: any = { ...paidWhere };
      if (from) where.paidAt = { gte: from };
      const agg = await this.prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
          platformCommissionAmount: true,
          professionalNetAmount: true,
        },
        _count: true,
      });
      const gross = Number(agg._sum.amount || 0);
      let net = Number(agg._sum.professionalNetAmount || 0);
      let commission = Number(agg._sum.platformCommissionAmount || 0);
      if (!net && gross) {
        commission = Math.round(gross * 0.1);
        net = Math.max(0, gross - commission);
      }
      return { gross, net, commission, count: agg._count };
    };

    const [allTime, today, week, month, items, total, payoutAggs] = await Promise.all([
      sumNet(),
      sumNet(startOfTodayTehran),
      sumNet(startOfWeekTehran),
      sumNet(startOfMonthTehran),
      this.prisma.payment.findMany({
        where: paidWhere,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              startAt: true,
              customer: {
                select: {
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where: paidWhere }),
      this.prisma.payoutRequest.groupBy({
        by: ['status'],
        where: { professionalId: pro.id },
        _sum: { amount: true },
        _count: true,
      }).catch(() => [] as Array<{ status: string; _sum: { amount: number | null }; _count: number }>),
    ]);

    let settled = 0; // paid out to professional
    let pendingPayout = 0; // requested but not yet paid
    let settledCount = 0;
    let pendingCount = 0;
    for (const row of payoutAggs as Array<{ status: string; _sum: { amount: number | null }; _count: number }>) {
      const amt = Number(row._sum?.amount || 0);
      if (row.status === 'paid') {
        settled += amt;
        settledCount += row._count;
      } else if (row.status === 'pending' || row.status === 'approved') {
        pendingPayout += amt;
        pendingCount += row._count;
      }
    }

    const available = Math.max(0, allTime.net - settled - pendingPayout);

    return {
      summary: {
        grossRevenue: allTime.gross,
        platformCommission: allTime.commission,
        professionalNet: allTime.net,
        paidCount: allTime.count,
        // automatic balance
        totalEarned: allTime.net,
        totalPaidOut: settled,
        totalPendingPayout: pendingPayout,
        available,
        settledCount,
        pendingCount,
      },
      periods: {
        today: { earned: today.net, gross: today.gross, count: today.count },
        week: { earned: week.net, gross: week.gross, count: week.count },
        month: { earned: month.net, gross: month.gross, count: month.count },
        allTime: { earned: allTime.net, gross: allTime.gross, count: allTime.count },
      },
      items,
      meta: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take) || 0,
      },
      notice:
        'درآمد به‌صورت خودکار از رزروهای پرداخت‌شده محاسبه می‌شود. مبلغ قابل برداشت = درآمد خالص − تسویه‌شده − در صف تسویه.',
    };
  }

  async requestPayout(userId: string, amount: number, note?: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { userId },
      include: { user: { select: { phone: true, profile: { select: { displayName: true } } } } },
    });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const earnings = await this.getEarnings(userId, 1, 1);
    const available = Number(earnings.summary.available ?? earnings.summary.professionalNet ?? 0);
    if (amount > available) {
      throw new BadRequestException(
        `مبلغ درخواستی از موجودی قابل برداشت (${available.toLocaleString('fa-IR')} ریال) بیشتر است`,
      );
    }
    if (amount < 10000) {
      throw new BadRequestException('حداقل مبلغ درخواست ۱۰٬۰۰۰ ریال است');
    }

    let payoutId: string | null = null;
    try {
      const payout = await this.prisma.payoutRequest.create({
        data: {
          professionalId: pro.id,
          amount,
          note: note?.trim() || null,
          status: 'pending',
        },
      });
      payoutId = payout.id;
    } catch {
      /* table may lag migration in some envs — still notify */
    }

    const adminRoles = await this.prisma.role.findMany({
      where: { name: { in: ['SUPER_ADMIN', 'admin'] } },
      select: { id: true },
    });
    const roleIds = adminRoles.map((r) => r.id);
    const adminUsers = roleIds.length
      ? await this.prisma.userRole.findMany({
          where: { roleId: { in: roleIds } },
          select: { userId: true },
        })
      : [];
    const adminIds = Array.from(new Set(adminUsers.map((u) => u.userId)));
    const title = 'درخواست تسویه زیباگر';
    const body = `${pro.user?.profile?.displayName || pro.title} (${pro.user?.phone || '—'}) درخواست تسویه ${amount.toLocaleString('fa-IR')} ریال ثبت کرد.${note ? ' یادداشت: ' + note : ''}`;
    for (const adminId of adminIds) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: adminId,
            type: 'system',
            title,
            body,
            data: {
              type: 'payout_request',
              payoutRequestId: payoutId,
              professionalId: pro.id,
              amount,
              note: note || null,
              availableNet: available,
            },
          },
        });
      } catch {
        /* non-blocking */
      }
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'professional.payout_request',
          entityType: payoutId ? 'payout_request' : 'professional',
          entityId: payoutId || pro.id,
          after: { amount, note: note || null, availableNet: available, professionalId: pro.id } as any,
        },
      });
    } catch {
      /* non-blocking */
    }
    return {
      success: true,
      message: 'درخواست تسویه ثبت شد. پس از پرداخت توسط مدیریت، از موجودی کم می‌شود.',
      id: payoutId,
      amount,
      availableNet: available,
    };
  }
}
