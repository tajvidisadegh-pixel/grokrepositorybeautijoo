#!/usr/bin/env python3
"""#80 Phase3 — wire PriceQuoteRequest model + QuotesModule into app."""
from pathlib import Path


def patch_schema() -> None:
    path = Path('backend/prisma/schema.prisma')
    t = path.read_text()
    if 'model PriceQuoteRequest' in t:
        print('schema PriceQuoteRequest exists')
        return

    model = '''
model PriceQuoteRequest {
  id                    String    @id @default(uuid()) @db.Uuid
  customerId            String    @map("customer_id") @db.Uuid
  professionalId        String    @map("professional_id") @db.Uuid
  professionalServiceId String?   @map("professional_service_id") @db.Uuid
  note                  String?   @db.Text
  photoUrls             Json      @default("[]") @map("photo_urls")
  status                String    @default("pending") @db.VarChar(20)
  quotedPrice           Int?      @map("quoted_price")
  quotedDurationMin     Int?      @map("quoted_duration_min")
  responseNote          String?   @map("response_note") @db.Text
  respondedAt           DateTime? @map("responded_at") @db.Timestamptz
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  customer            User                 @relation(fields: [customerId], references: [id], onDelete: Cascade)
  professional        Professional         @relation(fields: [professionalId], references: [id], onDelete: Cascade)
  professionalService ProfessionalService? @relation(fields: [professionalServiceId], references: [id], onDelete: SetNull)

  @@index([customerId])
  @@index([professionalId])
  @@index([status])
  @@index([createdAt])
  @@map("price_quote_requests")
}

'''
    if 'model CatalogAddOn' in t:
        t = t.replace('model CatalogAddOn', model + 'model CatalogAddOn', 1)
    else:
        t = t.rstrip() + '\n' + model

    # User relation
    if 'priceQuoteRequests' not in t:
        # add to User model - find supportTickets line
        if 'supportTickets       SupportTicket[]' in t:
            t = t.replace(
                'supportTickets       SupportTicket[]',
                'supportTickets       SupportTicket[]\n  priceQuoteRequests  PriceQuoteRequest[]',
                1,
            )

    # Professional relation
    if 'priceQuoteRequests PriceQuoteRequest[]' not in t:
        # after professionalServices on Professional
        if 'professionalServices ProfessionalService[]' in t:
            t = t.replace(
                'professionalServices ProfessionalService[]',
                'professionalServices ProfessionalService[]\n  priceQuoteRequests  PriceQuoteRequest[]',
                1,
            )

    # ProfessionalService relation
    if 'priceQuoteRequests' not in t.split('model ProfessionalService')[1][:1200]:
        block = 'model ProfessionalService'
        # insert before @@unique on ProfessionalService
        marker = '  @@unique([professionalId, serviceId])'
        if marker in t:
            t = t.replace(
                marker,
                '  priceQuoteRequests PriceQuoteRequest[]\n' + marker,
                1,
            )

    path.write_text(t)
    print('schema patched', path.stat().st_size)


def patch_app_module() -> None:
    path = Path('backend/src/app.module.ts')
    t = path.read_text()
    if 'QuotesModule' in t:
        print('QuotesModule already imported')
        return
    t = t.replace(
        "import { SupportModule } from './support/support.module';",
        "import { SupportModule } from './support/support.module';\nimport { QuotesModule } from './quotes/quotes.module';",
        1,
    )
    # add to imports array near SupportModule
    t = t.replace('SupportModule,', 'SupportModule,\n    QuotesModule,', 1)
    path.write_text(t)
    print('app.module patched', path.stat().st_size)


def patch_frontend_api() -> None:
    # thin client helpers in panel-api if exists
    path = Path('frontend/src/lib/panel-api.ts')
    if not path.exists():
        print('no panel-api')
        return
    t = path.read_text()
    if 'createPriceQuote' in t:
        print('frontend api exists')
        return
    snippet = '''

/** #80.3 Price quote requests */
export type PriceQuoteRequest = {
  id: string;
  status: string;
  note?: string | null;
  photoUrls?: string[];
  quotedPrice?: number | null;
  quotedDurationMin?: number | null;
  responseNote?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  professional?: { id: string; slug?: string; displayName?: string | null };
  professionalService?: { id: string; service?: { name?: string } } | null;
};

export async function createPriceQuote(body: {
  professionalId: string;
  professionalServiceId?: string;
  note?: string;
  photoUrls?: string[];
}) {
  return apiClient.post<PriceQuoteRequest>('/quotes', body);
}

export async function fetchMyPriceQuotes() {
  return apiClient.get<PriceQuoteRequest[]>('/quotes/mine');
}

export async function fetchProPriceQuotes() {
  return apiClient.get<PriceQuoteRequest[]>('/professionals/me/quotes');
}

export async function respondPriceQuote(
  id: string,
  body: { status: 'quoted' | 'declined'; quotedPrice?: number; quotedDurationMin?: number; responseNote?: string },
) {
  return apiClient.patch<PriceQuoteRequest>(`/professionals/me/quotes/${id}`, body);
}
'''
    path.write_text(t.rstrip() + snippet)
    print('panel-api patched', path.stat().st_size)


def add_pro_quotes_page() -> None:
    path = Path('frontend/src/app/zibagar/quotes/page.tsx')
    if path.exists():
        print('pro quotes page exists')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('''\'use client\';

import { useCallback, useEffect, useState } from \'react\';
import { fetchProPriceQuotes, respondPriceQuote, type PriceQuoteRequest } from \'@/lib/panel-api\';
import { formatPrice } from \'@/lib/utils\';
import { friendlyApiError } from \'@/lib/api-errors\';

export default function ZibagarQuotesPage() {
  const [items, setItems] = useState<PriceQuoteRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const rows = await fetchProPriceQuotes();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(friendlyApiError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: string, status: \'quoted\' | \'declined\') {
    setBusy(true);
    setError(null);
    try {
      const quotedPrice = status === \'quoted\' ? Number(priceDraft[id] || 0) : undefined;
      await respondPriceQuote(id, { status, quotedPrice });
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4" dir="rtl">
      <h1 className="text-lg font-bold text-navy">درخواست‌های قیمت</h1>
      <p className="text-sm text-gray">مشتری می‌تواند با توضیح و عکس، قیمت تقریبی بپرسد. پاسخ شما رزرو قطعی نیست.</p>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {items.length === 0 && <p className="text-sm text-gray">درخواستی نیست.</p>}
      <ul className="space-y-3">
        {items.map((q) => (
          <li key={q.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
            <p className="text-sm font-medium text-navy">
              {q.professionalService?.service?.name || \'خدمت\'} · {q.status}
            </p>
            {q.note && <p className="mt-1 text-sm text-gray">{q.note}</p>}
            {Array.isArray(q.photoUrls) && q.photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {q.photoUrls.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}
            {q.status === \'pending\' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  className="w-32 rounded-lg border border-border px-2 py-1 text-sm"
                  placeholder="مبلغ (تومان)"
                  value={priceDraft[q.id] || \'\'}
                  onChange={(e) => setPriceDraft((p) => ({ ...p, [q.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(q.id, \'quoted\')}
                  className="rounded-lg bg-coral px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  ارسال قیمت
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(q.id, \'declined\')}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs"
                >
                  رد
                </button>
              </div>
            )}
            {q.status === \'quoted\' && q.quotedPrice != null && (
              <p className="mt-2 text-sm font-bold text-coral">{formatPrice(q.quotedPrice)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
''')
    print('pro quotes page written')


if __name__ == '__main__':
    patch_schema()
    patch_app_module()
    patch_frontend_api()
    add_pro_quotes_page()
