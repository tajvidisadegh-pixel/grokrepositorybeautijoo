export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentInitResult {
  paymentId: string;
  redirectUrl?: string;
  providerRef?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  amount?: number;
  /** Gateway reference id from the active provider */
  refId?: string;
}

export interface PaymentProvider {
  /** Human-readable provider key stored on Payment.provider column */
  readonly name?: string;

  initiate(params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult>;

  /**
   * Verify a payment after user returns from gateway.
   * Real providers must validate amount, transaction id, and provider-specific security rules.
   * @param providerRef  Authority / transaction id from gateway
   * @param amountToman  Original amount in TOMAN (when required by the gateway)
   */
  verify(
    providerRef: string,
    amountToman?: number,
  ): Promise<PaymentVerifyResult>;

  /**
   * Request a refund for a previously successful payment.
   * Behavior is provider-specific; mock is blocked in production.
   */
  refund(params: {
    providerRef: string;
    amount: number;
    reason?: string;
  }): Promise<{ success: boolean; refundRef?: string }>;
}
