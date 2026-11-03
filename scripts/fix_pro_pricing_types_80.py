#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('backend/src/services/services.service.ts')
    t = path.read_text()
    changed = False

    old = '      optionDeltas: optionDeltas === null ? Prisma.JsonNull : optionDeltas,'
    new = '      optionDeltas: (optionDeltas === null\n        ? Prisma.JsonNull\n        : optionDeltas) as Prisma.InputJsonValue,'
    if old in t:
        t = t.replace(old, new, 1)
        changed = True
        print('casted optionDeltas')
    elif 'optionDeltas) as Prisma.InputJsonValue' in t:
        print('optionDeltas already cast')
    else:
        print('WARN: optionDeltas line not found')

    old_cf = '''  private catalogFlags(service: {
    allowFixed: boolean;
    allowVariable: boolean;
    allowDeposit: boolean;
    defaultPricingMode: string;
  }): CatalogPricingFlags {
    return {
      allowFixed: service.allowFixed,
      allowVariable: service.allowVariable,
      allowDeposit: service.allowDeposit,
      defaultPricingMode: service.defaultPricingMode,
    };
  }'''
    new_cf = '''  private catalogFlags(service: {
    allowFixed?: boolean;
    allowVariable?: boolean;
    allowDeposit?: boolean;
    defaultPricingMode?: string;
  }): CatalogPricingFlags {
    return {
      allowFixed: service.allowFixed !== false,
      allowVariable: !!service.allowVariable,
      allowDeposit: !!service.allowDeposit,
      defaultPricingMode: service.defaultPricingMode || 'fixed',
    };
  }'''
    if old_cf in t:
        t = t.replace(old_cf, new_cf, 1)
        changed = True
        print('catalogFlags optional')

    old_p = 'const pricing = wantsPricing ? this.resolvePricingFields(flags, data, ps) : null;'
    new_p = '''const pricing = wantsPricing
      ? this.resolvePricingFields(flags, data, ps as {
          pricingMode?: string | null;
          depositAmount?: number | null;
          estimateMinPrice?: number | null;
          estimateMaxPrice?: number | null;
          optionDeltas?: unknown;
        })
      : null;'''
    if old_p in t:
        t = t.replace(old_p, new_p, 1)
        changed = True
        print('ps cast')

    if not changed:
        print('no change needed')
        return
    path.write_text(t)
    print('wrote', path.stat().st_size)

if __name__ == '__main__':
    main()
