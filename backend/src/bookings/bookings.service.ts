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
import {
  computeVariableTotals,
  normalizePricingMode,
  resolveOptionDeltas,
  type PricingMode,
} from '../services/pricing-mode';
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
  private maxBufferMin(items: Array<{bufferMin?: number|null; professionalService?: {bufferMin?: number|null}|null}>): number {
    let max=0; for (const it of items){ const v=it.professionalService?.bufferMin??it.bufferMin??0; if(typeof v==="number"&&v>max) max=v;} return Math.max(0,max); }
  private bookingRangesConflict(aStart:Date,aEnd:Date,aBufferMin:number,bStart:Date,bEnd:Date,bBufferMin:number): boolean {
    const aBusy=aEnd.getTime()+Math.max(0,aBufferMin)*60000; const bBusy=bEnd.getTime()+Math.max(0,bBufferMin)*60000; return aStart.getTime()<bBusy && bStart.getTime()<aBusy; }

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
      selectedOptionIds?: string[];
    },
  ) {
    if (!data.serviceIds?.length) throw new BadRequestException('حداقل یک خدمت لازم است');
    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('کاربر یافت نشد');
    if (!customer.phoneVerified) {
      throw new BadRequestException('قبل از رزرو باید شماره موبایل با کد یکبارمصرف تأیید شود');
    }
    {
      const proRow = await this.prisma.professional.findUnique({
        where: { id: data.professionalId },
        select: { socialLinks: true },
      });
      const sl = (proRow?.socialLinks || {}) as Record<string, unknown>;
      if (sl._pauseBookings === true) {
        throw new BadRequestException('این زیباگر فعلاً نوبت جدید نمی‌پذیرد.');
      }
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
        service: {
          include: {
            attributeGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (proServices.length !== data.serviceIds.length) {
      throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
    }
    const byServiceId = new Map(proServices.map((ps) => [ps.serviceId, ps]));
    const orderedServices = data.serviceIds.map((sid) => {
      const ps = byServiceId.get(sid);
      if (!ps) throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
      return ps;
    });
    const requestedAddOnIds = Array.from(new Set(data.addOnIds || []));
    const addOnById = new Map(
      orderedServices.flatMap((ps) =>
        ps.addOns.map((a) => [a.id, { ...a, professionalServiceId: ps.id }] as const),
      ),
    );
    for (const id of requestedAddOnIds) {
      if (!addOnById.has(id)) throw new BadRequestException('یکی از افزودنی‌های انتخاب‌شده معتبر یا فعال نیست');
    }
    if (data.priceRuleId) {
      const ok = orderedServices.some((ps) => ps.priceRules.some((r) => r.id === data.priceRuleId));
      if (!ok) throw new BadRequestException('قانون قیمت انتخاب‌شده معتبر نیست');
    }
    if (data.durationRuleId) {
      const ok = orderedServices.some((ps) => ps.durationRules.some((r) => r.id === data.durationRuleId));
      if (!ok) throw new BadRequestException('قانون زمان انتخاب‌شده معتبر نیست');
    }

    const lines = orderedServices.map((ps) => {
      let price = ps.price;
      let durationMin = ps.durationMin;
      let linePriceRuleId: string | null = null;
      let lineDurationRuleId: string | null = null;
      if (data.priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === data.priceRuleId);
        if (rule) { price = rule.price; linePriceRuleId = rule.id; }
      }
      if (data.durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === data.durationRuleId);
        if (rule) { durationMin = rule.durationMin; lineDurationRuleId = rule.id; }
      }
      const mode: PricingMode = normalizePricingMode(ps.pricingMode || 'fixed');
      let isDeposit = false;
      let selectedOptionsSnapshot: Array<{ optionId: string; groupId: string; label: string; priceDelta: number; durationDeltaMin: number }> = [];
      if (mode === 'variable') {
        const groups = ps.service?.attributeGroups || [];
        const selectedIds = new Set(data.selectedOptionIds || []);
        const deltas: Array<{ priceDelta: number; durationDeltaMin: number }> = [];
        for (const g of groups) {
          const opts = g.options || [];
          const picked = opts.filter((o) => selectedIds.has(o.id));
          if (g.required && picked.length === 0) throw new BadRequestException(`انتخاب «${g.name}» الزامی است`);
          for (const o of picked) {
            const resolved = resolveOptionDeltas(
              o.id,
              { priceDelta: o.suggestedPriceDelta ?? 0, durationDeltaMin: o.suggestedDurationDeltaMin ?? 0 },
              (ps.optionDeltas as Record<string, { priceDelta?: number; durationDeltaMin?: number; active?: boolean }> | null) || null,
            );
            if (!resolved.active) continue;
            deltas.push(resolved);
            selectedOptionsSnapshot.push({ optionId: o.id, groupId: g.id, label: o.label, priceDelta: resolved.priceDelta, durationDeltaMin: resolved.durationDeltaMin });
          }
        }
        const totals = computeVariableTotals(price, durationMin, deltas);
        price = totals.price;
        durationMin = totals.durationMin;
        const forces = selectedOptionsSnapshot.some((s) => {
          for (const g of groups) {
            const o = (g.options || []).find((x) => x.id === s.optionId);
            if (o && (o as { forcesDeposit?: boolean }).forcesDeposit) return true;
          }
          return false;
        });
        if (forces) {
          const dep = ps.depositAmount;
          if (dep == null || dep < 0) throw new BadRequestException('این انتخاب نیازمند بیعانه است؛ مبلغ بیعانه برای خدمت تنظیم نشده');
          price = dep;
          isDeposit = true;
        }
      } else if (mode === 'deposit') {
        const dep = ps.depositAmount;
        if (dep == null || dep < 0) throw new BadRequestException('مبلغ بیعانه برای این خدمت تنظیم نشده است');
        price = dep;
        isDeposit = true;
      }
      const addOns = requestedAddOnIds.map((id) => addOnById.get(id)).filter((a): a is NonNullable<typeof a> => !!a && a.professionalServiceId === ps.id);
      const addOnPrice = addOns.reduce((s, a) => s + a.price, 0);
      const addOnDur = addOns.reduce((s, a) => s + (a.extraDurationMin || 0), 0);
      return {
        serviceId: ps.serviceId,
        professionalServiceId: ps.id,
        durationMin: durationMin + addOnDur,
        price: price + addOnPrice,
        addOnsSnapshot: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        priceRuleId: linePriceRuleId,
        durationRuleId: lineDurationRuleId,
        pricingMode: mode,
        isDeposit,
        selectedOptions: selectedOptionsSnapshot.length ? selectedOptionsSnapshot : null,
      };
    });

    const totalDuration = lines.reduce((s, l) => s + l.durationMin, 0);
    const totalPrice = lines.reduce((s, l) => s + l.price, 0);
    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) throw new BadRequestException('زمان شروع نامعتبر است');
    {
      const minLead = parseInt(process.env.BOOKING_MIN_LEAD_HOURS || '4', 10);
      const hours = Number.isFinite(minLead) && minLead >= 0 ? minLead : 4;
      if (startAt.getTime() - Date.now() < hours * 3600_000) {
        throw new BadRequestException(hours === 0 ? 'زمان شروع نامعتبر است' : `حداقل ${hours} ساعت قبل از نوبت باید رزرو کنید.`);
      }
    }
    const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

    // #82.r3.2 — location must belong to this professional (prevent IDOR)
    if (data.locationId) {
      const owned = await this.prisma.professionalLocation.findFirst({
        where: { professionalId: data.professionalId, locationId: data.locationId },
        select: { locationId: true },
      });
      if (!owned) throw new BadRequestException('آدرس انتخاب‌شده متعلق به این زیباگر نیست');
    }

    const dateStr = tehranDateStr(startAt);
    const startHHMM = tehranHHMM(startAt);
    const newBufferMin = orderedServices.reduce((m, ps) => Math.max(m, ps.bufferMin ?? 0), 0);
    const avail = await this.availability.getSlots(data.professionalId, dateStr, totalDuration, newBufferMin);
    const normalizeHhmm = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(s).trim());
      if (!m) return s;
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    };
    const want = normalizeHhmm(startHHMM);
    const slotOk = avail.slots.some(
      (s: { start: string; end: string; available?: boolean }) => normalizeHhmm(s.start) === want && s.available !== false,
    );
    if (!slotOk) throw new ConflictException('این بازه زمانی در دسترس نیست');

    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM professionals WHERE id = ${data.professionalId}::uuid FOR UPDATE`;
          {
            const maxConcurrent = Math.max(1, parseInt(process.env.MAX_CONCURRENT_BOOKINGS || '3', 10) || 3);
            const activeCount = await tx.booking.count({
              where: {
                customerId,
                status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
                startAt: { gte: new Date() },
              },
            });
            if (activeCount >= maxConcurrent) {
              throw new BadRequestException(`حداکثر ${maxConcurrent} رزرو فعال همزمان مجاز است. ابتدا یکی از رزروهای قبلی را مدیریت کنید.`);
            }
          }
          const padMs = Math.max(newBufferMin, 180) * 60000;
          const candidates = await tx.booking.findMany({
            where: {
              professionalId: data.professionalId,
              status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
              startAt: { lt: new Date(endAt.getTime() + padMs) },
              endAt: { gt: new Date(startAt.getTime() - padMs) },
            },
            include: { items: { select: { professionalService: { select: { bufferMin: true } } } } },
          });
          for (const e of candidates) {
            if (this.bookingRangesConflict(startAt, endAt, newBufferMin, e.startAt, e.endAt, this.maxBufferMin(e.items))) {
              throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
            }
          }
          if (await tx.timeOff.count({ where: { professionalId: data.professionalId, startAt: { lt: endAt }, endAt: { gt: startAt } } })) {
            throw new ConflictException('این بازه زمانی در دسترس نیست');
          }
          if (await tx.manualReservation.count({ where: { professionalId: data.professionalId, startAt: { lt: endAt }, endAt: { gt: startAt } } })) {
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
                  pricingMode: line.pricingMode,
                  isDeposit: line.isDeposit,
                  selectedOptions: line.selectedOptions ? (line.selectedOptions as unknown as Prisma.InputJsonValue) : undefined,
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
              after: { status: b.status, totalPrice: b.totalPrice } as Prisma.InputJsonValue,
            },
          });
          return b;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 15_000 },
      );

      try {
        const payMode = (process.env.BOOKING_PAYMENT_MODE || 'auto').toString().trim().toLowerCase();
        const provider = (process.env.PAYMENT_PROVIDER || '').toString().trim().toLowerCase();
        const offline =
          payMode === 'offline' ||
          (payMode === 'auto' && (!provider || provider === 'disabled' || provider === 'none'));
        if (offline) {
          await this.notifications.notify({
            userId: pro.userId,
            type: NotificationType.booking_request,
            title: 'رزرو جدید',
            body: 'یک مشتری نوبت رزرو کرده است.',
            data: { bookingId: booking.id, customerId, professionalId: data.professionalId, href: `/zibagar/bookings?focus=${booking.id}` },
            sms: true,
          });
          await this.notifications.notify({
            userId: customerId,
            type: NotificationType.booking_request,
            title: 'رزرو ثبت شد',
            body: 'رزرو شما با موفقیت ثبت شد.',
            data: { bookingId: booking.id, professionalId: data.professionalId },
            sms: false,
          });
        } else {
          await this.notifications.notify({
            userId: pro.userId,
            type: NotificationType.booking_request,
            title: 'درخواست رزرو (در انتظار پرداخت)',
            body: 'یک مشتری نوبت رزرو کرده و در حال پرداخت است. تا تأیید پرداخت، نوبت قطعی نیست.',
            data: { bookingId: booking.id, customerId, professionalId: data.professionalId, href: `/zibagar/bookings?focus=${booking.id}` },
            sms: true,
          });
          await this.notifications.notify({
            userId: customerId,
            type: NotificationType.booking_request,
            title: 'رزرو در انتظار پرداخت',
            body: 'رزرو شما ثبت شد. پس از پرداخت موفق، نوبت قطعی می‌شود.',
            data: { bookingId: booking.id, professionalId: data.professionalId },
            sms: false,
          });
        }
      } catch (err) {
        this.logger.warn(`post-create notify failed booking=${booking.id}: ${(err as Error)?.message || err}`);
      }
      
      try {
        const payMode = (process.env.BOOKING_PAYMENT_MODE || 'auto').toString().trim().toLowerCase();
        const provider = (process.env.PAYMENT_PROVIDER || '').toString().trim().toLowerCase();
        const offline = payMode === 'offline' || payMode === 'no_gateway' || payMode === 'pay_later' || (payMode === 'auto' && (!provider || provider === 'disabled' || provider === 'none'));
        if (offline) {
          await this.payments.initiate(customerId, booking.id, 'https://localhost/offline');
          const refreshed = await this.prisma.booking.findUnique({ where: { id: booking.id }, include: { items: true, payment: true } });
          if (refreshed) return refreshed;
        }
      } catch (err) {
        this.logger.warn('offline auto-confirm failed: ' + ((err as Error)?.message || err));
      }
return booking;
    } catch (e: unknown) {
      if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
      const err = e as { code?: string; message?: string };
      const msg = String(err?.message ?? e ?? '');
      if (err?.code === 'P2004' || /bookings_no_overlap/i.test(msg)) {
        throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
      }
      throw e;
    }
  }

  async listMineAsCustomer(userId: string, page = 1, limit = 20, status?: string) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
    const skip = (safePage - 1) * safeLimit;
    const where: { customerId: string; status?: BookingStatus } = { customerId: userId };
    if (status) {
      const allowed = Object.values(BookingStatus) as string[];
      if (!allowed.includes(status)) throw new BadRequestException('وضعیت رزرو نامعتبر است');
      where.status = status as BookingStatus;
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { startAt: 'desc' },
        include: {
          professional: { select: { id: true, title: true, slug: true } },
          items: true,
          payment: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page: safePage, limit: safeLimit, total } };
  }

  async listMineAsProfessional(userId: string, query: ProBookingListQuery = {}) {
    const pageRaw = query.page ?? 1;
    const limitRaw = query.limit ?? 20;
    const safePage = Number.isFinite(pageRaw as number) && (pageRaw as number) > 0 ? Math.floor(pageRaw as number) : 1;
    const safeLimit = Number.isFinite(limitRaw as number) && (limitRaw as number) > 0 ? Math.min(Math.floor(limitRaw as number), 100) : 20;
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    if (!pro) throw new ForbiddenException('حساب زیباگر یافت نشد');
    const where: Prisma.BookingWhereInput = { professionalId: pro.id };
    if (query.status) {
      const allowed = Object.values(BookingStatus) as string[];
      if (!allowed.includes(query.status)) throw new BadRequestException('وضعیت رزرو نامعتبر است');
      where.status = query.status as BookingStatus;
    }
    if (query.from || query.to) {
      where.startAt = {};
      if (query.from) { const from = new Date(query.from); if (isNaN(from.getTime())) throw new BadRequestException("invalid from"); (where.startAt as any).gte = from; }
      if (query.to) { const to = new Date(query.to); if (isNaN(to.getTime())) throw new BadRequestException("invalid to"); (where.startAt as any).lte = to; }
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: { select: { id: true, profile: { select: { displayName: true } } } },
          items: true,
          payment: true,
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page: safePage, limit: safeLimit, total } };
  }

  async getOne(id: string, userId: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true,
        location: true,
        professional: { select: { id: true, title: true, slug: true, userId: true } },
        customer: { select: { id: true, profile: { select: { displayName: true } } } },
      },
    });
    if (!b) throw new NotFoundException();
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    const isPro = pro?.id === b.professionalId;
    const isCustomer = b.customerId === userId;
    if (!isPro && !isCustomer) throw new ForbiddenException();
    return b;
  }

  async reschedule(id: string, userId: string, startAtIso: string) {
    const startAt = new Date(startAtIso);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) throw new BadRequestException('زمان شروع نامعتبر است');
    {
      const minLead = parseInt(process.env.BOOKING_MIN_LEAD_HOURS || '4', 10);
      const hours = Number.isFinite(minLead) && minLead >= 0 ? minLead : 4;
      if (startAt.getTime() - Date.now() < hours * 3600_000) {
        throw new BadRequestException(hours === 0 ? 'زمان شروع نامعتبر است' : `حداقل ${hours} ساعت قبل از نوبت باید رزرو کنید.`);
      }
    }
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { items: { include: { professionalService: true } }, payment: true },
    });
    if (!existing) throw new NotFoundException();
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    const isPro = pro?.id === existing.professionalId;
    const isCustomer = existing.customerId === userId;
    if (!isPro && !isCustomer) throw new ForbiddenException();
    if (!([BookingStatus.pending, BookingStatus.confirmed] as BookingStatus[]).includes(existing.status)) {
      throw new BadRequestException('این رزرو قابل تغییر زمان نیست');
    }
    const totalDuration = existing.items.reduce((s, it) => s + (it.durationMin || 0), 0) || 30;
    const endAt = new Date(startAt.getTime() + totalDuration * 60_000);
    const newBufferMin = this.maxBufferMin(existing.items as any);
    const dateStr = tehranDateStr(startAt);
    const startHHMM = tehranHHMM(startAt);
    const avail = await this.availability.getSlots(existing.professionalId, dateStr, totalDuration, newBufferMin);
    const normalizeHhmm = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(s).trim());
      if (!m) return s;
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    };
    const want = normalizeHhmm(startHHMM);
    const slotOk = avail.slots.some(
      (s: { start: string; available?: boolean }) => normalizeHhmm(s.start) === want && s.available !== false,
    );
    if (!slotOk) throw new ConflictException('این بازه زمانی در دسترس نیست');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM professionals WHERE id = ${existing.professionalId}::uuid FOR UPDATE`;
        const padMs = Math.max(newBufferMin, 180) * 60000;
        const candidates = await tx.booking.findMany({
          where: {
            professionalId: existing.professionalId,
            id: { not: id },
            status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
            startAt: { lt: new Date(endAt.getTime() + padMs) },
            endAt: { gt: new Date(startAt.getTime() - padMs) },
          },
          include: { items: { select: { professionalService: { select: { bufferMin: true } } } } },
        });
        for (const e of candidates) {
          if (this.bookingRangesConflict(startAt, endAt, newBufferMin, e.startAt, e.endAt, this.maxBufferMin(e.items as any))) {
            throw new ConflictException('این بازه زمانی قبلاً رزرو شده است');
          }
        }
        if (await tx.timeOff.count({ where: { professionalId: existing.professionalId, startAt: { lt: endAt }, endAt: { gt: startAt } } })) {
          throw new ConflictException('این بازه زمانی در دسترس نیست');
        }
        if (await tx.manualReservation.count({ where: { professionalId: existing.professionalId, startAt: { lt: endAt }, endAt: { gt: startAt } } })) {
          throw new ConflictException('این بازه زمانی در دسترس نیست');
        }
        return tx.booking.update({ where: { id }, data: { startAt, endAt }, include: { items: true, payment: true } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 15_000 },
    );
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
      throw new BadRequestException(
        action === 'confirm'
          ? 'تأیید دستی لازم نیست. پس از پرداخت موفق، نوبت به‌صورت خودکار قطعی است.'
          : 'رد نوبت توسط زیباگر مجاز نیست. در صورت مشکل از پشتیبانی تیکت ثبت کنید.',
      );
    }

    if (action === 'cancel') {
      if (!isPro && !isCustomer) throw new ForbiddenException();
      const paid = b.payment?.status === 'paid' || (b.payment as { status?: string } | null)?.status === 'paid';
      if (isPro && !isCustomer && paid) {
        throw new BadRequestException('لغو نوبت پرداخت‌شده توسط زیباگر مجاز نیست. لطفاً از پشتیبانی تیکت ثبت کنید.');
      }
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) throw new BadRequestException('این رزرو قابل لغو نیست');
      {
        const freeH = parseInt(process.env.BOOKING_FREE_CANCEL_HOURS || '24', 10);
        const hours = Number.isFinite(freeH) && freeH >= 0 ? freeH : 24;
        const msLeft = b.startAt.getTime() - Date.now();
        const withinFreeWindow = msLeft >= hours * 3600_000;
        if (isCustomer && paid && b.payment?.id) {
          if (!withinFreeWindow && hours > 0) {
            const updated = await this.prisma.booking.update({
              where: { id },
              data: {
                status: BookingStatus.cancelled,
                cancelReason:
                  (reason?.trim() || 'لغو دیرهنگام توسط مشتری') +
                  ` (خارج از پنجره لغو رایگان ${hours} ساعته — استرداد خودکار انجام نشد)`,
                cancelledAt: new Date(),
                notes: [b.notes, 'REFUND_POLICY:late_cancel_no_auto_refund'].filter(Boolean).join(' | ').slice(0, 2000),
              },
            });
            try {
              await this.prisma.auditLog.create({
                data: {
                  actorId: userId,
                  action: 'booking.cancel.late_no_refund',
                  entityType: 'booking',
                  entityId: id,
                  after: { paymentId: b.payment?.id, paymentStatus: b.payment?.status, freeCancelHours: hours } as any,
                },
              });
            } catch { /* non-blocking */ }
            try {
              await this.notifications.notify({
                userId: b.customerId,
                type: NotificationType.system,
                title: 'لغو نوبت (بدون استرداد خودکار)',
                body: `رزرو لغو شد. به‌دلیل لغو خارج از پنجره ${hours} ساعته، استرداد خودکار انجام نشد. در صورت نیاز با پشتیبانی تماس بگیرید.`,
                data: { bookingId: id, href: `/dashboard/bookings?focus=${id}` },
                sms: false,
              });
            } catch { /* non-blocking */ }
            return updated;
          }
          try {
            await this.payments.refund(b.payment.id, reason?.trim() || 'لغو توسط مشتری', userId);
          } catch (err) {
            this.logger.warn(`customer paid cancel refund failed booking=${id}: ${(err as Error)?.message || err}`);
            try {
              await this.prisma.booking.update({
                where: { id },
                data: { notes: [b.notes, 'REFUND_PENDING:cancel_refund_failed'].filter(Boolean).join(' | ').slice(0, 2000) },
              });
              await this.prisma.auditLog.create({
                data: {
                  actorId: userId,
                  action: 'booking.cancel.refund_failed',
                  entityType: 'booking',
                  entityId: id,
                  after: { paymentId: b.payment?.id, error: String((err as Error)?.message || err).slice(0, 300) } as any,
                },
              });
            } catch { /* non-blocking */ }
            throw new BadRequestException('استرداد پرداخت ناموفق بود. رزرو لغو نشد؛ لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید.');
          }
          return this.prisma.booking.findUniqueOrThrow({ where: { id } });
        }
      }
      return this.prisma.booking.update({
        where: { id },
        data: { status: BookingStatus.cancelled, cancelReason: reason ?? null, cancelledAt: new Date() },
      });
    }

    if (action === 'complete') {
      if (!isPro) throw new ForbiddenException();
      if (b.status !== BookingStatus.confirmed) throw new BadRequestException('complete requires confirmed booking');
      const paid = b.payment?.status === 'paid' || (b.payment as { status?: string } | null)?.status === 'paid';
      if (!paid) throw new BadRequestException('complete requires paid booking');
      return this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.completed, completedAt: new Date() } });
    }

    if (action === 'no_show') {
      if (!isPro) throw new ForbiddenException();
      if (!([BookingStatus.pending, BookingStatus.confirmed] as BookingStatus[]).includes(b.status)) {
        throw new BadRequestException('این رزرو قابل ثبت عدم حضور نیست');
      }
      return this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.no_show, cancelReason: null } });
    }
    throw new BadRequestException('action invalid');
  }

  async reportIssue(id: string, userId: string, message?: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    const pro = await this.prisma.professional.findFirst({ where: { userId } });
    const isPro = pro?.id === b.professionalId;
    const isCustomer = b.customerId === userId;
    if (!isPro && !isCustomer) throw new ForbiddenException();
    const oneHourAgo = new Date(Date.now() - 3600_000);
    const recent = await this.prisma.auditLog.count({
      where: { action: 'booking.report_issue', entityType: 'booking', entityId: id, createdAt: { gt: oneHourAgo } },
    });
    if (recent >= 3) {
      throw new BadRequestException('تعداد گزارش‌های این رزرو در یک ساعت بیش از حد مجاز است. لطفاً بعداً تلاش کنید.');
    }
    const admins = await this.prisma.user.findMany({
      where: { userRoles: { some: { role: { name: { in: ['admin', 'SUPER_ADMIN'] } } } } },
      select: { id: true },
          });
    let notified = 0;
    for (const a of admins) {
      try {
        await this.notifications.notify({
          userId: a.id,
          type: NotificationType.system,
          title: 'گزارش مشکل رزرو',
          body: message?.slice(0, 500) || 'گزارش بدون متن',
          data: { bookingId: id, reporterId: userId, reporterRole: isPro ? 'professional' : 'customer' },
          sms: false,
        });
        notified += 1;
      } catch (err) {
        this.logger.warn(`reportIssue notify failed admin=${a.id} booking=${id}: ${(err as Error)?.message || err}`);
      }
    }
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'booking.report_issue',
          entityType: 'booking',
          entityId: id,
          after: { message: message?.slice(0, 200), reporterRole: isPro ? 'professional' : 'customer', notified } as any,
        },
      });
    } catch { /* non-blocking */ }
    return { message: 'گزارش برای سوپرادمین ارسال شد', notified };
  }
}
