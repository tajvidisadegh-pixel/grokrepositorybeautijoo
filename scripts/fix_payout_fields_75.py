#!/usr/bin/env python3
from pathlib import Path
p = Path('backend/src/admin/admin.service.ts')
t = p.read_text()
old = '''    const data: { status: string; processedAt?: Date; adminNote?: string | null } = {
      status,
      processedAt: new Date(),
    };
    if (note != null) data.adminNote = note;
    const updated = await this.prisma.payoutRequest.update({ where: { id }, data: data as never });
'''
new = '''    const updated = await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        adminNote: note != null ? note : undefined,
      },
    });
'''
if old not in t:
    raise SystemExit('pattern not found')
p.write_text(t.replace(old, new, 1))
print('fixed')
