#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('backend/src/services/services.service.ts')
    t = path.read_text()
    if 'InputJsonValue' in t:
        print('already fixed')
        return
    t = t.replace(
        '      optionDeltas: optionDeltas === null ? Prisma.JsonNull : optionDeltas,',
        '      optionDeltas: (optionDeltas === null\n        ? Prisma.JsonNull\n        : optionDeltas) as Prisma.InputJsonValue,',
        1,
    )
    t = t.replace(
        '''  private catalogFlags(service: {
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
  }''',
        '''  private catalogFlags(service: {
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
  }''',
        1,
    )
    t = t.replace(
        'const pricing = wantsPricing ? this.resolvePricingFields(flags, data, ps) : null;',
        '''const pricing = wantsPricing
      ? this.resolvePricingFields(flags, data, ps as {
          pricingMode?: string | null;
          depositAmount?: number | null;
          estimateMinPrice?: number | null;
          estimateMaxPrice?: number | null;
          optionDeltas?: unknown;
        })
      : null;''',
        1,
    )
    if 'InputJsonValue' not in t:
        raise SystemExit('fix failed to apply')
    path.write_text(t)
    print('fixed', path.stat().st_size)

if __name__ == '__main__':
    main()
