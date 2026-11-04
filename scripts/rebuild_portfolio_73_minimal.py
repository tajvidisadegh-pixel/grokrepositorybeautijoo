#!/usr/bin/env python3
"""Restore portfolio page from last known-good commit, apply minimal #73 UX."""
import subprocess
from pathlib import Path

# Post-#72 green
GOOD = '6eeed2d4ce2fce1e5074ddd81cf514bd18314e6f'
PATH = 'frontend/src/app/zibagar/portfolio/page.tsx'


def main() -> None:
    raw = subprocess.check_output(['git', 'show', f'{GOOD}:{PATH}'], text=True)
    t = raw

    # denser grid
    t = t.replace(
        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5',
        1,
    )

    # multi on input
    if 'multiple' not in t.split('type="file"', 1)[1][:300]:
        t = t.replace('type="file"', 'type="file"\n            multiple', 1)

    old_change = '''            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
'''
    new_change = '''            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              void (async () => {
                const files = Array.from(list);
                for (const f of files) {
                  await onUpload(f);
                }
              })();
            }}
'''
    if old_change not in t:
        raise SystemExit('onChange block not found on restored file')
    t = t.replace(old_change, new_change, 1)

    Path(PATH).write_text(t)
    print('rebuilt', PATH, len(t))


if __name__ == '__main__':
    main()
