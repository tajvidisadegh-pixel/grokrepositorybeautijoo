import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER, SmsProvider } from './sms.provider';
import { MockSmsProvider } from './mock-sms.provider';
import { SmsIrProvider } from './sms-ir.provider';

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

    if (!apiKey) {
      throw new Error(
        'FATAL: SMS_PROVIDER=smsir requires SMSIR_API_KEY (set in environment / Liara, never in source).',
      );
    }
    if (!Number.isFinite(templateId) || templateId <= 0) {
      throw new Error(
        'FATAL: SMS_PROVIDER=smsir requires SMSIR_OTP_TEMPLATE_ID (numeric template id from SMS.ir panel).',
      );
    }

    logger.log(
      `SMS provider: SMS.ir (template=${templateId}, param=${otpParamName}, line=${lineNumber ? 'set' : 'unset'})`,
    );
    return new SmsIrProvider({
      apiKey,
      otpTemplateId: templateId,
      otpParamName,
      lineNumber: lineNumber || undefined,
      baseUrl,
    });
  }

  if (raw === 'mock' || raw === '' || raw === 'none') {
    if (isProd) {
      const allow = (
        process.env.ALLOW_MOCK_SMS ||
        config.get<string>('allowMockSms') ||
        ''
      )
        .toLowerCase()
        .trim();
      if (allow !== 'true' && allow !== '1') {
        throw new Error(
          'FATAL: SMS_PROVIDER=mock is not allowed in production. ' +
            'Set SMS_PROVIDER=smsir with SMSIR_API_KEY and SMSIR_OTP_TEMPLATE_ID, ' +
            'or set ALLOW_MOCK_SMS=true only for emergency diagnostics.',
        );
      }
      logger.warn(
        'ALLOW_MOCK_SMS=true — using MockSmsProvider in production (OTP will NOT reach phones).',
      );
    } else {
      logger.log('SMS provider: mock (development)');
    }
    return new MockSmsProvider();
  }

  throw new Error(
    `FATAL: Unknown SMS_PROVIDER="${raw}". Supported: mock, smsir.`,
  );
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
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
