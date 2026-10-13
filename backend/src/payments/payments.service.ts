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
import { BookingStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private providerName(): string {
    return this.provider.name || 'disabled';
  }

  /**
   * #64.2 — If gateway is off or initiate fails, do not leave a pending
   * booking locking the professional calendar. Cancel unpaid pending only
   * (never touch paid bookings).
   */
  private async releaseUnpaidPendingBooking(
    bookingId: string,
    reason: string,
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) return;
    if (booking.payment?.status === PaymentStatus.paid) return;
    if (booking.status !== BookingStatus.pending) return;

    // After paid-guard above, payment is unpaid/absent — cancel payment row if any
    if (booking.payment) {
      await this.prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: PaymentStatus.cancelled,
          failedAt: new Date(),
        },
      });
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.expired,
        cancelReason: reason.slice(0, 255),
        cancelledAt: new Date(),
      },
    });
  }

  async initiate(userId: string, bookingId: string, callbackUrl: string) {
    const providerKey = this.providerName();
    if (providerKey === 'disabled') {
      // #64.2 — gateway off: free the slot, then surface error
      await this.releaseUnpaidPendingBooking(
        bookingId,
        'payment_provider_disabled',
      );
      throw new ServiceUnavailableException(
        'پرداخت آنلاین در حال حاضر فعال نیست. درگاه واقعی پیکربندی نشده است. رزرو نگه‌داشته نشد.',
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException();
    if (booking.customerId !== userId) throw new ForbiddenException();
    if (booking.status === BookingStatus.expired || booking.status === BookingStatus.cancelled) {
      throw new BadRequestException('این رزرو دیگر قابل پرداخت نیست');
    }
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

    try {
      const result = await this.provider.initiate({
        amount: booking.totalPrice,
        bookingId,
        idempotencyKey,
        callbackUrl,
      });

      if (!result?.redirectUrl && !result?.providerRef) {
        await this.releaseUnpaidPendingBooking(
          bookingId,
          'payment_initiate_no_redirect',
        );
        throw new ServiceUnavailableException(
          'لینک درگاه دریافت نشد. رزرو نگه‌داشته نشد؛ دوباره تلاش کنید.',
        );
      }

      await this.prisma.payment.update({
        where: { bookingId },
        data: {
          providerRef: result.providerRef,
          status: 'processing',
          provider: providerKey,
        },
      });

      return result;
    } catch (e) {
      if (
        e instanceof ServiceUnavailableException ||
        e instanceof BadRequestException ||
        e instanceof ConflictException ||
        e instanceof ForbiddenException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      // #64.2 — provider/network failure: release calendar hold
      await this.releaseUnpaidPendingBooking(
        bookingId,
        'payment_initiate_failed',
      );
      throw new ServiceUnavailableException(
        'شروع پرداخت ناموفق بود. رزرو نگه‌داشته نشد؛ بعداً دوباره تلاش کنید.',
      );
    }
  }

  async callback(providerRef: string, gatewayStatus?: string) {
    if (!providerRef) throw new BadRequestException('شناسه تراکنش درگاه ارسال نشده');

    if (gatewayStatus && gatewayStatus.toUpperCase() === 'NOK') {
      const payment = await this.prisma.payment.findFirst({ where: { providerRef } });
      if (payment && payment.status !== PaymentStatus.paid) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.failed },
        });
        // #64.2 — user cancelled at gateway: free unpaid pending slot
        await this.releaseUnpaidPendingBooking(
          payment.bookingId,
          'gateway_user_cancel',
        );
      }
      return { status: 'failed', bookingId: payment?.bookingId };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerRef },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('تراکنش یافت نشد');

    if (payment.status === PaymentStatus.paid) {
      return { status: 'paid', bookingId: payment.bookingId, refId: providerRef };
    }

    if (process.env.NODE_ENV === 'production' && this.providerName() === 'mock') {
      throw new BadRequestException('mock payment is not allowed in production');
    }

    const verified = await this.provider.verify(providerRef, payment.amount);
    if (!verified.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.failed },
      });
      await this.releaseUnpaidPendingBooking(
        payment.bookingId,
        'payment_verify_failed',
      );
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

    if (payment.booking && ['pending', 'confirmed'].includes(payment.booking.status)) {
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
