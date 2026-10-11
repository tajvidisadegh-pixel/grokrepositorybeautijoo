import {
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import {
  PaymentProvider,
  PaymentInitResult,
  PaymentVerifyResult,
} from './payment.provider';
import { randomUUID } from 'crypto';

function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Mock gateway for local development and automated tests only.
 * Hard-blocked in production so it can never create a fake PAID state.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  private assertNotProduction(op: string): void {
    if (isProduction()) {
      this.logger.error(`[MOCK PAY] blocked ${op} in production`);
      throw new ForbiddenException(
        'Mock payment در محیط production مجاز نیست',
      );
    }
  }

  async initiate(params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    this.assertNotProduction('initiate');
    const providerRef = `mock_${randomUUID()}`;
    this.logger.log(`[MOCK PAY] amount=${params.amount} booking=${params.bookingId}`);
    return {
      paymentId: params.idempotencyKey,
      providerRef,
      redirectUrl: `${params.callbackUrl}?ref=${providerRef}&status=ok`,
    };
  }

  async verify(providerRef: string, _amountToman?: number): Promise<PaymentVerifyResult> {
    if (isProduction()) {
      this.logger.error(`[MOCK PAY VERIFY] refused in production ref=${providerRef}`);
      return { success: false };
    }
    this.logger.log(`[MOCK PAY VERIFY] ref=${providerRef}`);
    return { success: true, refId: `mock_ref_${providerRef.slice(0, 8)}` };
  }

  async refund(params: {
    providerRef: string;
    amount: number;
    reason?: string;
  }) {
    this.assertNotProduction('refund');
    this.logger.log(
      `[MOCK PAY REFUND] ref=${params.providerRef} amount=${params.amount} reason=${params.reason ?? '-'}`,
    );
    return {
      success: true,
      refundRef: `mock_refund_${randomUUID()}`,
    };
  }
}
