import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

/**
 * Development-only SMS sink. Logs delivery intent without calling a network.
 * OTP code is logged only outside production so local auth flows stay usable.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);
  private readonly isProd =
    (process.env.NODE_ENV || 'development') === 'production';

  async sendOtp(phone: string, code: string): Promise<void> {
    if (this.isProd) {
      this.logger.warn(
        `[MOCK SMS OTP] to=${mask(phone)} (code suppressed in production mock)`,
      );
    } else {
      this.logger.log(`[MOCK SMS OTP] to=${phone} code=${code}`);
    }
  }

  async sendNotification(phone: string, message: string): Promise<void> {
    const preview =
      message.length > 80 ? `${message.slice(0, 80)}…` : message;
    this.logger.log(`[MOCK SMS] to=${mask(phone)} msg=${preview}`);
  }
}

function mask(phone: string): string {
  if (phone.length < 7) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
