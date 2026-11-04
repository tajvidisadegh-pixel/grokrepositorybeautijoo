#!/usr/bin/env python3
"""#80 Phase3 — notify pro on quote request, customer on response."""
from pathlib import Path


def patch_schema_enum() -> None:
    path = Path('backend/prisma/schema.prisma')
    t = path.read_text()
    if 'quote_request' in t and 'quote_responded' in t:
        print('enum already has quote types')
        return
    old = '''enum NotificationType {
  booking_request
  booking_confirmed
  booking_rejected
  booking_cancelled
  booking_completed
  booking_reminder
  review_request
  system
  otp
}'''
    new = '''enum NotificationType {
  booking_request
  booking_confirmed
  booking_rejected
  booking_cancelled
  booking_completed
  booking_reminder
  review_request
  quote_request
  quote_responded
  system
  otp
}'''
    if old not in t:
        raise SystemExit('NotificationType enum block not found')
    path.write_text(t.replace(old, new, 1))
    print('schema enum patched')


def patch_quotes_module() -> None:
    path = Path('backend/src/quotes/quotes.module.ts')
    t = path.read_text()
    if 'NotificationsModule' in t:
        print('QuotesModule already imports NotificationsModule')
        return
    t = t.replace(
        "import { PrismaModule } from '../prisma/prisma.module';",
        "import { PrismaModule } from '../prisma/prisma.module';\n"
        "import { NotificationsModule } from '../notifications/notifications.module';",
        1,
    )
    t = t.replace(
        'imports: [PrismaModule],',
        'imports: [PrismaModule, NotificationsModule],',
        1,
    )
    path.write_text(t)
    print('quotes.module patched')


def patch_quotes_service() -> None:
    path = Path('backend/src/quotes/quotes.service.ts')
    t = path.read_text()
    if 'NotificationsService' in t and 'quote_request' in t:
        print('quotes.service already notifies')
        return

    if 'NotificationsService' not in t:
        t = t.replace(
            "import { PrismaService } from '../prisma/prisma.service';",
            "import { PrismaService } from '../prisma/prisma.service';\n"
            "import { NotificationsService } from '../notifications/notifications.service';",
            1,
        )
        t = t.replace(
            'constructor(private readonly prisma: PrismaService) {}',
            'constructor(\n    private readonly prisma: PrismaService,\n    private readonly notifications: NotificationsService,\n  ) {}',
            1,
        )

    # After create success, notify pro
    old_create_return = '''    return this.prisma.priceQuoteRequest.create({
      data: {
        customerId,
        professionalId: data.professionalId,
        professionalServiceId: data.professionalServiceId || null,
        note: data.note?.trim() || null,
        photoUrls: urls,
        status: 'pending',
      },
      include: this.include(),
    });
  }'''
    new_create_return = '''    const created = await this.prisma.priceQuoteRequest.create({
      data: {
        customerId,
        professionalId: data.professionalId,
        professionalServiceId: data.professionalServiceId || null,
        note: data.note?.trim() || null,
        photoUrls: urls,
        status: 'pending',
      },
      include: this.include(),
    });

    const proUserId = pro.userId;
    await this.notifications.notify({
      userId: proUserId,
      type: 'quote_request',
      title: 'درخواست قیمت جدید',
      body: 'یک مشتری برای خدمت شما درخواست قیمت فرستاده است.',
      data: { href: '/zibagar/quotes', quoteId: created.id },
      sms: true,
    });

    return created;
  }'''
    if old_create_return not in t:
        print('WARN: create return block not found')
    else:
        t = t.replace(old_create_return, new_create_return, 1)

    # Fix: pro variable must have userId - ensure we select userId when finding pro
    # Current findFirst doesn't select - full model has userId. Good.
    # But after my earlier fix, variable might be `pro` from first find - check create uses `pro`
    if 'const proOk' in t:
        # older version - skip
        pass

    # After respond update, notify customer
    old_respond = '''    return this.prisma.priceQuoteRequest.update({
      where: { id: quoteId },
      data: {
        status: body.status,
        quotedPrice: body.status === 'quoted' ? body.quotedPrice : null,
        quotedDurationMin: body.status === 'quoted' ? body.quotedDurationMin ?? null : null,
        responseNote: body.responseNote?.trim() || null,
        respondedAt: new Date(),
      },
      include: this.include(),
    });
  }'''
    new_respond = '''    const updated = await this.prisma.priceQuoteRequest.update({
      where: { id: quoteId },
      data: {
        status: body.status,
        quotedPrice: body.status === 'quoted' ? body.quotedPrice : null,
        quotedDurationMin: body.status === 'quoted' ? body.quotedDurationMin ?? null : null,
        responseNote: body.responseNote?.trim() || null,
        respondedAt: new Date(),
      },
      include: this.include(),
    });

    const title =
      body.status === 'quoted' ? 'پاسخ قیمت دریافت شد' : 'درخواست قیمت رد شد';
    const bodyText =
      body.status === 'quoted'
        ? `زیباگر برای درخواست شما قیمت اعلام کرد${body.quotedPrice != null ? `: ${body.quotedPrice.toLocaleString('fa-IR')} تومان` : ''}.`
        : 'زیباگر درخواست قیمت شما را رد کرد.';
    await this.notifications.notify({
      userId: row.customerId,
      type: 'quote_responded',
      title,
      body: bodyText,
      data: { href: '/dashboard/quotes', quoteId },
      sms: true,
    });

    return updated;
  }'''
    if old_respond not in t:
        print('WARN: respond return block not found')
    else:
        t = t.replace(old_respond, new_respond, 1)

    path.write_text(t)
    print('quotes.service patched', path.stat().st_size)


if __name__ == '__main__':
    patch_schema_enum()
    patch_quotes_module()
    patch_quotes_service()
