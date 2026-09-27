#!/usr/bin/env python3
from pathlib import Path

def main():
    p = Path('frontend/src/app/professionals/[slug]/page.tsx')
    s = p.read_text()
    old = '''                return (
                  <div className="mt-4">
                    <LocationMapView position={{ lat, lng }} height="200px" />
                    <p className="mt-2 text-xs text-gray-muted">موقعیت تقریبی روی نقشه</p>
                  </div>
                );'''
    new = '''                const precision =
                  (loc as { precision?: string | null }).precision === 'exact'
                    ? 'exact'
                    : (loc as { precision?: string | null }).precision === 'approximate'
                      ? 'approximate'
                      : 'approximate';
                return (
                  <div className="mt-4">
                    <LocationMapView
                      position={{ lat, lng }}
                      height="200px"
                      precision={precision}
                    />
                    <p className="mt-2 text-xs text-gray-muted">
                      {precision === 'exact'
                        ? 'موقعیت دقیق — مسیریابی با نشان'
                        : 'موقعیت تقریبی؛ پین دقیق نمایش داده نمی‌شود'}
                    </p>
                  </div>
                );'''
    if 'precision={precision}' in s:
        print('already')
        return
    if old not in s:
        # try without trailing exact match
        if 'LocationMapView position={{ lat, lng }}' in s:
            s = s.replace(
                '<LocationMapView position={{ lat, lng }} height="200px" />',
                '<LocationMapView position={{ lat, lng }} height="200px" precision={(loc as { precision?: string | null }).precision === "exact" ? "exact" : "approximate"} />',
                1,
            )
            p.write_text(s)
            print('replaced inline')
            return
        raise SystemExit('anchor missing')
    p.write_text(s.replace(old, new, 1))
    print('ok')

if __name__ == '__main__':
    main()
