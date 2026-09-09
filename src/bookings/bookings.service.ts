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

    // Price/duration rules apply to the first (primary) service when provided
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

      const lineAddOns = requestedAddOnIds
        .map((id) => addOnById.get(id)!)
        .filter((a) => a.professionalServiceId === ps.id)
        .map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          extraDurationMin: a.extraDurationMin || 0,
        }));

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

    // Optimistic availability check (fast fail for UX). Authoritative check runs inside the transaction under lock.
    const dateStr = tehranDateStr(startAt);
    const startHHMM = tehranHHMM(startAt);
    const avail = await this.availability.getSlots(
      data.professionalId,
      dateStr,
      totalDuration,
    );
    const slotOk = avail.slots.some((s: { start: string; end: string }) => s.start === startHHMM);
    if (!slotOk) {
      throw new ConflictException('این بازه زمانی در دسترس نیست');
    }

    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          // Serialize concurrent booking attempts for the same professional.
          await tx.$queryRaw`SELECT id FROM professionals WHERE id = ${data.professionalId}::uuid FOR UPDATE`;

          // Authoritative overlap check under lock (bookings + time-offs + manual reservations).
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
                addOnIds: requestedAddOnIds,
                priceRuleId,
                durationRuleId,
              } as Prisma.InputJsonValue,
            },
          });
          return b;
        },
        {
          // Isolation level that supports row locks reliably
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );
      await this.notifications.notify({
        userId: pro.userId,
        type: NotificationType.booking_request,
        title: 'درخواست رزرو جدید',
        body: 'یک مشتری درخواست رزرو جدید ثبت کرد. جزئیات را در پنل رزروها ببینید.',
        data: { bookingId: booking.id, customerId, professionalId: data.professionalId },
        sms: true,
      });
      await this.notifications.notify({
        userId: customerId,
        type: NotificationType.booking_request,
        title: 'رزرو ثبت شد',
        body: 'درخواست رزرو شما ثبت شد و در انتظار تأیید زیباگر است.',
        data: { bookingId: booking.id, professionalId: data.professionalId },
        sms: false,
      });
      return booking;
    } catch (e: unknown) {
      if (e instanceof ConflictException) throw e;
      const err = e as { code?: string; message?: string };
      // Prisma maps exclusion-constraint violations; also match constraint name substring.
      if (
        err.code === 'P2004' ||
        err.message?.includes('bookings_no_overlap') ||
        err.message?.includes('23P01') // exclusion_violation
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

  async listMineAsProfessional(userId: string, page = 1, limit = 20) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new ForbiddenException();
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { professionalId: pro.id },
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: { select: { id: true, phone: true, profile: true } },
          items: { include: { service: true } },
          payment: true,
        },
      }),
      this.prisma.booking.count({ where: { professionalId: pro.id } }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getOne(id: string, userId: string, roles: string[]) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: { include: { service: true } },
        professional: true,
        customer: { select: { id: true, phone: true, profile: true } },
        payment: true,
        review: true,
      },
    });
    if (!b) throw new NotFoundException();
    const isAdmin = roles.includes('admin');
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
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();

    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    const isPro = pro && b.professionalId === pro.id;
    const isCustomer = b.customerId === userId;
    const isAdmin = roles.includes('admin');

    let newStatus: BookingStatus;
    const data: Prisma.BookingUpdateInput = {};

    switch (action) {
      case 'confirm':
        if (!isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.pending) throw new BadRequestException('فقط رزرو در انتظار قابل تأیید است');
        newStatus = BookingStatus.confirmed;
        data.confirmedAt = new Date();
        break;
      case 'reject':
        if (!isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.pending) throw new BadRequestException();
        newStatus = BookingStatus.rejected;
        data.rejectedReason = reason;
        break;
      case 'cancel':
        if (!isCustomer && !isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.pending && b.status !== BookingStatus.confirmed) {
          throw new BadRequestException();
        }
        newStatus = BookingStatus.cancelled;
        data.cancelReason = reason;
        data.cancelledAt = new Date();
        break;
      case 'complete':
        if (!isPro && !isAdmin) throw new ForbiddenException();
        if (b.status !== BookingStatus.confirmed) throw new BadRequestException();
        newStatus = BookingStatus.completed;
        data.completedAt = new Date();
        break;
      default:
        throw new BadRequestException();
    }

    data.status = newStatus;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: `booking.${action}`,
          entityType: 'booking',
          entityId: id,
          before: { status: b.status } as Prisma.InputJsonValue,
          after: { status: newStatus } as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    const bookingPro = await this.prisma.professional.findUnique({
      where: { id: b.professionalId },
      select: { userId: true },
    });

    await this.notifyBookingTransition({
      action,
      bookingId: id,
      customerId: b.customerId,
      professionalUserId: bookingPro?.userId,
      actorUserId: userId,
      reason,
    });

    return updated;
  }

  private async notifyBookingTransition(opts: {
    action: 'confirm' | 'reject' | 'cancel' | 'complete';
    bookingId: string;
    customerId: string;
    professionalUserId?: string | null;
    actorUserId: string;
    reason?: string;
  }) {
    const { action, bookingId, customerId, professionalUserId, reason } = opts;
    const reasonSuffix = reason?.trim() ? ` دلیل: ${reason.trim()}` : '';
    const map: Record<
      typeof action,
      { type: import('@prisma/client').NotificationType; customerTitle: string; customerBody: string; proTitle: string; proBody: string }
    > = {
      confirm: {
        type: NotificationType.booking_confirmed,
        customerTitle: 'رزرو تأیید شد',
        customerBody: 'رزرو شما توسط زیباگر تأیید شد.',
        proTitle: 'رزرو تأیید شد',
        proBody: 'رزرو با موفقیت تأیید شد.',
      },
      reject: {
        type: NotificationType.booking_rejected,
        customerTitle: 'رزرو رد شد',
        customerBody: `درخواست رزرو شما رد شد.${reasonSuffix}`,
        proTitle: 'رزرو رد شد',
        proBody: 'رزرو رد شد.',
      },
      cancel: {
        type: NotificationType.booking_cancelled,
        customerTitle: 'رزرو لغو شد',
        customerBody: `رزرو لغو شد.${reasonSuffix}`,
        proTitle: 'رزرو لغو شد',
        proBody: `یک رزرو لغو شد.${reasonSuffix}`,
      },
      complete: {
        type: NotificationType.booking_completed,
        customerTitle: 'رزرو تکمیل شد',
        customerBody: 'رزرو شما تکمیل شد. از خدمات زیباجو سپاسگزاریم.',
        proTitle: 'رزرو تکمیل شد',
        proBody: 'رزرو به‌عنوان تکمیل‌شده ثبت شد.',
      },
    };
    const cfg = map[action];
    const data = { bookingId, action };
    if (customerId) {
      await this.notifications.notify({
        userId: customerId,
        type: cfg.type,
        title: cfg.customerTitle,
        body: cfg.customerBody,
        data,
        sms: true,
      });
    }
    if (professionalUserId) {
      await this.notifications.notify({
        userId: professionalUserId,
        type: cfg.type,
        title: cfg.proTitle,
        body: cfg.proBody,
        data,
        sms: action === 'cancel' || action === 'complete',
      });
    }
  }
}

