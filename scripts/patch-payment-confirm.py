#!/usr/bin/env python3
"""Harden payment flow: confirm booking on paid, fix callback URL + redirect."""
from pathlib import Path


def patch_service() -> None:
    p = Path('backend/src/payments/payments.service.ts')
    s = p.read_text()
    old = '''    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        platformCommissionRate: commissionRate,
        platformCommissionAmount: commissionAmount,
        professionalNetAmount: professionalNetAmount,
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as object)
            : {}),
          gatewayRefId: verified.refId ?? null,
        },
      },
    });
    return { status: 'paid', bookingId: payment.bookingId, refId: verified.refId };'''

    new = '''    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        platformCommissionRate: commissionRate,
        platformCommissionAmount: commissionAmount,
        professionalNetAmount: professionalNetAmount,
        metadata: {
          ...(typeof payment.metadata === 'object' && payment.metadata !== null
            ? (payment.metadata as object)
            : {}),
          gatewayRefId: verified.refId ?? null,
        },
      },
    });

    // Finalize booking after successful payment (pending → confirmed)
    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
    });
    if (booking && (booking.status === 'pending' || booking.status === 'expired')) {
      await this.prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'confirmed' },
      });
    }

    return { status: 'paid', bookingId: payment.bookingId, refId: verified.refId };'''

    if 'Finalize booking after successful payment' in s:
        print('service already confirms booking')
    elif old not in s:
        raise SystemExit('payment update block not found')
    else:
        s = s.replace(old, new, 1)
        p.write_text(s)
        print('service: confirm booking on paid')

    # broaden commission key lookup
    s = p.read_text()
    if "key: 'commission_rate'" not in s and 'platform_commission_rate' in s:
        needle = '''      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });'''
        replacement = '''      let setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (!setting) {
        setting = await this.prisma.platformSetting.findUnique({
          where: { key: 'commission_rate' },
        });
      }
      if (!setting) {
        const cfg = await this.prisma.platformSetting.findUnique({
          where: { key: 'platform_config' },
        });
        if (cfg?.value && typeof cfg.value === 'object' && !Array.isArray(cfg.value)) {
          const comm = (cfg.value as Record<string, unknown>).commission as
            | { ratePercent?: number }
            | undefined;
          if (comm && typeof comm.ratePercent === 'number') {
            setting = { value: comm.ratePercent } as typeof setting;
          }
        }
      }'''
        if needle in s:
            s = s.replace(needle, replacement, 1)
            p.write_text(s)
            print('service: commission keys broadened')
        else:
            print('warn: commission lookup block not found')


def patch_wizard() -> None:
    p = Path('frontend/src/components/booking/booking-wizard.tsx')
    s = p.read_text()
    old = '''      try {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (typeof window !== 'undefined' ? window.location.origin : '');
        const callbackUrl = \`${appUrl}/booking/confirmation/\${created.id}\`;
        const pay = await initiatePayment(created.id, callbackUrl);
        setPaymentInfo(
          pay.redirectUrl
            ? 'درخواست پرداخت ثبت شد. در صورت فعال بودن درگاه به صفحه پرداخت هدایت می‌شوید.'
            : 'رزرو ذخیره شد اما هنوز نهایی نیست — پرداخت از سرور تأیید نشده است.',
        );
      } catch {
        setPaymentInfo('رزرو ذخیره شد اما نهایی نیست. پرداخت آنلاین فعلاً در دسترس نیست یا نیاز به پیکربندی درگاه دارد.');
      }'''
    # use actual backticks in file
    old = old.replace('\\`', '`').replace('\\${', '${')
    new = '''      try {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (typeof window !== 'undefined' ? window.location.origin : '');
        const callbackUrl = `${appUrl}/payment/callback`;
        const pay = await initiatePayment(created.id, callbackUrl);
        if (pay.redirectUrl) {
          window.location.href = pay.redirectUrl;
          return;
        }
        setPaymentInfo(
          'رزرو ذخیره شد اما هنوز نهایی نیست — لینک درگاه دریافت نشد.',
        );
      } catch {
        setPaymentInfo(
          'رزرو ذخیره شد اما نهایی نیست. پرداخت آنلاین فعلاً در دسترس نیست یا نیاز به پیکربندی درگاه دارد.',
        );
      }'''
    if '/payment/callback' in s and 'window.location.href = pay.redirectUrl' in s:
        print('wizard already redirects')
    elif old not in s:
        # try softer match
        if "initiatePayment(created.id, callbackUrl)" in s and 'booking/confirmation' in s:
            s2 = s.replace(
                'const callbackUrl = `${appUrl}/booking/confirmation/${created.id}`;',
                'const callbackUrl = `${appUrl}/payment/callback`;',
            )
            # insert redirect after initiate
            marker = 'const pay = await initiatePayment(created.id, callbackUrl);'
            insert = marker + '''
        if (pay.redirectUrl) {
          window.location.href = pay.redirectUrl;
          return;
        }'''
            if marker in s2:
                s2 = s2.replace(marker, insert, 1)
                # simplify paymentInfo messages that assumed no redirect
                s2 = s2.replace(
                    "pay.redirectUrl\n            ? 'درخواست پرداخت ثبت شد. در صورت فعال بودن درگاه به صفحه پرداخت هدایت می‌شوید.'\n            : 'رزرو ذخیره شد اما هنوز نهایی نیست — پرداخت از سرور تأیید نشده است.'",
                    "'رزرو ذخیره شد اما هنوز نهایی نیست — لینک درگاه دریافت نشد.'",
                )
                p.write_text(s2)
                print('wizard: soft patch applied')
            else:
                raise SystemExit('wizard initiate marker missing')
        else:
            raise SystemExit('wizard payment block not found')
    else:
        p.write_text(s.replace(old, new, 1))
        print('wizard: redirect + callback fixed')


def main() -> None:
    patch_service()
    patch_wizard()
    print('done')


if __name__ == '__main__':
    main()
