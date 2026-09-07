import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { ZarinpalPaymentProvider } from './zarinpal-payment.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    ZarinpalPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, MockPaymentProvider, ZarinpalPaymentProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
        zarinpal: ZarinpalPaymentProvider,
      ): PaymentProvider => {
        const kind = (
          process.env.PAYMENT_PROVIDER ||
          config.get<string>('paymentProvider') ||
          'mock'
        ).toLowerCase();

        if (kind === 'zarinpal') {
          return zarinpal;
        }
        // Default / unknown → safe mock (dev & CI)
        return mock;
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
