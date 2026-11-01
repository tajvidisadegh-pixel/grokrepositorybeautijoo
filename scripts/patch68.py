#!/usr/bin/env python3
"""Minimal safe patches for issue #68."""
from pathlib import Path

# 1) admin-catalog: allow icon field
p = Path('backend/src/admin/admin-catalog.controller.ts')
t = p.read_text()
if "icon?: string | null" not in t:
    t = t.replace(
        "@IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;\n}",
        "@IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;\n  /** Popular mark uses icon === 'popular' (#68). */\n  @IsOptional() @IsString() icon?: string | null;\n}",
        1,
    )
if "dto.icon !== undefined" not in t:
    t = t.replace(
        "...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),\n      },",
        "...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),\n        ...(dto.icon !== undefined ? { icon: dto.icon ? String(dto.icon).trim() || null : null } : {}),\n      },",
        1,
    )
p.write_text(t)
print('catalog icon', 'icon?: string | null' in t and 'dto.icon' in t)

# 2) panel-shell hide empty title
p = Path('frontend/src/components/panel/panel-shell.tsx')
t = p.read_text()
t = t.replace(
    '<h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2>',
    '{title ? <h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2> : null}',
)
t = t.replace(
    '<h2 className="text-lg font-bold text-foreground">{title}</h2>',
    '{title ? <h2 className="text-lg font-bold text-foreground">{title}</h2> : null}',
)
p.write_text(t)
print('panel-shell', '{title ?' in t)

# 3) dashboard method — inject timeStats if missing
p = Path('backend/src/admin/admin.service.ts')
t = p.read_text()
if 'last1Hour' not in t and 'async dashboard()' in t:
    start = t.index('  async dashboard() {')
    end = t.index('\n  async getFinancialSummary', start)
    new_dash = Path('scripts/dashboard_method_snippet.txt').read_text() if Path('scripts/dashboard_method_snippet.txt').exists() else None
    if new_dash:
        t = t[:start] + new_dash + t[end:]
        p.write_text(t)
        print('dashboard replaced')
    else:
        print('dashboard snippet missing — skip')
else:
    print('dashboard already has last1Hour or missing method')

print('done')
