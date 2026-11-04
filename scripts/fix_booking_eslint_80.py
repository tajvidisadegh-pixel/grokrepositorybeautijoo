#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    # wizard semicolon
    w = Path('frontend/src/components/booking/booking-wizard.tsx')
    t = w.read_text()
    t2 = t.replace(
        'const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([])',
        'const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);',
    )
    # remove unused goDatetime alias if eslint complains — keep both wired
    if t2 != t:
        w.write_text(t2)
        print('wizard style fixed')

    # booking page: remove : any
    p = Path('frontend/src/app/booking/[slug]/page.tsx')
    t = p.read_text()
    t2 = t.replace('(ps: any)', '(ps)')
    t2 = t2.replace('(g: any)', '(g)')
    t2 = t2.replace('(o: any)', '(o)')
    t2 = t2.replace('(a: any)', '(a)')
    t2 = t2.replace('(r: any)', '(r)')
    if t2 != t:
        p.write_text(t2)
        print('booking page any removed')
    else:
        print('booking page no any change')

if __name__ == '__main__':
    main()
