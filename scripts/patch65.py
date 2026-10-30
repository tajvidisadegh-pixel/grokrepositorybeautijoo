from pathlib import Path

def main():
    # services multi-open
    p = Path('frontend/src/app/zibagar/services/page.tsx')
    text = p.read_text(encoding='utf-8')
    if 'openFamilies' not in text and 'openFamily' in text:
        text = text.replace(
            '  const [openFamily, setOpenFamily] = useState<string | null>(null);',
            '  const [openFamilies, setOpenFamilies] = useState<Set<string>>(new Set());',
            1,
        )
        text = text.replace('setOpenFamily(null)', 'setOpenFamilies(new Set())')
        text = text.replace(
            'const open = openFamily === fam.name;',
            'const open = openFamilies.has(fam.name);',
            1,
        )
        old = "onClick={() => setOpenFamily(open ? null : fam.name)}"
        new = (
            "onClick={() => {\n"
            "                        setOpenFamilies((prev) => {\n"
            "                          const next = new Set(prev);\n"
            "                          if (next.has(fam.name)) next.delete(fam.name);\n"
            "                          else next.add(fam.name);\n"
            "                          return next;\n"
            "                        });\n"
            "                      }}"
        )
        text = text.replace(old, new, 1)
        p.write_text(text, encoding='utf-8')
        print('services multi-open OK')
    else:
        print('services skip')

    # homepage search icon
    p = Path('frontend/src/app/page.tsx')
    text = p.read_text(encoding='utf-8')
    old_icon = (
        '<Search className="pointer-events-none absolute right-3 top-1/2 size-5 '
        '-translate-y-1/2 text-gray-muted" />'
    )
    new_icon = (
        '<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 '
        '-translate-y-1/2 text-gray-muted" aria-hidden />'
    )
    if old_icon in text:
        text = text.replace(old_icon, new_icon)
        text = text.replace(
            'className="h-12 w-full rounded-2xl border border-border bg-white pr-11 pl-4 '
            'text-sm shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"',
            'className="h-12 w-full rounded-2xl border border-border bg-white pl-10 pr-4 '
            'text-sm shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"',
        )
        p.write_text(text, encoding='utf-8')
        print('search icon OK')
    else:
        print('search icon skip')

    print('patch65 done')

if __name__ == '__main__':
    main()
