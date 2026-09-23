#!/usr/bin/env python3
from pathlib import Path

p = Path('frontend/src/lib/panel-api.ts')
t = p.read_text()
assert len(t) > 10000, 'panel-api too small'
old = (
    "export type LocationItem = { id: string; name: string; address: string; city: string; "
    "province?: string | null; latitude?: number | null; longitude?: number | null; isPrimary?: boolean };"
)
new = (
    "export type LocationItem = { id: string; name: string; address: string; city: string; "
    "province?: string | null; latitude?: number | null; longitude?: number | null; isPrimary?: boolean; "
    "precision?: 'exact' | 'approximate' | null };"
)
if old in t:
    t = t.replace(old, new, 1)
old2 = (
    "export async function addMyLocation(payload: { name?: string; address?: string; city: string; "
    "province?: string; latitude?: number; longitude?: number; isPrimary?: boolean }) {"
)
new2 = (
    "export async function addMyLocation(payload: { name?: string; address?: string; city: string; "
    "province?: string; latitude?: number; longitude?: number; isPrimary?: boolean; "
    "precision?: 'exact' | 'approximate' }) {"
)
if old2 in t:
    t = t.replace(old2, new2, 1)
p.write_text(t)
print('panel-api ok', len(t))

svc = Path('backend/src/professionals/professionals.service.ts')
s = svc.read_text()
if 'sanitizePublicLocations' in s:
    print('already sanitized')
else:
    helper = '''
  /** Public view: hide exact pin when precision=approximate (issue #21). */
  private sanitizePublicLocations<T extends { locations?: Array<{ location?: any; isPrimary?: boolean }> | null }>(
    pro: T,
  ): T {
    if (!pro?.locations?.length) return pro;
    const locations = pro.locations.map((pl) => {
      const loc = pl.location;
      if (!loc) return pl;
      const precision = loc.precision === 'exact' ? 'exact' : 'approximate';
      if (precision === 'exact') {
        return { ...pl, location: { ...loc, precision } };
      }
      const city = loc.city || '';
      const province = loc.province || null;
      const publicAddress =
        typeof loc.address === 'string' && loc.address.includes('\u0645\u062d\u062f\u0648\u062f\u0647')
          ? loc.address
          : `\u0645\u062d\u062f\u0648\u062f\u0647 ${city}${province ? `\u060c ${province}` : ''}`;
      return {
        ...pl,
        location: {
          ...loc,
          precision: 'approximate',
          address: publicAddress,
          latitude: null,
          longitude: null,
        },
      };
    });
    return { ...pro, locations };
  }

'''
    s = s.replace('  private publicInclude() {', helper + '  private publicInclude() {', 1)
    s = s.replace(
        '    this.cache.set(cacheKey, pro, 120_000);\n    return pro;\n  }\n\n  async getOwn(userId: string) {',
        '    const safe = this.sanitizePublicLocations(pro);\n    this.cache.set(cacheKey, safe, 120_000);\n    return safe;\n  }\n\n  async getOwn(userId: string) {',
        1,
    )
    s = s.replace(
        '    const result = {\n      items: withDistance,\n      meta: {',
        '    const sanitizedItems = withDistance.map((item) => this.sanitizePublicLocations(item));\n    const result = {\n      items: sanitizedItems,\n      meta: {',
        1,
    )
    svc.write_text(s)
    print('professionals.service patched', len(s))
