#!/usr/bin/env python3
from pathlib import Path
p = Path('backend/src/admin/admin-ops.controller.ts')
t = p.read_text()
old = """    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'professional.create',
          entityType: 'professional',
          entityId: pro.id,
          before: null,
          after: { phone, slug } as any,
        },
      });
    } catch { /* non-blocking */ }"""
new = """    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'professional.create',
          entityType: 'professional',
          entityId: pro.id,
          after: { phone, slug } as any,
        },
      });
    } catch { /* non-blocking */ }"""
if old in t:
    p.write_text(t.replace(old, new))
    print('fixed before:null')
elif 'before: null' in t:
    p.write_text(t.replace('before: null,\n          ', ''))
    print('fixed soft')
else:
    print('already ok or miss')
