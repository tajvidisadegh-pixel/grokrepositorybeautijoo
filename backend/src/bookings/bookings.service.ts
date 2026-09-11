import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, NotificationType, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { tehranDateStr, tehranHHMM } from '../common/timezone';

export type ProBookingListQuery = {
  page?: number;
  limit?: number;
  /** free-text: customer phone or display name */
  q?: string;
  status?: string;
  /** ISO date YYYY-MM-DD (Tehran calendar day filter on startAt) */
  from?: string;
  to?: string;
  serviceId?: string;
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
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

    type Line = {
      serviceId: string;
      professionalServiceId: string;
      durationMin: number;
      price: number;
      addOnsSnapshot: { id: string; name: string; price: number; extraDurationMin: number }[];
      priceRuleId: string | null;
      durationRuleId: string | null;
      bufferMin: number;
    };

    const lines: Line[] = proServices.map((ps, index) => {
      let unitPrice = ps.price;
      let unitDuration = ps.durationMin;
      let linePriceRuleId: string | null = null;
      let lineDurationRuleId: string | null = null;

      if (index === 0 && priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === priceRuleId)!;
        unitPrice = rule.price;
        linePriceRuleId = rule.id;
      }
      if (index === 0 && durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === durationRuleId)!;
        unitDuration = rule.durationMin;
        lineDurationRuleId = rule.id;
      }

      const lineAddOns =
        index === 0
          ? requestedAddOnIds
              .map((id) => addOnById.get(id)!)
              .filter((a) => a.professionalServiceId === ps.id)
              .map((a) => ({
                id: a.id,
                name: a.name,
                price: a.price,
                extraDurationMin: a.extraDurationMin,
              }))
          : [];

      const addOnPrice = lineAddOns.reduce((s, a) => s + a.price, 0);
      const addOnDuration = lineAddOns.reduce((s, a) => s + a.extraDurationMin, 0);

      return {
        serviceId: ps.serviceId,
        professionalServiceId: ps.id,
        durationMin: unitDuration + addOnDuration,
        price: unitPrice + addOnPrice,
        addOnsSnapshot: lineAddOns,
        priceRuleId: linePriceRuleId,
        durationRuleId: lineDurationRuleId,
        bufferMin: ps.bufferMin,
      };
    });

    const totalPrice = lines.reduce((s, l) => s + l.price, 0);
    const totalDuration = lines.reduce((s, l) => s + l.durationMin + l.bufferMin, 0);

    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان شروع نامعتبر است');
    }
    const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

    const dateStr = tehranDateStr(startAt);
    const startHHMM = tehranHHMM(startAt);
    const avail = await this.availability.getSlots(
      data.professionalId,
      dateStr,
      totalDuration,
    );
    const normalizeHhmm = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(s).trim());
      if (!m) return s;
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    };
    const want = normalizeHhmm(startHHMM);
    const slotOk = avail.slots.some(
      (s: { start: string; end: string }) => normalizeHhmm(s.start) === want,
    );
    if (!slotOk) {
      throw new ConflictException('این بازه زمانی در دسترس نیست');
    }

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

          // Default: registered as confirmed — no pro approval required (#52)
          const b = await tx.booking.create({
            data: {
              customerId,
              professionalId: data.professionalId,
              locationId: data.locationId,
              status: BookingStatus.confirmed,
              confirmedAt: new Date(),
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
                addOnIds: requestedAddOnIds,
                priceRuleId,
                durationRuleId,
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
        type: NotificationType.booking_confirmed,
        title: 'رزرو جدید ثبت شد',
        body: 'یک مشتری رزرو جدید ثبت کرد. جزئیات را در پنل رزروها ببینید.',
        data: { bookingId: booking.id, customerId, professionalId: data.professionalId },
        sms: true,
      });
      await this.notifications.notify({
        userId: customerId,
        type: NotificationType.booking_confirmed,
        title: 'رزرو ثبت شد',
        body: 'رزرو شما با موفقیت ثبت شد.',
        data: { bookingId: booking.id, professionalId: data.professionalId },
        sms: false,
      });
      return booking;
    } catch (e: unknown) {
      if (e instanceof ConflictException) throw e;
      if (e instanceof BadRequestException) throw e;
      const err = e as { code?: string; message?: string; meta?: unknown };
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

  async listMineAsCustomer(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { customerId: userId },
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          professional: {
            include: { user: { select: { profile: { select: { displayName: true } } } } },
          },
          items: { include: { service: true } },
          payment: true,
          review: true,
        },
      }),
      this.prisma.booking.count({ where: { customerId: userId } }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listMineAsProfessional(userId: string, query: ProBookingListQuery = {}) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new ForbiddenException();

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = { professionalId: pro.id };

    if (query.status) {
      const statuses = query.status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as BookingStatus[];
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { in: statuses };
    }

    if (query.from || query.to) {
      where.startAt = {};
      if (query.from) {
        const d = new Date(query.from);
        if (!isNaN(d.getTime())) (where.startAt as Prisma.DateTimeFilter).gte = d;
      }
      if (query.to) {
        const d = new Date(query.to);
        if (!isNaN(d.getTime())) {
          // inclusive end-of-day if date-only
          if (/^\d{4}-\d{2}-\d{2}$/.test(query.to.trim())) {
            d.setHours(23, 59, 59, 999);
          }
          (where.startAt as Prisma.DateTimeFilter).lte = d;
        }
      }
    }

    if (query.serviceId) {
      where.items = { some: { serviceId: query.serviceId } };
    }

    const q = (query.q || '').trim();
    if (q) {
      where.OR = [
        { customer: { phone: { contains: q } } },
        { customer: { profile: { displayName: { contains: q, mode: 'insensitive' } } } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
          items: { include: { service: true } },
          payment: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getOne(id: string, userId: string, roles: string[]) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, phone: true, profile: true } },
        professional: { include: { user: { select: { profile: true } } } },
        items: { include: { service: true } },
        payment: true,
        review: true,
      },
    });
    if (!b) throw new NotFoundException();
    const isAdmin = roles.some((r) => ['admin', 'SUPER_ADMIN'].includes(r));
    const isCustomer = b.customerId === userId;
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = pro && b.professionalId === pro.id;
    if (!isAdmin && !isCustomer && !isPro) throw new ForbiddenException();
    return b;
  }

  async transition(
    id: string,
    userId: string,
    roles: string[],
    action: 'confirm' | 'reject' | 'cancel' | 'complete',
    reason?: string,
  ) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, phone: true } },
        professional: { select: { id: true, userId: true } },
      },
    });
    if (!b) throw new NotFoundException();
    const isAdmin = roles.some((r) => ['admin', 'SUPER_ADMIN'].includes(r));
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = pro && b.professionalId === pro.id;
    const isCustomer = b.customerId === userId;

    if (action === 'confirm' || action === 'reject') {
      if (!isAdmin && !isPro) throw new ForbiddenException();
      // Allow reject from confirmed as well (pro can still decline after auto-confirm)
      const allowedForReject = [BookingStatus.pending, BookingStatus.confirmed];
      if (action === 'confirm' && b.status !== BookingStatus.pending) {
        throw new BadRequestException('فقط رزرو در انتظار قابل تأیید است');
      }
      if (action === 'reject' && !allowedForReject.includes(b.status as BookingStatus)) {
        throw new BadRequestException('این رزرو قابل رد نیست');
      }
      const status = action === 'confirm' ? BookingStatus.confirmed : BookingStatus.rejected;
      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          status,
          confirmedAt: action === 'confirm' ? new Date() : undefined,
          rejectedReason: action === 'reject' ? reason ?? null : undefined,
        },
      });

      if (action === 'reject') {
        const body =
          reason?.trim()
            ? `رزرو شما توسط زیباگر رد شد. دلیل: ${reason.trim()}`
            : 'رزرو شما توسط زیباگر رد شد.';
        await this.notifications.notify({
          userId: b.customerId,
          type: NotificationType.booking_rejected,
          title: 'رزرو رد شد',
          body,
          data: { bookingId: id, reason: reason ?? null },
          sms: true,
        });
      } else {
        await this.notifications.notify({
          userId: b.customerId,
          type: NotificationType.booking_confirmed,
          title: 'رزرو تأیید شد',
          body: 'رزرو شما توسط زیباگر تأیید شد.',
          data: { bookingId: id },
          sms: true,
        });
      }
      return updated;
    }

    if (action === 'cancel') {
      if (!isAdmin && !isCustomer && !isPro) throw new ForbiddenException();
      if (![BookingStatus.pending, BookingStatus.confirmed].includes(b.status as any)) {
        throw new BadRequestException('این رزرو قابل لغو نیست');
      }
      const updated = await this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: reason ?? null,
        },
      });
      const notifyUserId = isCustomer ? b.professional.userId : b.customerId;
      await this.notifications.notify({
        userId: notifyUserId,
        type: NotificationType.booking_cancelled,
        title: 'رزرو لغو شد',
        body: reason?.trim()
          ? `رزرو لغو شد. دلیل: ${reason.trim()}`
          : 'رزرو لغو شد.',
        data: { bookingId: id, reason: reason ?? null },
        sms: true,
      });
      return updated;
    }

    if (action === 'complete') {
      if (!isAdmin && !isPro) throw new ForbiddenException();
      // Allow complete from confirmed, or past pending (auto-confirm era)
      if (
        ![BookingStatus.confirmed, BookingStatus.pending, BookingStatus.expired].includes(
          b.status as BookingStatus,
        )
      ) {
        throw new BadRequestException('این رزرو قابل تکمیل نیست');
      }
      const updated = await this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.completed, completedAt: new Date() },
      });
      await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.booking_completed,
        title: 'رزرو تکمیل شد',
        body: 'رزرو شما به‌عنوان تکمیل‌شده ثبت شد.',
        data: { bookingId: id },
        sms: false,
      });
      return updated;
    }

    throw new BadRequestException('عملیات نامعتبر');
  }

  /**
   * Professional reports a problem on a booking → in-app notification to all SUPER_ADMIN
   * (+ audit log). No separate Ticket table required.
   */
  async reportToAdmin(
    bookingId: string,
    userId: string,
    roles: string[],
    message: string,
  ) {
    const text = (message || '').trim();
    if (text.length < 5) {
      throw new BadRequestException('متن گزارش حداقل ۵ کاراکتر باشد');
    }
    if (text.length > 2000) {
      throw new BadRequestException('متن گزارش بیش از حد طولانی است');
    }

    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { phone: true, profile: { select: { displayName: true } } } },
        professional: { select: { id: true, userId: true, title: true } },
      },
    });
    if (!b) throw new NotFoundException();

    const isAdmin = roles.some((r) => ['admin', 'SUPER_ADMIN'].includes(r));
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = pro && b.professionalId === pro.id;
    if (!isAdmin && !isPro) throw new ForbiddenException();

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'booking.report_to_admin',
        entityType: 'booking',
        entityId: bookingId,
        after: {
          message: text,
          customerPhone: b.customer?.phone ?? null,
          professionalId: b.professionalId,
        } as Prisma.InputJsonValue,
      },
    });

    const admins = await this.prisma.user.findMany({
      where: {
        status: 'active',
        userRoles: { some: { role: { name: { in: ['SUPER_ADMIN', 'admin'] } } } },
      },
      select: { id: true },
      take: 50,
    });

    const title = 'گزارش مشکل رزرو از زیباگر';
    const body = `رزرو ${bookingId.slice(0, 8)}… — ${text}`;
    await Promise.all(
      admins.map((a) =>
        this.notifications.notify({
          userId: a.id,
          type: NotificationType.system,
          title,
          body,
          data: {
            bookingId,
            professionalId: b.professionalId,
            reporterId: userId,
            message: text,
          },
          sms: false,
        }),
      ),
    );

    return { message: 'گزارش برای سوپرادمین ارسال شد', notified: admins.length };
  }
}
