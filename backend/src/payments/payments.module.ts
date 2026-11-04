import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { DisabledPaymentProvider } from './disabled-payment.provider';
import { ZarinpalPaymentProvider } from './zarinpal-payment.provider';

function isProduction(): boolean {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/**
 * Resolve active payment provider.
 *
 * - mock: development / test only
 * - disabled: production when no real gateway is configured
 * - zarinpal | <future>: real gateways registered by key (provider-agnostic)
 *
 * No specific gateway is locked in as the project default.
 */
export function resolvePaymentProvider(
  config: ConfigService,
  deps: {
    mock: MockPaymentProvider;
    disabled: DisabledPaymentProvider;
    zarinpal: ZarinpalPaymentProvider;
  },
): PaymentProvider {
  const logger = new Logger('PaymentsModule');
  const raw = (
    process.env.PAYMENT_PROVIDER ||
    config.get<string>('paymentProvider') ||
    ''
  )
    .trim()
    .toLowerCase();

  const prod = isProduction();

  // Explicit real providers (extensible map — add new gateways here only)
  if (raw === 'zarinpal') {
    logger.log('Payment provider: zarinpal');
    return deps.zarinpal;
  }

  // Future real providers: if (raw === 'idpay') return deps.idpay;

  if (raw === 'disabled' || raw === 'none' || raw === 'off') {
    logger.warn('Payment provider: disabled (online payment off)');
    return deps.disabled;
  }

  // #77 — mock is never allowed in production (fail loud, no silent fallback)
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
}

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    DisabledPaymentProvider,
    ZarinpalPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [
        ConfigService,
        MockPaymentProvider,
        DisabledPaymentProvider,
        ZarinpalPaymentProvider,
      ],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
        disabled: DisabledPaymentProvider,
        zarinpal: ZarinpalPaymentProvider,
      ): PaymentProvider =>
        resolvePaymentProvider(config, { mock, disabled, zarinpal }),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
