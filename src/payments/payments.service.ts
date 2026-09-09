import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { randomUUID } from 'crypto';
import {
  calculateCommission,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_RATE_KEY,
} from './financial.util';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private providerName(): string {
    return this.provider.name || 'disabled';
  }

  async initiate(userId: string, bookingId: string, callbackUrl: string) {
    const providerKey = this.providerName();
    if (providerKey === 'disabled') {
      throw new ServiceUnavailableException(
        'پرداخت آنلاین در حال حاضر فعال نیست. درگاه واقعی پیکربندی نشده است.',
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException();
    if (booking.customerId !== userId) throw new ForbiddenException();
    if (booking.payment?.status === 'paid') throw new ConflictException('قبلاً پرداخت شده');

    const idempotencyKey = booking.payment?.idempotencyKey || randomUUID();

    if (!booking.payment) {
      await this.prisma.payment.create({
        data: {
          bookingId,
          amount: booking.totalPrice,
          status: 'pending',
          provider: providerKey,
          idempotencyKey,
        },
      });
    }

    const result = await this.provider.initiate({
      amount: booking.totalPrice,
      bookingId,
      idempotencyKey,
      callbackUrl,
    });

    await this.prisma.payment.update({
      where: { bookingId },
      data: {
        providerRef: result.providerRef,
        status: 'processing',
        provider: providerKey,
      },
    });

    return result;
  }

  /**
   * Gateway callback (provider-agnostic query params).
   * Mock callbacks are refused in production.
   */
  async callback(providerRef: string, gatewayStatus?: string) {
    if (!providerRef) throw new BadRequestException('شناسه تراکنش درگاه ارسال نشده');

    // Provider user-cancel (e.g. Status=NOK)
    if (gatewayStatus && gatewayStatus.toUpperCase() === 'NOK') {
      const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
      if (payment && payment.status !== 'paid') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'cancelled' },
        });
      }
      return { status: 'cancelled', bookingId: payment?.bookingId ?? null };
    }

    const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');

    // Idempotency: already paid → do not recompute commission snapshot
    if (payment.status === 'paid') {
      return { status: 'paid', bookingId: payment.bookingId };
    }

    // Hard guard: never accept mock (or missing real provider) as PAID in production
    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const storedProvider = (payment.provider || '').toLowerCase();
    if (isProd && (storedProvider === 'mock' || storedProvider === 'disabled' || !storedProvider)) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failedAt: new Date() },
      });
      throw new BadRequestException(
        'تأیید پرداخت در production با ارائه‌دهنده غیرواقعی مجاز نیست',
      );
    }

    const verified = await this.provider.verify(providerRef, payment.amount);
    if (!verified.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failedAt: new Date() },
      });
      return { status: 'failed', bookingId: payment.bookingId };
    }

    let rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (setting && setting.value !== null && setting.value !== undefined) {
        const val =
          typeof setting.value === 'number'
            ? setting.value
            : typeof setting.value === 'object' && 'rate' in (setting.value as any)
              ? Number((setting.value as any).rate)
              : Number(setting.value);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          rate = val;
        }
      }
    } catch {
      rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    }

    const { commissionRate, commissionAmount, professionalNetAmount } = calculateCommission(
      payment.amount,
      rate,
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        platformCommissionRate: commissionRate,
        platformCommissionAmount: commissionAmount,
        professionalNetAmount: professionalNetAmount,
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as object)
            : {}),
          gatewayRefId: verified.refId ?? null,
        },
      },
    });
    return { status: 'paid', bookingId: payment.bookingId, refId: verified.refId };
  }

  async refund(paymentId: string, reason?: string, adminUserId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');
    if (payment.status !== PaymentStatus.paid) {
      throw new BadRequestException(
        `فقط تراکنش‌های پرداخت‌شده قابل استرداد هستند (وضعیت فعلی: ${payment.status})`,
      );
    }
    if (!payment.providerRef) {
      throw new BadRequestException('شناسه ارائه‌دهنده پرداخت موجود نیست');
    }

    const result = await this.provider.refund({
      providerRef: payment.providerRef,
      amount: payment.amount,
      reason,
    });

    if (!result.success) {
      throw new BadRequestException('استرداد توسط درگاه پرداخت ناموفق بود');
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.refunded,
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as object)
            : {}),
          refund: {
            refundRef: result.refundRef,
            reason: reason ?? null,
            refundedAt: new Date().toISOString(),
            refundedBy: adminUserId ?? null,
          },
        },
      },
    });

    if (
      payment.booking &&
      ['pending', 'confirmed'].includes(payment.booking.status)
    ) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'cancelled',
          cancelReason: reason ?? 'استرداد پرداخت',
          cancelledAt: new Date(),
        },
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      amount: updated.amount,
      refundRef: result.refundRef,
      reason: reason ?? null,
    };
  }
}
