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
 * - disabled: production when no real gateway is configured (app still boots)
 * - zarinpal | <future>: real gateways
 *
 * #77: mock must never succeed in production.
 * Production must NOT crash the Nest process if env is incomplete — use disabled.
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

  if (raw === 'zarinpal') {
    logger.log('Payment provider: zarinpal');
    return deps.zarinpal;
  }

  if (raw === 'disabled' || raw === 'none' || raw === 'off') {
    logger.warn('Payment provider: disabled (online payment off)');
    return deps.disabled;
  }

  if (raw === 'mock') {
    if (prod) {
      logger.error(
        'PAYMENT_PROVIDER=mock forbidden in production — using disabled (no fake paid). Set zarinpal or disabled.',
      );
      return deps.disabled;
    }
    logger.log('Payment provider: mock (non-production)');
    return deps.mock;
  }

  if (raw === '') {
    if (prod) {
      logger.error(
        'PAYMENT_PROVIDER empty in production — using disabled. Set PAYMENT_PROVIDER=zarinpal or disabled.',
      );
      return deps.disabled;
    }
    logger.log('Payment provider: mock (default non-production)');
    return deps.mock;
  }

  // Unknown key
  if (prod) {
    logger.error(`Unknown PAYMENT_PROVIDER="${raw}" in production — using disabled`);
    return deps.disabled;
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
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
        disabled: DisabledPaymentProvider,
        zarinpal: ZarinpalPaymentProvider,
      ) => resolvePaymentProvider(config, { mock, disabled, zarinpal }),
      inject: [ConfigService, MockPaymentProvider, DisabledPaymentProvider, ZarinpalPaymentProvider],
    },
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
