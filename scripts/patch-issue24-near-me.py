#!/usr/bin/env python3
"""Issue #24 Near Me gaps — minimal additive patches."""
from pathlib import Path

def patch_professionals_service():
    p = Path('backend/src/professionals/professionals.service.ts')
    t = p.read_text()
    if 'distanceApproximate' in t and 'distanceKm != null &&' in t:
        print('professionals.service already patched')
        return

    # Over-fetch when geo for better distance ranking
    old_fetch = '''    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include,
      }),
      this.prisma.professional.count({ where }),
    ]);'''
    new_fetch = '''    // When near-me (geo): over-fetch within bbox, rank by Haversine, then paginate (issue #24)
    const geoFetch = !!geo;
    const fetchTake = geoFetch ? Math.min(200, Math.max(limit * 8, 80)) : limit;
    const fetchSkip = geoFetch ? 0 : skip;
    const [items, totalRaw] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip: fetchSkip,
        take: fetchTake,
        orderBy,
        include,
      }),
      this.prisma.professional.count({ where }),
    ]);
    let total = totalRaw;'''
    if old_fetch not in t:
        raise SystemExit('fetch block not found')
    t = t.replace(old_fetch, new_fetch, 1)

    old_geo = '''    let withDistance: any[] = sorted;
    if (geo) {
      withDistance = sorted
        .map((item) => {
          const loc = item.locations?.[0]?.location;
          const plat = loc?.latitude != null ? Number(loc.latitude) : NaN;
          const plng = loc?.longitude != null ? Number(loc.longitude) : NaN;
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
            return { ...item, distanceKm: null as number | null };
          }
          const distanceKm = Math.round(haversineKm(geo.lat, geo.lng, plat, plng) * 10) / 10;
          return { ...item, distanceKm };
        })
        .filter((item) => item.distanceKm == null || item.distanceKm <= geo.radiusKm);
      if (params.sort === 'distance' || !params.sort || params.sort === 'featured') {
        withDistance = [...withDistance].sort((a, b) => {
          const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
          const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
          return da - db;
        });
      }
    }'''
    new_geo = '''    let withDistance: any[] = sorted;
    if (geo) {
      withDistance = sorted
        .map((item) => {
          const loc = item.locations?.[0]?.location;
          const plat = loc?.latitude != null ? Number(loc.latitude) : NaN;
          const plng = loc?.longitude != null ? Number(loc.longitude) : NaN;
          if (!Number.isFinite(plat) || !Number.isFinite(plng)) {
            return { ...item, distanceKm: null as number | null, distanceApproximate: false };
          }
          let distanceKm = haversineKm(geo.lat, geo.lng, plat, plng);
          const precision = String(loc?.precision || 'approximate');
          const approximate = precision !== 'exact';
          // Approximate locations: coarser distance (issue #24 privacy)
          if (approximate) {
            if (distanceKm < 1) distanceKm = Math.round(distanceKm * 10) / 10; // ~100m steps
            else distanceKm = Math.round(distanceKm * 2) / 2; // 0.5 km steps
          } else {
            distanceKm = Math.round(distanceKm * 10) / 10;
          }
          return { ...item, distanceKm, distanceApproximate: approximate };
        })
        // Professionals without coordinates are excluded from near-me results
        .filter((item) => item.distanceKm != null && item.distanceKm <= geo.radiusKm);
      withDistance = [...withDistance].sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
      total = withDistance.length;
      withDistance = withDistance.slice(skip, skip + limit);
    }'''
    if old_geo not in t:
        raise SystemExit('geo block not found')
    t = t.replace(old_geo, new_geo, 1)

    # Privacy: do not echo client lat/lng in meta
    t = t.replace(
        '''          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          radiusKm: geo?.radiusKm ?? null,''',
        '''          nearMe: !!geo,
          radiusKm: geo?.radiusKm ?? null,''',
        1,
    )
    p.write_text(t)
    print('professionals.service ok')

def patch_near_me_fields():
    p = Path('frontend/src/components/search/near-me-fields.tsx')
    t = p.read_text()
    if 'اجازه دسترسی به موقعیت مکانی' in t and 'lat, lng' not in t.split('return')[-1]:
        # still may show coords - rewrite status UX
        pass
    # Remove exact coordinate display
    t = t.replace(
        '''      {lat && lng && (
        <p className="text-xs text-gray-muted" dir="ltr">
          {lat}, {lng}
        </p>
      )}''',
        '''      {lat && lng && (
        <p className="text-xs text-emerald-700">موقعیت شما برای جستجوی نزدیک فعال است</p>
      )}''',
        1,
    )
    t = t.replace(
        "setStatus('در حال دریافت موقعیت…');",
        "setStatus('برای پیدا کردن زیباگرهای نزدیک شما، اجازه دسترسی به موقعیت مکانی را بدهید…');",
        1,
    )
    t = t.replace(
        "setStatus('موقعیت شما اعمال شد — فیلتر را اعمال کنید');",
        "setStatus('موقعیت دریافت شد — روی «اعمال فیلتر» بزنید یا مرتب‌سازی «نزدیک‌ترین» را انتخاب کنید');",
        1,
    )
    t = t.replace(
        "setStatus('دسترسی به موقعیت رد شد یا در دسترس نیست');",
        "setStatus('برای استفاده از «نزدیک من»، دسترسی موقعیت مکانی را در مرورگر فعال کنید.');",
        1,
    )
    # Active style when lat/lng set
    t = t.replace(
        '''            className="h-11 flex-1 rounded-2xl border border-coral/40 bg-coral-soft/50 px-3 text-sm font-medium text-coral transition-colors hover:bg-coral-soft disabled:opacity-60"
          >
            {busy ? '…' : 'نزدیک من'}''',
        '''            className={`h-11 flex-1 rounded-2xl border px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
              lat && lng
                ? 'border-coral bg-coral text-white'
                : 'border-coral/40 bg-coral-soft/50 text-coral hover:bg-coral-soft'
            }`}
          >
            {busy ? 'در حال پیدا کردن…' : lat && lng ? '📍 نزدیک من (فعال)' : '📍 نزدیک من'}''',
        1,
    )
    p.write_text(t)
    print('near-me-fields ok')

def patch_utils_format_distance():
    p = Path('frontend/src/lib/utils.ts')
    t = p.read_text()
    if 'formatDistanceFromYou' in t:
        print('formatDistance already')
        return
    # append after formatPriceDigits
    snippet = '''
/** Distance label for near-me (issue #24). km from Haversine; approximate = coarser wording. */
export function formatDistanceFromYou(
  km: number | null | undefined,
  approximate?: boolean,
): string | null {
  if (km == null || !Number.isFinite(km) || km < 0) return null;
  if (km < 1) {
    const meters = Math.max(50, Math.round(km * 1000));
    const mFa = new Intl.NumberFormat('fa-IR').format(meters);
    return approximate ? `حدود ${mFa} متر از شما` : `${mFa} متر از شما`;
  }
  const rounded = approximate ? Math.round(km * 2) / 2 : Math.round(km * 10) / 10;
  const kmFa = new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: approximate ? 1 : 1,
  }).format(rounded);
  return approximate ? `حدود ${kmFa} کیلومتر از شما` : `${kmFa} کیلومتر از شما`;
}
'''
    anchor = 'export function formatPriceDigits(amount: number): string {'
    if anchor not in t:
        t = t + snippet
    else:
        # insert after formatPriceDigits function
        idx = t.find(anchor)
        end = t.find('\n}\n', idx)
        if end < 0:
            t = t + snippet
        else:
            t = t[: end + 3] + snippet + t[end + 3 :]
    p.write_text(t)
    print('utils formatDistance ok')

def patch_professional_card():
    p = Path('frontend/src/components/professionals/professional-card.tsx')
    t = p.read_text()
    if 'formatDistanceFromYou' in t:
        print('card already has distance')
        return
    t = t.replace(
        "import { cn } from '@/lib/utils';",
        "import { cn, formatDistanceFromYou } from '@/lib/utils';",
        1,
    )
    # after city span
    old = '''            {city && <span>{city}</span>}
          </div>'''
    new = '''            {city && <span>{city}</span>}
            {pro.distanceKm != null && Number.isFinite(pro.distanceKm) && (
              <span className="text-coral">
                {formatDistanceFromYou(
                  pro.distanceKm,
                  (pro as { distanceApproximate?: boolean }).distanceApproximate,
                )}
              </span>
            )}
          </div>'''
    if old not in t:
        raise SystemExit('card city block not found')
    t = t.replace(old, new, 1)
    p.write_text(t)
    print('professional-card ok')

def patch_types():
    p = Path('frontend/src/types/public.ts')
    t = p.read_text()
    if 'distanceApproximate' in t:
        print('types ok')
        return
    t = t.replace(
        '  distanceKm?: number | null;',
        '  distanceKm?: number | null;\n  /** True when professional location is approximate (issue #24). */\n  distanceApproximate?: boolean;',
        1,
    )
    p.write_text(t)
    print('types ok')

def patch_search_empty():
    p = Path('frontend/src/app/search/page.tsx')
    t = p.read_text()
    if 'محدوده انتخاب‌شده' in t:
        print('search empty ok')
        return
    t = t.replace(
        '{!errorMsg && result && result.items.length === 0 && <EmptyState title="نتیجه‌ای یافت نشد" />}',
        '''{!errorMsg && result && result.items.length === 0 && (
          <EmptyState
            title={lat && lng ? 'زیباگری در محدوده انتخاب‌شده پیدا نشد' : 'نتیجه‌ای یافت نشد'}
            description={lat && lng ? 'شعاع را بزرگ‌تر کنید یا فیلترها را کم کنید.' : undefined}
          />
        )}''',
        1,
    )
    p.write_text(t)
    print('search empty ok')

def main():
    patch_professionals_service()
    patch_near_me_fields()
    patch_utils_format_distance()
    patch_professional_card()
    patch_types()
    patch_search_empty()
    print('issue24 done')

if __name__ == '__main__':
    main()
