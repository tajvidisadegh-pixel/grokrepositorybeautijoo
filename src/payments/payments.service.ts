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

    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');

    const result = await this.provider.initiate({
      amountToman: payment.amount,
      description: `پرداخت رزرو ${bookingId}`,
      callbackUrl,
      metadata: { bookingId, paymentId: payment.id, userId },
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: result.providerRef,
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as object)
            : {}),
          authority: result.providerRef,
        },
      },
    });

    return {
      redirectUrl: result.redirectUrl,
      providerRef: result.providerRef,
      paymentId: payment.id,
    };
  }

  async handleCallback(providerRef: string, successHint?: boolean) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');

    if (payment.status === PaymentStatus.paid) {
      return { status: 'paid', bookingId: payment.bookingId, refId: providerRef };
    }

    const verified = await this.provider.verify(providerRef, payment.amount);
    if (!verified.ok) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.failed },
      });
      return { status: 'failed', bookingId: payment.bookingId };
    }

    const rateRow = await this.prisma.platformSetting.findUnique({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
    });
    const rate =
      rateRow?.value != null && Number.isFinite(Number(rateRow.value))
        ? Number(rateRow.value)
        : DEFAULT_PLATFORM_COMMISSION_RATE;
    const { commissionAmount, professionalNetAmount } = calculateCommission(
      payment.amount,
      rate,
    );

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.paid,
        paidAt: new Date(),
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

    // Finalize booking after successful payment (pending → confirmed)
    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
    });
    if (booking && (booking.status === 'pending' || booking.status === 'expired')) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'confirmed', confirmedAt: new Date() },
      });
    }

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
      amountToman: payment.amount,
      reason,
    });
    if (!result.ok) {
      throw new BadRequestException(result.message || 'استرداد ناموفق بود');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.refunded,
        refundedAt: new Date(),
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as object)
            : {}),
          refundReason: reason ?? null,
          refundedBy: adminUserId ?? null,
        },
      },
    });

    return { status: 'refunded', paymentId: payment.id };
  }

  async getByBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException();
    if (booking.customerId !== userId) throw new ForbiddenException();
    return this.prisma.payment.findUnique({ where: { bookingId } });
  }
}
