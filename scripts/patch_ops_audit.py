#!/usr/bin/env python3
from pathlib import Path
p = Path('backend/src/admin/admin-ops.controller.ts')
t = p.read_text()
old = "await this.audit(actorId, 'professional.create', 'professional', pro.id, { phone, slug });"
new = """try {
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
if old in t:
    p.write_text(t.replace(old, new))
    print('fixed')
else:
    print('miss or already fixed', 'this.audit' in t)
