#!/usr/bin/env python3
from pathlib import Path

# Extend AdminProfessional type
api = Path('frontend/src/lib/panel-api.ts')
at = api.read_text()
old_type = """export type AdminProfessional = {
  id: string; slug: string; title?: string | null; status: string; isFeatured?: boolean;
  ratingAvg?: number | string | null; ratingCount?: number | null; createdAt?: string; publishedAt?: string | null;
  city?: string | null; specialties?: string[]; bookingCount?: number; reviewCount?: number; mediaCount?: number;
  user?: { phone?: string | null; profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null } | null;
};"""
new_type = """export type AdminProfessional = {
  id: string; slug: string; title?: string | null; status: string; isFeatured?: boolean;
  ratingAvg?: number | string | null; ratingCount?: number | null; createdAt?: string; publishedAt?: string | null;
  city?: string | null; specialties?: string[]; bookingCount?: number; reviewCount?: number; mediaCount?: number;
  userId?: string | null;
  user?: { id?: string; phone?: string | null; profile?: { displayName?: string | null; firstName?: string | null; lastName?: string | null; avatarUrl?: string | null } | null } | null;
};"""
if old_type in at:
    api.write_text(at.replace(old_type, new_type))
    print('type extended')
else:
    print('type pattern miss')

# Simplify notify line
page = Path('frontend/src/app/admin/professionals/page.tsx')
pt = page.read_text()
pt2 = pt.replace(
    "const userId = (p as { userId?: string; user?: { id?: string } }).userId || p.user?.id;",
    "const userId = p.userId || p.user?.id;",
)
if pt2 != pt:
    page.write_text(pt2)
    print('page fixed')
else:
    print('page pattern miss')
print('DONE')
