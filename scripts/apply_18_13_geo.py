#!/usr/bin/env python3
"""Wire lat/lng/radiusKm into professionals + service-filters search."""
from pathlib import Path
import re

# --- professionals.controller ---
ctrl = Path('backend/src/professionals/professionals.controller.ts')
c = ctrl.read_text()
if 'radiusKm' not in c:
    old = """  search(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
    @Query('availableDate') availableDate?: string,
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
    });
  }"""
    new = """  search(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
    @Query('availableDate') availableDate?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
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
  }"""
    if old not in c:
        raise SystemExit('professionals.controller search block not found')
    c = c.replace(old, new, 1)
    ctrl.write_text(c)
    print('controller patched')
else:
    print('controller already has radiusKm')

# --- service-filters.controller ---
sfc = Path('backend/src/service-filters/service-filters.controller.ts')
s = sfc.read_text()
if "@Query('lat')" not in s:
    old = """  searchProfessionals(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
    @Query('availableDate') availableDate?: string,
  ) {
    return this.service.searchProfessionalsByFilter({
      q,
      city,"""
    # find the rest of the block dynamically
    if old not in s:
        raise SystemExit('service-filters controller search start not found')
    # replace query list and pass-through
    s = s.replace(
        "@Query('availableDate') availableDate?: string,\n  ) {\n    return this.service.searchProfessionalsByFilter({\n      q,\n      city,",
        "@Query('availableDate') availableDate?: string,\n    @Query('lat') lat?: string,\n    @Query('lng') lng?: string,\n    @Query('radiusKm') radiusKm?: string,\n  ) {\n    return this.service.searchProfessionalsByFilter({\n      q,\n      city,",
        1,
    )
    # add lat/lng/radiusKm to the object literal before closing
    if 'radiusKm:' not in s[s.find('searchProfessionalsByFilter'):s.find('searchProfessionalsByFilter')+500]:
        s = re.sub(
            r"(availableDate: availableDate \?[^,}]+,)",
            r"\1\n      lat,\n      lng,\n      radiusKm,",
            s,
            count=1,
        )
    sfc.write_text(s)
    print('service-filters controller patched')
else:
    print('service-filters controller already geo')

# --- service-filters.service type ---
sfs = Path('backend/src/service-filters/service-filters.service.ts')
ss = sfs.read_text()
if 'radiusKm?:' not in ss:
    ss = ss.replace(
        "availableDate?: string;\n  }) {",
        "availableDate?: string;\n    lat?: string;\n    lng?: string;\n    radiusKm?: string;\n  }) {",
        1,
    )
    sfs.write_text(ss)
    print('service-filters service type patched')
else:
    print('service-filters service already geo')

# --- professionals.service ---
ps = Path('backend/src/professionals/professionals.service.ts')
p = ps.read_text()
if "from '../common/geo'" not in p:
    p = p.replace(
        "import { ProfessionalStatus, Prisma } from '@prisma/client';",
        "import { ProfessionalStatus, Prisma } from '@prisma/client';\n"
        "import { boundingBox, haversineKm, parseGeoQuery } from '../common/geo';",
        1,
    )

if 'radiusKm?:' not in p.split('async search')[1][:400]:
    p = p.replace(
        "availableDate?: string;\n    ids?: string[];\n  }) {",
        "availableDate?: string;\n    ids?: string[];\n    lat?: string | number;\n    lng?: string | number;\n    radiusKm?: string | number;\n  }) {",
        1,
    )

# inject geo into cache key
if "lat: params.lat" not in p:
    p = p.replace(
        "availableDate: params.availableDate || '',\n          })}",
        "availableDate: params.availableDate || '',\n            lat: params.lat ?? '',\n            lng: params.lng ?? '',\n            radiusKm: params.radiusKm ?? '',\n          })}",
        1,
    )

# after city filter, add bounding-box location filter when geo present
marker = "if (params.city) {\n      where.locations = {\n        some: { location: { city: { contains: params.city, mode: 'insensitive' } } },\n      };\n    }"
geo_block = """if (params.city) {
      where.locations = {
        some: { location: { city: { contains: params.city, mode: 'insensitive' } } },
      };
    }

    const geo = parseGeoQuery({
      lat: params.lat as any,
      lng: params.lng as any,
      radiusKm: params.radiusKm as any,
    });
    if (geo) {
      const box = boundingBox(geo.lat, geo.lng, geo.radiusKm);
      const locFilter: Prisma.LocationWhereInput = {
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      };
      if (where.locations && typeof where.locations === 'object' && 'some' in where.locations) {
        const prev = (where.locations as any).some || {};
        where.locations = {
          some: {
            ...prev,
            location: { ...(prev.location || {}), ...locFilter },
          },
        };
      } else {
        where.locations = { some: { location: locFilter } };
      }
    }"""

if 'parseGeoQuery' in p and 'boundingBox(geo.lat' in p:
    print('geo filter already in service')
elif marker in p:
    p = p.replace(marker, geo_block, 1)
    print('geo filter injected')
else:
    print('WARN: city marker not found for geo inject')

# after sorted items, apply haversine filter + distance field
result_marker = "    const result = {\n      items: sorted,\n      meta: {"

result_inject = """    let withDistance: any[] = sorted;
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
    }

    const result = {
      items: withDistance,
      meta: {"""

if 'distanceKm' in p and 'withDistance' in p:
    print('distance enrichment already present')
elif result_marker in p:
    p = p.replace(result_marker, result_inject, 1)
    # also enrich meta filters
    p = p.replace(
        "availableDate: params.availableDate ?? null,\n        },",
        "availableDate: params.availableDate ?? null,\n          lat: geo?.lat ?? null,\n          lng: geo?.lng ?? null,\n          radiusKm: geo?.radiusKm ?? null,\n        },",
        1,
    )
    print('distance enrichment injected')
else:
    print('WARN: result marker not found')

ps.write_text(p)
print('professionals.service written', len(p))
