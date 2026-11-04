#!/usr/bin/env python3
"""Add cancelPriceQuote helper + professional.title on PriceQuoteRequest type."""
from pathlib import Path


def main() -> None:
    path = Path('frontend/src/lib/panel-api.ts')
    t = path.read_text()
    if 'cancelPriceQuote' in t:
        print('cancelPriceQuote exists')
    else:
        if 'export async function respondPriceQuote' not in t:
            raise SystemExit('respondPriceQuote missing')
        t = t.rstrip() + '''

export async function cancelPriceQuote(id: string) {
  return apiClient.patch<PriceQuoteRequest>(`/quotes/${id}/cancel`, {});
}
'''

    # extend professional type
    old = '''  professional?: { id: string; slug?: string; displayName?: string | null };'''
    new = '''  professional?: { id: string; slug?: string; title?: string | null; displayName?: string | null };'''
    if old in t:
        t = t.replace(old, new, 1)

    path.write_text(t)
    print('panel-api patched', path.stat().st_size)


if __name__ == '__main__':
    main()
