import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { tehranDateStr, tehranHHMM } from '../common/timezone';

export type ProBookingListQuery = {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  serviceId?: string;
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
  ) {}

  async create(
    customerId: string,
    data: {
      professionalId: string;
      serviceIds: string[];
      startAt: string;
      locationId?: string;
      notes?: string;
      addOnIds?: string[];
      priceRuleId?: string;
      durationRuleId?: string;
    },
  ) {
    if (!data.serviceIds?.length) throw new BadRequestException('حداقل یک خدمت لازم است');

    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('کاربر یافت نشد');
    if (!customer.phoneVerified) {
      throw new BadRequestException('قبل از رزرو باید شماره موبایل با کد یکبارمصرف تأیید شود');
    }

    {
      const proId = data.professionalId;
      const proRow = await this.prisma.professional.findUnique({
        where: { id: proId },
        select: { socialLinks: true },
      });
      const sl = (proRow?.socialLinks || {}) as Record<string, unknown>;
      if (sl._pauseBookings === true) {
        throw new BadRequestException('این زیباگر فعلاً نوبت جدید نمی‌پذیرد.');
      }
      const links = (proRow?.socialLinks as { _blockedCustomerIds?: string[] } | null) || null;
      const blocked = Array.isArray(links?._blockedCustomerIds) ? links!._blockedCustomerIds! : [];
      if (blocked.includes(customerId)) {
        throw new BadRequestException('متأسفانه امکان رزرو نزد این زیباگر برای شما وجود ندارد.');
      }
    }

    const maxConcurrent = Math.max(1, parseInt(process.env.MAX_CONCURRENT_BOOKINGS || '3', 10) || 3);
    const activeCount = await this.prisma.booking.count({
      where: {
        customerId,
        status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
        startAt: { gte: new Date() },
      },
    });
    if (activeCount >= maxConcurrent) {
      throw new BadRequestException(
        `حداکثر ${maxConcurrent} رزرو فعال همزمان مجاز است. ابتدا یکی از رزروهای قبلی را مدیریت کنید.`,
      );
    }

    const pro = await this.prisma.professional.findUnique({ where: { id: data.professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');

    const proServices = await this.prisma.professionalService.findMany({
      where: {
        professionalId: data.professionalId,
        serviceId: { in: data.serviceIds },
        isActive: true,
      },
      include: {
        addOns: { where: { isActive: true } },
        priceRules: { where: { isActive: true } },
        durationRules: { where: { isActive: true } },
      },
    });
    if (proServices.length !== data.serviceIds.length) {
      throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
    }

    const requestedAddOnIds = Array.from(new Set(data.addOnIds || []));
    const addOnById = new Map(
      proServices.flatMap((ps) => ps.addOns.map((a) => [a.id, { ...a, professionalServiceId: ps.id }] as const)),
    );
    for (const id of requestedAddOnIds) {
      if (!addOnById.has(id)) {
        throw new BadRequestException('یکی از افزودنی‌های انتخاب‌شده معتبر یا فعال نیست');
      }
    }

    const primary = proServices[0];
    let priceRuleId: string | null = null;
    let durationRuleId: string | null = null;
    if (data.priceRuleId) {
      const rule = primary.priceRules.find((r) => r.id === data.priceRuleId);
      if (!rule) throw new BadRequestException('قانون قیمت انتخاب‌شده معتبر نیست');
      priceRuleId = rule.id;
    }
    if (data.durationRuleId) {
      const rule = primary.durationRules.find((r) => r.id === data.durationRuleId);
      if (!rule) throw new BadRequestException('قانون زمان انتخاب‌شده معتبر نیست');
      durationRuleId = rule.id;
    }

    const lines = proServices.map((ps) => {
      let price = ps.price;
      let durationMin = ps.durationMin;
      if (priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === priceRuleId);
        if (rule) price = rule.price;
      }
      if (durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === durationRuleId);
        if (rule) durationMin = rule.durationMin;
      }
      const addOns = requestedAddOnIds
        .map((id) => addOnById.get(id))
        .filter((a): a is NonNullable<typeof a> => !!a && a.professionalServiceId === ps.id);
      const addOnPrice = addOns.reduce((s, a) => s + a.price, 0);
      const addOnDur = addOns.reduce((s, a) => s + (a.extraDurationMin || 0), 0);
      return {
        serviceId: ps.serviceId,
        professionalServiceId: ps.id,
        durationMin: durationMin + addOnDur,
        price: price + addOnPrice,
        addOnsSnapshot: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        priceRuleId,
        durationRuleId,
      };
    });

    const totalDuration = lines.reduce((s, l) => s + l.durationMin, 0);
    const totalPrice = lines.reduce((s, l) => s + l.price, 0);

    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان شروع نامعتبر است');
    }
    {
      const minLead = parseInt(process.env.BOOKING_MIN_LEAD_HOURS || '4', 10);
      const hours = Number.isFinite(minLead) && minLead >= 0 ? minLead : 4;
      if (startAt.getTime() - Date.now() < hours * 3600_000) {
        throw new BadRequestException(
          hours === 0 ? 'زمان شروع نامعتبر است' : `حداقل ${hours} ساعت قبل از نوبت باید رزرو کنید.`,
        );
      }
    }
    const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

    const dateStr = tehranDateStr(startAt);
    const startHHMM = tehranHHMM(startAt);
    const avail = await this.availability.getSlots(data.professionalId, dateStr, totalDuration);
    const normalizeHhmm = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(s).trim());
      if (!m) return s;
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    };
    const want = normalizeHhmm(startHHMM);
    const slotOk = avail.slots.some(
      (s: { start: string; end: string; available?: boolean }) =>
        normalizeHhmm(s.start) === want && s.available !== false,
    );
    if (!slotOk) throw new ConflictException('این بازه زمانی در دسترس نیست');

    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRawUnsafe(
            `SELECT id FROM professionals WHERE id = $1::uuid FOR UPDATE`,
            data.professionalId,
          );

          const overlappingBookings = await tx.booking.count({
            where: {
              professionalId: data.professionalId,
              status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
          });
          if (overlappingBookings > 0) {
            throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
          }

          const overlappingTimeOff = await tx.timeOff.count({
            where: {
              professionalId: data.professionalId,
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
          });
          if (overlappingTimeOff > 0) {
            throw new ConflictException('این بازه زمانی در دسترس نیست');
          }

          const overlappingManual = await tx.manualReservation.count({
            where: {
              professionalId: data.professionalId,
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
          });
          if (overlappingManual > 0) {
            throw new ConflictException('این بازه زمانی در دسترس نیست');
          }

          const b = await tx.booking.create({
            data: {
              customerId,
              professionalId: data.professionalId,
              locationId: data.locationId,
              status: BookingStatus.pending,
              startAt,
              endAt,
              totalPrice,
              notes: data.notes,
              items: {
                create: lines.map((line, i) => ({
                  serviceId: line.serviceId,
                  professionalServiceId: line.professionalServiceId,
                  durationMin: line.durationMin,
                  price: line.price,
                  addOnsSnapshot: line.addOnsSnapshot as unknown as Prisma.InputJsonValue,
                  priceRuleId: line.priceRuleId,
                  durationRuleId: line.durationRuleId,
                  sortOrder: i,
                })),
              },
            },
            include: { items: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: customerId,
              action: 'booking.create',
              entityType: 'booking',
              entityId: b.id,
              after: {
                status: b.status,
                totalPrice: b.totalPrice,
              } as Prisma.InputJsonValue,
            },
          });
          return b;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );

      await this.notifications.notify({
        userId: pro.userId,
        type: NotificationType.booking_request,
        title: 'درخواست رزرو (در انتظار پرداخت)',
        body: 'یک مشتری نوبت رزرو کرده و در حال پرداخت است. تا تأیید پرداخت، نوبت قطعی نیست.',
        data: { bookingId: booking.id, customerId, professionalId: data.professionalId },
        sms: false,
      });
      await this.notifications.notify({
        userId: customerId,
        type: NotificationType.booking_request,
        title: 'رزرو در انتظار پرداخت',
        body: 'رزرو شما ثبت شد. پس از پرداخت موفق، نوبت قطعی می‌شود.',
        data: { bookingId: booking.id, professionalId: data.professionalId },
        sms: false,
      });
      return booking;
    } catch (e: unknown) {
      if (e instanceof ConflictException) throw e;
      if (e instanceof BadRequestException) throw e;
      const err = e as { code?: string; message?: string };
      const msg = String(err?.message ?? e ?? '');
      if (
        err?.code === 'P2004' ||
        err?.code === 'P2034' ||
        msg.includes('bookings_no_overlap') ||
        msg.includes('23P01') ||
        msg.toLowerCase().includes('exclusion')
      ) {
        throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
      }
      throw e;
    }
  }

  async listMineAsCustomer(userId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: { customerId: string; status?: BookingStatus } = { customerId: userId };
    if (status) where.status = status as BookingStatus;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          professional: { select: { id: true, title: true, slug: true } },
          items: true,
          payment: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listMineAsProfessional(userId: string, query: ProBookingListQuery = {}) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    if (!pro) throw new ForbiddenException();
    const where: Prisma.BookingWhereInput = { professionalId: pro.id };
    if (query.status) {
      const parts = query.status.split(',').map((s) => s.trim()).filter(Boolean) as BookingStatus[];
      if (parts.length === 1) where.status = parts[0];
      else if (parts.length > 1) where.status = { in: parts };
    }
    if (query.from || query.to) {
      where.startAt = {};
      if (query.from) (where.startAt as Prisma.DateTimeFilter).gte = new Date(query.from);
      if (query.to) (where.startAt as Prisma.DateTimeFilter).lte = new Date(query.to);
    }
    if (query.serviceId) {
      where.items = { some: { serviceId: query.serviceId } };
    }
    if (query.q) {
      where.OR = [
        { notes: { contains: query.q, mode: 'insensitive' } },
        { customer: { profile: { displayName: { contains: query.q, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: { select: { id: true, phone: true, profile: true } },
          items: true,
          payment: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getOne(id: string, userId: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        professional: true,
        customer: { select: { id: true, phone: true, profile: true } },
        items: true,
        payment: true,
        location: true,
      },
    });
    if (!b) throw new NotFoundException();
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    if (b.customerId !== userId && pro?.id !== b.professionalId) {
      throw new ForbiddenException();
    }
    return b;
  }

  async transition(
    id: string,
    userId: string,
    action: 'confirm' | 'reject' | 'cancel' | 'complete' | 'no_show',
    reason?: string,
  ) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { payment: true } });
    if (!b) throw new NotFoundException();
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    const isPro = pro?.id === b.professionalId;
    const isCustomer = b.customerId === userId;

    if (action === 'confirm' || action === 'reject') {
      if (!isPro) throw new ForbiddenException();
      if (action === 'confirm' && b.status !== BookingStatus.pending) {
        throw new BadRequestException('فقط رزرو در انتظار قابل تأیید است');
      }
      const allowedForReject: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (action === 'reject' && !allowedForReject.includes(b.status)) {
        throw new BadRequestException('این رزرو قابل رد نیست');
      }
      const status = action === 'confirm' ? BookingStatus.confirmed : BookingStatus.rejected;
      return this.prisma.booking.update({
        where: { id },
        data: {
          status,
          confirmedAt: action === 'confirm' ? new Date() : undefined,
          rejectedReason: action === 'reject' ? reason ?? null : undefined,
        },
      });
    }

    if (action === 'cancel') {
      if (!isCustomer && !isPro) throw new ForbiddenException();
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) throw new BadRequestException('این رزرو قابل لغو نیست');
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
        },
      });
    }

    if (action === 'complete') {
      if (!isPro) throw new ForbiddenException();
      const allowed: BookingStatus[] = [
        BookingStatus.confirmed,
        BookingStatus.pending,
        BookingStatus.expired,
      ];
      if (!allowed.includes(b.status)) throw new BadRequestException('قابل تکمیل نیست');
      return this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.completed, completedAt: new Date() },
      });
    }

    if (action === 'no_show') {
      if (!isPro) throw new ForbiddenException();
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) {
        throw new BadRequestException('این رزرو قابل ثبت عدم حضور نیست');
      }
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelReason: reason || 'no_show',
          cancelledAt: new Date(),
        },
      });
    }

    throw new BadRequestException('عملیات نامعتبر');
  }

  async reschedule(id: string, userId: string, startAtIso: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    if (b.customerId !== userId) throw new ForbiddenException();
    const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
    if (!allowed.includes(b.status)) throw new BadRequestException('قابل جابجایی نیست');
    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان نامعتبر');
    }
    const durationMs = b.endAt.getTime() - b.startAt.getTime();
    const endAt = new Date(startAt.getTime() + durationMs);
    const overlap = await this.prisma.booking.count({
      where: {
        professionalId: b.professionalId,
        id: { not: id },
        status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlap > 0) throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
    return this.prisma.booking.update({ where: { id }, data: { startAt, endAt } });
  }

  async reportIssue(id: string, userId: string, message: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    if (b.customerId !== userId) throw new ForbiddenException();
    const admins = await this.prisma.user.findMany({
      where: { userRoles: { some: { role: { name: { in: ['admin', 'SUPER_ADMIN'] } } } } },
      select: { id: true },
      take: 20,
    });
    for (const a of admins) {
      await this.notifications.notify({
        userId: a.id,
        type: NotificationType.system,
        title: 'گزارش مشکل رزرو',
        body: message?.slice(0, 500) || 'گزارش بدون متن',
        data: { bookingId: id },
        sms: false,
      });
    }
    return { message: 'گزارش برای سوپرادمین ارسال شد', notified: admins.length };
  }
}
