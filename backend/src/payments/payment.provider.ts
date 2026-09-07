export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentInitResult {
  paymentId: string;
  redirectUrl?: string;
  providerRef?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  amount?: number;
  /** Gateway reference id (e.g. Zarinpal ref_id) */
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
   * @param providerRef  Authority / transaction id from gateway
   * @param amountToman  Original amount in TOMAN (required by Zarinpal)
   */
  verify(
    providerRef: string,
    amountToman?: number,
  ): Promise<PaymentVerifyResult>;

  /**
   * Request a refund for a previously successful payment.
   * Mock always succeeds; Zarinpal needs ZARINPAL_ACCESS_TOKEN.
   */
  refund(params: {
    providerRef: string;
    amount: number;
    reason?: string;
  }): Promise<{ success: boolean; refundRef?: string }>;
}
