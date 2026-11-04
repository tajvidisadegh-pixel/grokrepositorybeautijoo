#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('frontend/src/app/booking/[slug]/page.tsx')
    t = path.read_text()
    if 'type AttrGroupLite' in t:
        print('already typed')
        return

    # Prepend helper types after imports block — before export default
    marker = 'export default async function'
    idx = t.find(marker)
    if idx < 0:
        raise SystemExit('default export missing')

    helper = '''
type AttrGroupLite = {
  id: string;
  name: string;
  required?: boolean;
  options?: Array<{
    id: string;
    label: string;
    suggestedPriceDelta?: number;
    suggestedDurationDeltaMin?: number;
  }>;
};

type ProServiceRow = {
  id: string;
  durationMin: number;
  bufferMin?: number | null;
  price: number;
  pricingMode?: string | null;
  depositAmount?: number | null;
  estimateMinPrice?: number | null;
  estimateMaxPrice?: number | null;
  optionDeltas?: Record<string, { priceDelta?: number; durationDeltaMin?: number; active?: boolean }> | null;
  service: {
    id: string;
    name: string;
    category?: { name?: string } | null;
    attributeGroups?: AttrGroupLite[];
  };
  addOns?: Array<{ id: string; name: string; price: number; extraDurationMin?: number }>;
  priceRules?: Array<{ id: string; label: string; price: number }>;
  durationRules?: Array<{ id: string; label: string; durationMin: number }>;
};

'''
    t = t[:idx] + helper + t[idx:]

    # Force map source cast
    t = t.replace(
        'const services = (pro.professionalServices || []).map((ps) => ({',
        'const services = ((pro.professionalServices || []) as ProServiceRow[]).map((ps) => ({',
        1,
    )

    path.write_text(t)
    print('typed', path.stat().st_size)

if __name__ == '__main__':
    main()
