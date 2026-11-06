import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

/**
 * Production-safe SMS provider when real gateway is not configured.
 * App can boot; OTP/notification calls fail clearly (no fake success).
 */
@Injectable()
export class DisabledSmsProvider implements SmsProvider {
  private readonly logger = new Logger(DisabledSmsProvider.name);

  private refuse(op: string): never {
    this.logger.error(
      `[SMS DISABLED] blocked ${op} — set SMS_PROVIDER=smsir with SMSIR_API_KEY and SMSIR_OTP_TEMPLATE_ID`,
    );
    throw new ServiceUnavailableException(
      'ارسال پیامک در حال حاضر فعال نیست. سرویس پیامک پیکربندی نشده است.',
    );
  }

  async sendOtp(_phone: string, _code: string): Promise<void> {
    this.refuse('sendOtp');
  }

  async sendNotification(_phone: string, _message: string): Promise<void> {
    this.refuse('sendNotification');
  }
}
