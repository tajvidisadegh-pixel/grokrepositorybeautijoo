import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';
import { MockSmsProvider } from './mock-sms.provider';
import { SmsIrProvider } from './sms-ir.provider';
import { DisabledSmsProvider } from './disabled-sms.provider';

const logger = new Logger('SmsModule');

function createSmsProvider(config: ConfigService): SmsProvider {
  const raw = (config.get<string>('smsProvider') || process.env.SMS_PROVIDER || 'mock')
    .trim()
    .toLowerCase();
  const nodeEnv = config.get<string>('nodeEnv') || process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  if (raw === 'smsir' || raw === 'sms.ir') {
    const apiKey = (
      config.get<string>('smsIrApiKey') ||
      process.env.SMSIR_API_KEY ||
      ''
    ).trim();
    const templateRaw =
      config.get<string>('smsIrOtpTemplateId') ||
      process.env.SMSIR_OTP_TEMPLATE_ID ||
      '';
    const templateId = parseInt(String(templateRaw), 10);
    const otpParamName = (
      config.get<string>('smsIrOtpParamName') ||
      process.env.SMSIR_OTP_PARAM_NAME ||
      'CODE'
    ).trim();
    const lineNumber = (
      config.get<string>('smsIrLineNumber') ||
      process.env.SMSIR_LINE_NUMBER ||
      ''
    ).trim();
    const baseUrl = (
      config.get<string>('smsIrBaseUrl') ||
      process.env.SMSIR_BASE_URL ||
      'https://api.sms.ir'
    ).trim();

    if (!apiKey || !Number.isFinite(templateId) || templateId <= 0) {
      // Do not crash the whole API process — site must stay up (#prod outage fix)
      logger.error(
        'SMS_PROVIDER=smsir but SMSIR_API_KEY / SMSIR_OTP_TEMPLATE_ID missing. Using disabled SMS.',
      );
      return new DisabledSmsProvider();
    }

    logger.log(
      `SMS_BOOT provider=smsir template=${templateId} param=${otpParamName} apiKeySet=yes line=${lineNumber ? 'set' : 'unset'} baseUrl=${baseUrl}`,
    );
    return new SmsIrProvider({
      apiKey,
      otpTemplateId: templateId,
      otpParamName,
      lineNumber: lineNumber || undefined,
      baseUrl,
    });
  }

  // #77 — never use mock success path in production; use disabled instead of process crash
  if (raw === 'mock' || raw === '' || raw === 'none' || raw === 'disabled' || raw === 'off') {
    if (isProd) {
      logger.error(
        'SMS_BOOT provider=disabled (production: mock/empty forbidden). Set SMS_PROVIDER=smsir + keys.',
      );
      return new DisabledSmsProvider();
    }
    logger.log('SMS_BOOT provider=mock (development)');
    return new MockSmsProvider();
  }

  if (isProd) {
    logger.error(`SMS_BOOT unknown provider="${raw}" — using disabled`);
    return new DisabledSmsProvider();
  }
  throw new Error(`FATAL: Unknown SMS_PROVIDER="${raw}". Supported: mock, smsir, disabled.`);
}

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (config: ConfigService) => createSmsProvider(config),
      inject: [ConfigService],
    },
    MockSmsProvider,
    DisabledSmsProvider,
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
