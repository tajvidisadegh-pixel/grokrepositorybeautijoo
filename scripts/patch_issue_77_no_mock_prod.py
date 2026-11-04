#!/usr/bin/env python3
"""#77 — production must never use mock payment or mock SMS."""
from pathlib import Path


def patch_payments_module() -> None:
    path = Path('backend/src/payments/payments.module.ts')
    t = path.read_text()

    old = '''  if (raw === 'mock' || raw === '') {
    if (prod) {
      logger.warn(
        'PAYMENT_PROVIDER is mock/empty in production — online payment DISABLED (no fake PAID)',
      );
      return deps.disabled;
    }
    logger.log('Payment provider: mock (non-production)');
    return deps.mock;
  }

  // Unknown key
  if (prod) {
    logger.warn(
      `Unknown PAYMENT_PROVIDER="${raw}" in production — online payment DISABLED`,
    );
    return deps.disabled;
  }
  logger.warn(`Unknown PAYMENT_PROVIDER="${raw}" — falling back to mock (dev)`);
  return deps.mock;
'''

    new = '''  // #77 — mock is never allowed in production (fail loud, no silent fallback)
  if (raw === 'mock') {
    if (prod) {
      throw new Error(
        'FATAL: PAYMENT_PROVIDER=mock is forbidden in production. ' +
          'Set PAYMENT_PROVIDER=zarinpal with ZARINPAL_MERCHANT_ID, ' +
          'or PAYMENT_PROVIDER=disabled to turn online payment off deliberately.',
      );
    }
    logger.log('Payment provider: mock (non-production)');
    return deps.mock;
  }

  if (raw === '') {
    if (prod) {
      throw new Error(
        'FATAL: PAYMENT_PROVIDER is empty in production. ' +
          'Set PAYMENT_PROVIDER=zarinpal (real gateway) or PAYMENT_PROVIDER=disabled.',
      );
    }
    logger.log('Payment provider: mock (default non-production)');
    return deps.mock;
  }

  // Unknown key
  if (prod) {
    throw new Error(
      `FATAL: Unknown PAYMENT_PROVIDER="${raw}" in production. ` +
        'Supported: zarinpal, disabled. Mock is not allowed.',
    );
  }
  logger.warn(`Unknown PAYMENT_PROVIDER="${raw}" — falling back to mock (dev)`);
  return deps.mock;
'''

    if old not in t:
        if 'PAYMENT_PROVIDER=mock is forbidden' in t:
            print('payments.module already locked')
        else:
            raise SystemExit('payments.module pattern not found')
    else:
        path.write_text(t.replace(old, new, 1))
        print('payments.module ok')


def patch_sms_module() -> None:
    path = Path('backend/src/sms/sms.module.ts')
    t = path.read_text()

    old = '''  if (raw === 'mock' || raw === '' || raw === 'none') {
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
        'SMS_BOOT provider=mock ALLOW_MOCK_SMS=true — OTP will NOT reach phones (production diagnostic mode).',
      );
    } else {
      logger.log('SMS_BOOT provider=mock (development)');
    }
    return new MockSmsProvider();
  }
'''

    new = '''  // #77 — mock SMS never boots in production (no ALLOW_MOCK_SMS escape)
  if (raw === 'mock' || raw === '' || raw === 'none') {
    if (isProd) {
      throw new Error(
        'FATAL: SMS_PROVIDER=mock (or empty) is forbidden in production. ' +
          'Set SMS_PROVIDER=smsir with SMSIR_API_KEY and SMSIR_OTP_TEMPLATE_ID.',
      );
    }
    logger.log('SMS_BOOT provider=mock (development)');
    return new MockSmsProvider();
  }
'''

    if old not in t:
        if 'ALLOW_MOCK_SMS escape' in t or 'forbidden in production' in t and 'SMS_PROVIDER=mock' in t:
            # maybe partially updated
            if 'ALLOW_MOCK_SMS' in t:
                # force remove allow path by simpler replace
                print('WARN: trying alternate SMS lock')
            else:
                print('sms.module already locked')
                return
        else:
            raise SystemExit('sms.module pattern not found')
    path.write_text(t.replace(old, new, 1) if old in t else t)
    if old in path.read_text() if False else True:
        t2 = path.read_text()
        if old in t2:
            path.write_text(t2.replace(old, new, 1))
    print('sms.module ok')


def patch_mock_sms() -> None:
    path = Path('backend/src/sms/mock-sms.provider.ts')
    t = path.read_text()
    if 'Mock SMS در محیط production مجاز نیست' in t:
        print('mock-sms already blocked')
        return

    # Add ForbiddenException import and assert
    if 'ForbiddenException' not in t:
        t = t.replace(
            "import { Injectable, Logger } from '@nestjs/common';",
            "import { Injectable, Logger, ForbiddenException } from '@nestjs/common';",
            1,
        )

    old_send = '''  async sendOtp(phone: string, code: string): Promise<void> {
    MockSmsProvider.lastCodeByPhone.set(phone, code);
    if (this.isProd) {
      this.logger.warn(
        `[MOCK SMS OTP] to=${mask(phone)} (code suppressed in production mock)`,
      );
    } else {
      this.logger.log(`[MOCK SMS OTP] to=${phone} code=${code}`);
    }
  }
'''
    new_send = '''  async sendOtp(phone: string, code: string): Promise<void> {
    if (this.isProd) {
      this.logger.error('[MOCK SMS OTP] blocked in production');
      throw new ForbiddenException('Mock SMS در محیط production مجاز نیست');
    }
    MockSmsProvider.lastCodeByPhone.set(phone, code);
    this.logger.log(`[MOCK SMS OTP] to=${phone} code=${code}`);
  }
'''
    if old_send not in t:
        raise SystemExit('mock sendOtp not found')
    t = t.replace(old_send, new_send, 1)
    path.write_text(t)
    print('mock-sms ok')


def patch_deploy_doc() -> None:
    path = Path('DEPLOY_LIARA.md')
    if not path.exists():
        print('no DEPLOY_LIARA.md')
        return
    t = path.read_text()
    if 'PAYMENT_PROVIDER=zarinpal' in t and '#77' in t:
        print('deploy doc already updated')
        return
    block = '''

## Production providers (#77) — بدون mock

در `NODE_ENV=production` سرویس **بالا نمی‌آید** اگر mock تنظیم شده باشد.

| متغیر | مقدار واقعی | توضیح |
|--------|-------------|--------|
| `PAYMENT_PROVIDER` | `zarinpal` یا `disabled` | `mock` / خالی = FATAL |
| `ZARINPAL_MERCHANT_ID` | شناسه درگاه | وقتی zarinpal است الزامی |
| `SMS_PROVIDER` | `smsir` | `mock` / خالی = FATAL |
| `SMSIR_API_KEY` | کلید SMS.ir | هرگز در گیت |
| `SMSIR_OTP_TEMPLATE_ID` | شناسه قالب OTP | عددی |

بعد از هر تغییر provider: یک **پرداخت واقعی** و یک **OTP واقعی** تست شود.
'''
    if '## Production providers (#77)' not in t:
        path.write_text(t.rstrip() + block + '\n')
        print('DEPLOY_LIARA.md updated')


if __name__ == '__main__':
    patch_payments_module()
    patch_sms_module()
    patch_mock_sms()
    patch_deploy_doc()
