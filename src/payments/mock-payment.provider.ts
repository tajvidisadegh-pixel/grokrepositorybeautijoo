import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider, PaymentInitResult, PaymentVerifyResult } from './payment.provider';
import { randomUUID } from 'crypto';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  async initiate(params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    const providerRef = `mock_${randomUUID()}`;
    this.logger.log(`[MOCK PAY] amount=${params.amount} booking=${params.bookingId}`);
    return {
      paymentId: params.idempotencyKey,
      providerRef,
      redirectUrl: `${params.callbackUrl}?ref=${providerRef}&status=ok`,
    };
  }

  async verify(providerRef: string, _amountToman?: number): Promise<PaymentVerifyResult> {
    this.logger.log(`[MOCK PAY VERIFY] ref=${providerRef}`);
    return { success: true, refId: `mock_ref_${providerRef.slice(0, 8)}` };
  }

  async refund(params: {
    providerRef: string;
    amount: number;
    reason?: string;
  }) {
    this.logger.log(
      `[MOCK PAY REFUND] ref=${params.providerRef} amount=${params.amount} reason=${params.reason ?? '-'}`,
    );
    return {
      success: true,
      refundRef: `mock_refund_${randomUUID()}`,
    };
  }
}
