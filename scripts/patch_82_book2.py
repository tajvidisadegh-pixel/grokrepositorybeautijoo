from pathlib import Path

p = Path("backend/src/bookings/bookings.service.ts")
t = p.read_text()

if "#82.7" in t:
    print("book already #82.7")
else:
    old = """      // Customer cancel of confirmed/paid remains (policy may refund later)
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
        },
      });
    }"""
    new = """      // #82.7 — customer cancel of paid booking must attempt refund
      if (isCustomer && paid && b.payment?.id) {
        try {
          await this.payments.refund(b.payment.id, reason?.trim() || 'لغو توسط مشتری', userId);
        } catch (err) {
          this.logger.warn(`customer paid cancel refund failed booking=${id}: ${(err as Error)?.message || err}`);
          return this.prisma.booking.update({
            where: { id },
            data: {
              status: BookingStatus.cancelled,
              cancelReason: reason ?? 'لغو توسط مشتری (استرداد ناموفق — پیگیری پشتیبانی)',
              cancelledAt: new Date(),
            },
          });
        }
        return this.prisma.booking.findUniqueOrThrow({ where: { id } });
      }
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.cancelled,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
        },
      });
    }"""
    if old not in t:
        print("WARNING cancel anchor missing")
    else:
        t = t.replace(old, new, 1)
        print("#82.7 applied")

if "#82.8" in t:
    print("book already #82.8")
else:
    old = """      await this.notifications.notify({
        userId: pro.userId,
        type: NotificationType.booking_request,
        title: 'درخواست رزرو (در انتظار پرداخت)',
        body: 'یک مشتری نوبت رزرو کرده و در حال پرداخت است. تا تأیید پرداخت، نوبت قطعی نیست.',
        data: {
          bookingId: booking.id,
          customerId,
          professionalId: data.professionalId,
          href: `/zibagar/bookings?focus=${booking.id}`,
        },
        sms: true,
      });
      await this.notifications.notify({
        userId: customerId,
        type: NotificationType.booking_request,
        title: 'رزرو در انتظار پرداخت',
        body: 'رزرو شما ثبت شد. پس از پرداخت موفق، نوبت قطعی می‌شود.',
        data: { bookingId: booking.id, professionalId: data.professionalId },
        sms: false,
      });
      return booking;"""
    new = """      // #82.8 — notifications must not fail the booking create path
      try {
        await this.notifications.notify({
          userId: pro.userId,
          type: NotificationType.booking_request,
          title: 'درخواست رزرو (در انتظار پرداخت)',
          body: 'یک مشتری نوبت رزرو کرده و در حال پرداخت است. تا تأیید پرداخت، نوبت قطعی نیست.',
          data: {
            bookingId: booking.id,
            customerId,
            professionalId: data.professionalId,
            href: `/zibagar/bookings?focus=${booking.id}`,
          },
          sms: true,
        });
        await this.notifications.notify({
          userId: customerId,
          type: NotificationType.booking_request,
          title: 'رزرو در انتظار پرداخت',
          body: 'رزرو شما ثبت شد. پس از پرداخت موفق، نوبت قطعی می‌شود.',
          data: { bookingId: booking.id, professionalId: data.professionalId },
          sms: false,
        });
      } catch (err) {
        this.logger.warn(`post-create notify failed booking=${booking.id}: ${(err as Error)?.message || err}`);
      }
      return booking;"""
    if old not in t:
        print("WARNING notify anchor missing")
    else:
        t = t.replace(old, new, 1)
        print("#82.8 applied")

p.write_text(t)
print("book2 done")
