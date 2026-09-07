import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentInitResult, PaymentVerifyResult } from './payment.provider';

/**
 * Zarinpal payment gateway (API v4).
 * Amounts in DB are TOMAN; Zarinpal expects Rials → we multiply by 10.
 *
 * Env:
 *   ZARINPAL_MERCHANT_ID   (required when PAYMENT_PROVIDER=zarinpal)
 *   ZARINPAL_SANDBOX       ("true" for sandbox)
 *   ZARINPAL_ACCESS_TOKEN  (optional; required for gateway refund)
 */
@Injectable()
export class ZarinpalPaymentProvider implements PaymentProvider {
  readonly name = 'zarinpal';
  private readonly logger = new Logger(ZarinpalPaymentProvider.name);
  private readonly merchantId: string;
  private readonly sandbox: boolean;
  private readonly accessToken: string;
  private readonly baseApi: string;
  private readonly startPayBase: string;

  constructor(private readonly config: ConfigService) {
    this.merchantId = (
      process.env.ZARINPAL_MERCHANT_ID ||
      this.config.get<string>('zarinpalMerchantId') ||
      ''
    ).trim();
    this.sandbox =
      (process.env.ZARINPAL_SANDBOX || this.config.get<string>('zarinpalSandbox') || 'false')
        .toLowerCase() === 'true';
    this.accessToken = (
      process.env.ZARINPAL_ACCESS_TOKEN ||
      this.config.get<string>('zarinpalAccessToken') ||
      ''
    ).trim();

    if (this.sandbox) {
      this.baseApi = 'https://sandbox.zarinpal.com/pg/v4/payment';
      this.startPayBase = 'https://sandbox.zarinpal.com/pg/StartPay';
    } else {
      this.baseApi = 'https://payment.zarinpal.com/pg/v4/payment';
      this.startPayBase = 'https://www.zarinpal.com/pg/StartPay';
    }

    if (!this.merchantId) {
      this.logger.warn(
        'ZARINPAL_MERCHANT_ID is empty — payment requests will fail until configured',
      );
    }
  }

  /** Convert TOMAN (DB) → Rials (Zarinpal). */
  private toRials(toman: number): number {
    return Math.round(toman * 10);
  }

  async initiate(params: {
    amount: number;
    bookingId: string;
    idempotencyKey: string;
    callbackUrl: string;
  }): Promise<PaymentInitResult> {
    if (!this.merchantId) {
      throw new BadRequestException(
        'درگاه زرین‌پال پیکربندی نشده است (ZARINPAL_MERCHANT_ID)',
      );
    }

    const amountRials = this.toRials(params.amount);
    if (amountRials < 1000) {
      throw new BadRequestException('حداقل مبلغ پرداخت ۱۰۰۰ ریال است');
    }

    const body = {
      merchant_id: this.merchantId,
      amount: amountRials,
      callback_url: params.callbackUrl,
      description: `پرداخت رزرو ${params.bookingId}`,
      metadata: {
        order_id: params.idempotencyKey,
        booking_id: params.bookingId,
      },
    };

    this.logger.log(
      `[ZARINPAL REQUEST] booking=${params.bookingId} amountToman=${params.amount} rials=${amountRials} sandbox=${this.sandbox}`,
    );

    const res = await fetch(`${this.baseApi}/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      data?: { code?: number; authority?: string; message?: string; fee?: number };
      errors?: { code?: number; message?: string } | unknown[];
    };

    const code = json.data?.code;
    const authority = json.data?.authority;

    if (code !== 100 || !authority) {
      const errMsg =
        (json.errors as { message?: string })?.message ||
        json.data?.message ||
        `Zarinpal request failed (code=${code ?? 'unknown'})`;
      this.logger.error(`[ZARINPAL REQUEST FAIL] ${errMsg} body=${JSON.stringify(json)}`);
      throw new BadRequestException(`خطا در ایجاد تراکنش درگاه: ${errMsg}`);
    }

    return {
      paymentId: params.idempotencyKey,
      providerRef: authority,
      redirectUrl: `${this.startPayBase}/${authority}`,
    };
  }

  async verify(providerRef: string, amountToman?: number): Promise<PaymentVerifyResult> {
    if (!this.merchantId) {
      return { success: false };
    }

    const amountRials = this.toRials(amountToman ?? 0);
    if (!amountRials) {
      this.logger.error('[ZARINPAL VERIFY] amount missing');
      return { success: false };
    }

    const body = {
      merchant_id: this.merchantId,
      amount: amountRials,
      authority: providerRef,
    };

    this.logger.log(`[ZARINPAL VERIFY] authority=${providerRef} rials=${amountRials}`);

    const res = await fetch(`${this.baseApi}/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      data?: {
        code?: number;
        ref_id?: number;
        message?: string;
        card_pan?: string;
      };
      errors?: { message?: string };
    };

    const code = json.data?.code;
    // 100 = success first time, 101 = already verified
    if (code === 100 || code === 101) {
      return {
        success: true,
        amount: amountToman,
        refId: json.data?.ref_id != null ? String(json.data.ref_id) : undefined,
      };
    }

    this.logger.warn(
      `[ZARINPAL VERIFY FAIL] code=${code} msg=${json.data?.message || json.errors?.message}`,
    );
    return { success: false };
  }

  async refund(params: {
    providerRef: string;
    amount: number;
    reason?: string;
  }) {
    if (!this.accessToken) {
      this.logger.warn(
        '[ZARINPAL REFUND] ZARINPAL_ACCESS_TOKEN not set — gateway refund unavailable',
      );
      return { success: false, refundRef: undefined };
    }

    const body = {
      merchant_id: this.merchantId,
      authority: params.providerRef,
      amount: this.toRials(params.amount),
      description: params.reason || 'استرداد رزرو Beautijoo',
    };

    try {
      const res = await fetch(`${this.baseApi}/refund.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: { code?: number; id?: string; message?: string };
        errors?: { message?: string };
      };
      if (json.data?.code === 100) {
        return {
          success: true,
          refundRef: json.data.id || `zp_refund_${params.providerRef}`,
        };
      }
      this.logger.error(`[ZARINPAL REFUND FAIL] ${JSON.stringify(json)}`);
      return { success: false };
    } catch (e) {
      this.logger.error(`[ZARINPAL REFUND ERROR] ${(e as Error).message}`);
      return { success: false };
    }
  }
}
