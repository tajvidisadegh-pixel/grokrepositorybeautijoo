#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('frontend/src/components/booking/booking-wizard.tsx')
    t = path.read_text()
    changed = False

    if 'setError(`لطفاً' in t:
        t = t.replace('setError(`لطفاً', 'setSubmitError(`لطفاً')
        t = t.replace('setError(null);', 'setSubmitError(null);')
        changed = True
        print('fixed setError')

    # Wire goDatetime and quick paths that skip options
    if 'function goDatetime()' in t:
        old = """  function goDatetime() {
    if (selected) setStep('datetime');
  }"""
        new = """  function goDatetime() {
    goToDatetime();
  }"""
        if old in t:
            t = t.replace(old, new, 1)
            changed = True
            print('wired goDatetime')

    # selectPriceRule jumps to datetime — also validate options
    old_spr = """    setStep('datetime');
  }

  function goDatetime()"""
    if old_spr in t:
        t = t.replace(
            old_spr,
            """    goToDatetime();
  }

  function goDatetime()""",
            1,
        )
        changed = True
        print('wired selectPriceRule')

    # Quick book button setStep datetime - leave as is for fixed-only quick path; optional

    if not changed:
        print('no change')
        return
    path.write_text(t)
    print('wrote', path.stat().st_size)

if __name__ == '__main__':
    main()
