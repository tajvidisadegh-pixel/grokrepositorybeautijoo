import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentInitResult,
  PaymentVerifyResult,
} from './payment.provider';

/**
 * Production-safe provider used when no real gateway is configured.
 * Online payment is disabled; never marks anything as paid.
 */
@Injectable()
export class DisabledPaymentProvider implements PaymentProvider {
  readonly name = 'disabled';
  private readonly logger = new Logger(DisabledPaymentProvider.name);

  private refuse(op: string): never {
    this.logger.warn(`[PAYMENT DISABLED] blocked ${op} — no real provider in production`);
    throw new ServiceUnavailableException(
      'پرداخت آنلاین در حال حاضر فعال نیست. درگاه واقعی پیکربندی نشده است.',
    );
  }

  async initiate(_params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    this.refuse('initiate');
  }

  async verify(_providerRef: string, _amountToman?: number): Promise<PaymentVerifyResult> {
    // Never succeed — no fake PAID in production
    this.logger.warn('[PAYMENT DISABLED] verify refused');
    return { success: false };
  }

  async refund(_params: {
    providerRef: string;
    amount: number;
    reason?: string;
  }): Promise<{ success: boolean; refundRef?: string }> {
    this.refuse('refund');
  }
}
