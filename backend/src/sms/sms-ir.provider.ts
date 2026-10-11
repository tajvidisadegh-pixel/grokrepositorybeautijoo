import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

export type SmsIrConfig = {
  apiKey: string;
  /** Template id from SMS.ir panel (verify / OTP). */
  otpTemplateId: number;
  /** Parameter name inside the template, e.g. CODE or VerificationCode. */
  otpParamName: string;
  /** Sender line for free-text notifications (optional). */
  lineNumber?: string;
  baseUrl?: string;
};

/**
 * SMS.ir REST client — secrets only from env/config, never hardcoded.
 * OTP: POST /v1/send/verify
 * Notifications: POST /v1/send (line + message text)
 * Docs: https://sms.ir/rest-api/
 */
@Injectable()
export class SmsIrProvider implements SmsProvider {
  private readonly logger = new Logger(SmsIrProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly cfg: SmsIrConfig) {
    this.baseUrl = (cfg.baseUrl || 'https://api.sms.ir').replace(/\/$/, '');
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const mobile = normalizeIranMobile(phone);
    const body = {
      mobile,
      templateId: this.cfg.otpTemplateId,
      parameters: [
        {
          name: this.cfg.otpParamName,
          value: code,
        },
      ],
    };

    await this.postJson('/v1/send/verify', body, 'OTP');
    // Never log the OTP code itself.
    this.logger.log(`OTP SMS accepted by SMS.ir for ${maskPhone(mobile)}`);
  }

  async sendNotification(phone: string, message: string): Promise<void> {
    const mobile = normalizeIranMobile(phone);
    const line = (this.cfg.lineNumber || '').trim();
    if (!line) {
      this.logger.warn(
        `SMSIR_LINE_NUMBER not set — skipping free-text SMS to ${maskPhone(mobile)}`,
      );
      return;
    }

    const body = {
      lineNumber: Number.isFinite(Number(line)) ? Number(line) : line,
      messageText: message.slice(0, 900),
      mobiles: [mobile],
      sendDateTime: null,
    };

    await this.postJson('/v1/send', body, 'notification');
    this.logger.log(`Notification SMS accepted by SMS.ir for ${maskPhone(mobile)}`);
  }

  private async postJson(
    path: string,
    body: unknown,
    kind: string,
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': this.cfg.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(
        `SMS.ir network error (${kind}): ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'ارسال پیامک موقتاً ممکن نیست. لطفاً کمی بعد دوباره تلاش کنید.',
      );
    }

    let payload: { status?: number; message?: string } = {};
    try {
      payload = (await res.json()) as { status?: number; message?: string };
    } catch {
      /* non-JSON body */
    }

    // SMS.ir success is typically status === 1
    const ok = res.ok && (payload.status === undefined || payload.status === 1);
    if (!ok) {
      this.logger.error(
        `SMS.ir ${kind} failed http=${res.status} status=${payload.status} msg=${payload.message || res.statusText}`,
      );
      throw new ServiceUnavailableException(
        'ارسال پیامک ناموفق بود. لطفاً دوباره تلاش کنید.',
      );
    }
  }
}

/** Normalize to 09xxxxxxxxx for SMS.ir. */
export function normalizeIranMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  if (digits.length === 12 && digits.startsWith('98')) return `0${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('09')) return digits;
  return phone.trim();
}

function maskPhone(phone: string): string {
  if (phone.length < 7) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
