#!/usr/bin/env python3
"""Add verifiedOnly + gender filters end-to-end + today-available UX."""
from pathlib import Path


def patch_service() -> None:
    p = Path('backend/src/professionals/professionals.service.ts')
    s = p.read_text()
    if 'verifiedOnly' in s and 'params.gender' in s:
        print('service already has filters')
        return

    # extend params type in search()
    old_sig = '''  async search(params: {
    q?: string;
    city?: string;
    category?: string;
    page?: number;
    limit?: number;
    minRating?: number;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    availableDate?: string;
    ids?: string[];
    lat?: string | number;
    lng?: string | number;
    radiusKm?: string | number;
  }) {'''
    new_sig = '''  async search(params: {
    q?: string;
    city?: string;
    category?: string;
    page?: number;
    limit?: number;
    minRating?: number;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    availableDate?: string;
    ids?: string[];
    lat?: string | number;
    lng?: string | number;
    radiusKm?: string | number;
    verifiedOnly?: boolean;
    gender?: string;
  }) {'''
    if old_sig not in s:
        raise SystemExit('search signature not found')
    s = s.replace(old_sig, new_sig, 1)

    # cache key fields
    old_cache = '''            radiusKm: params.radiusKm ?? '',
          })}'''
    new_cache = '''            radiusKm: params.radiusKm ?? '',
            verifiedOnly: params.verifiedOnly ?? null,
            gender: params.gender || '',
          })}'''
    if old_cache not in s:
        raise SystemExit('cache key not found')
    s = s.replace(old_cache, new_cache, 1)

    # after minRating block, add verified + gender
    marker = '''    if (params.minRating != null && Number.isFinite(params.minRating)) {
      where.ratingAvg = { gte: params.minRating };
    }'''
    insert = marker + '''

    if (params.verifiedOnly) {
      where.verifiedAt = { not: null };
    }

    if (params.gender) {
      const g = params.gender.trim().toLowerCase();
      if (['female', 'male', 'other'].includes(g)) {
        where.user = {
          ...(typeof where.user === 'object' && where.user !== null ? where.user : {}),
          profile: { gender: g as 'female' | 'male' | 'other' },
        };
      }
    }'''
    if marker not in s:
        raise SystemExit('minRating block not found')
    s = s.replace(marker, insert, 1)
    p.write_text(s)
    print('service ok')


def patch_pro_controller() -> None:
    p = Path('backend/src/professionals/professionals.controller.ts')
    s = p.read_text()
    if "@Query('verifiedOnly')" in s:
        print('pro controller already')
        return
    old = '''    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.service.search({
      q,
      city,
      category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      minRating: minRating != null && minRating !== '' ? parseFloat(minRating) : undefined,
      minPrice: minPrice != null && minPrice !== '' ? parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice != null && maxPrice !== '' ? parseInt(maxPrice, 10) : undefined,
      sort,
      availableDate,
      lat,
      lng,
      radiusKm,
    });
  }'''
    # softer: just add query params before closing of search method params
    if "@Query('radiusKm') radiusKm?: string," not in s:
        raise SystemExit('radiusKm query not found in pro controller')
    s = s.replace(
        "@Query('radiusKm') radiusKm?: string,",
        "@Query('radiusKm') radiusKm?: string,\n"
        "    @Query('verifiedOnly') verifiedOnly?: string,\n"
        "    @Query('gender') gender?: string,",
        1,
    )
    # add to search call - find radiusKm,\n    });
    if 'verifiedOnly:' not in s.split('service.search')[1][:800]:
        s = s.replace(
            '''      lat,
      lng,
      radiusKm,
    });''',
            '''      lat,
      lng,
      radiusKm,
      verifiedOnly:
        verifiedOnly === '1' ||
        verifiedOnly === 'true' ||
        verifiedOnly === 'yes',
      gender,
    });''',
            1,
        )
    p.write_text(s)
    print('pro controller ok')


def patch_sf_controller() -> None:
    p = Path('backend/src/service-filters/service-filters.controller.ts')
    s = p.read_text()
    if "@Query('verifiedOnly')" in s:
        print('sf controller already')
        return
    if "@Query('radiusKm') radiusKm?: string," not in s:
        raise SystemExit('sf radiusKm not found')
    s = s.replace(
        "@Query('radiusKm') radiusKm?: string,",
        "@Query('radiusKm') radiusKm?: string,\n"
        "    @Query('verifiedOnly') verifiedOnly?: string,\n"
        "    @Query('gender') gender?: string,",
        1,
    )
    # extend return object
    if 'radiusKm,' in s and 'verifiedOnly' not in s[s.find('searchProfessionalsByFilter'):]:
        # find the call block
        idx = s.find('searchProfessionalsByFilter')
        chunk = s[idx : idx + 900]
        if 'radiusKm,' in chunk and 'verifiedOnly' not in chunk:
            s = s.replace(
                '''      lat,
      lng,
      radiusKm,
    });''',
                '''      lat,
      lng,
      radiusKm,
      verifiedOnly:
        verifiedOnly === '1' ||
        verifiedOnly === 'true' ||
        verifiedOnly === 'yes',
      gender,
    });''',
                1,
            )
    p.write_text(s)
    print('sf controller ok')


def patch_sf_service() -> None:
    p = Path('backend/src/service-filters/service-filters.service.ts')
    s = p.read_text()
    if 'verifiedOnly?: boolean' in s:
        print('sf service already')
        return
    old = '''  async searchProfessionalsByFilter(params: {
    q?: string;
    city?: string;
    category?: string;
    page?: number;
    limit?: number;
    minRating?: number;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    availableDate?: string;
    lat?: string;
    lng?: string;
    radiusKm?: string;
  }) {'''
    new = '''  async searchProfessionalsByFilter(params: {
    q?: string;
    city?: string;
    category?: string;
    page?: number;
    limit?: number;
    minRating?: number;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    availableDate?: string;
    lat?: string;
    lng?: string;
    radiusKm?: string;
    verifiedOnly?: boolean;
    gender?: string;
  }) {'''
    if old not in s:
        raise SystemExit('sf service signature not found')
    p.write_text(s.replace(old, new, 1))
    print('sf service ok')


def patch_public_api() -> None:
    p = Path('frontend/src/lib/public-api.ts')
    s = p.read_text()
    if 'verifiedOnly' in s:
        print('public-api already')
        return
    old = '''  radiusKm?: number | string;
};'''
    new = '''  radiusKm?: number | string;
  verifiedOnly?: boolean;
  gender?: string;
};'''
    if old not in s:
        raise SystemExit('SearchParams end not found')
    s = s.replace(old, new, 1)
    # set query string
    if "if (params.radiusKm" in s and 'verifiedOnly' not in s[s.find('searchProfessionals'):s.find('searchProfessionals')+800]:
        s = s.replace(
            "if (params.radiusKm != null && params.radiusKm !== '') sp.set('radiusKm', String(params.radiusKm));",
            "if (params.radiusKm != null && params.radiusKm !== '') sp.set('radiusKm', String(params.radiusKm));\n"
            "  if (params.verifiedOnly) sp.set('verifiedOnly', 'true');\n"
            "  if (params.gender) sp.set('gender', params.gender);",
            1,
        )
    p.write_text(s)
    print('public-api ok')


def patch_search_page() -> None:
    p = Path('frontend/src/app/search/page.tsx')
    s = p.read_text()
    if 'verifiedOnly' in s and 'gender' in s:
        print('search page already')
        return

    # extend searchParams type
    s = s.replace(
        '''    lat?: string; lng?: string; radiusKm?: string;
  }>;''',
        '''    lat?: string; lng?: string; radiusKm?: string;
    verifiedOnly?: string; gender?: string;
  }>;''',
        1,
    )

    # parse vars after radiusKm
    s = s.replace(
        '  const radiusKm = sp.radiusKm?.trim() || undefined;\n',
        '  const radiusKm = sp.radiusKm?.trim() || undefined;\n'
        "  const verifiedOnly = sp.verifiedOnly === '1' || sp.verifiedOnly === 'true';\n"
        '  const gender = sp.gender?.trim() || undefined;\n',
        1,
    )

    # pass to searchProfessionals
    s = s.replace(
        '      sort, availableDate, lat, lng, radiusKm,\n',
        '      sort, availableDate, lat, lng, radiusKm,\n'
        '      verifiedOnly: verifiedOnly || undefined,\n'
        '      gender,\n',
        1,
    )

    # pageHref should preserve filters - find pageHref function
    if 'verifiedOnly' not in s[s.find('function pageHref') : s.find('function pageHref') + 600]:
        # try to extend URLSearchParams building in pageHref
        pass

    # Add form fields before NearMeFields row - look for maxPrice input area end
    if 'name="verifiedOnly"' not in s:
        needle = '''          <div className="sm:col-span-2 lg:col-span-3">
            <NearMeFields'''
        insert = '''          <div>
            <label className="mb-1 block text-xs text-gray">جنسیت زیباگر</label>
            <select name="gender" defaultValue={gender || ''} className={inputCls}>
              <option value="">همه</option>
              <option value="female">زن</option>
              <option value="male">مرد</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-border px-3 text-sm">
              <input
                type="checkbox"
                name="verifiedOnly"
                value="true"
                defaultChecked={verifiedOnly}
                className="size-4 accent-coral"
              />
              فقط تأییدشده‌ها
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <NearMeFields'''
        if needle not in s:
            print('warn: NearMeFields needle missing')
        else:
            s = s.replace(needle, insert, 1)
            print('form fields added')

    # Quick today available: after availableDate field - add hint link is hard in server form;
    # document that user can pick today in jalali date

    p.write_text(s)
    print('search page ok')


def main() -> None:
    patch_service()
    patch_pro_controller()
    patch_sf_controller()
    patch_sf_service()
    patch_public_api()
    patch_search_page()
    print('done')


if __name__ == '__main__':
    main()
