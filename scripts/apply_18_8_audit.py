#!/usr/bin/env python3
"""18.8: complete listAuditLogs filters + panel-api fetchAuditLogs query support."""
from pathlib import Path
import re

# --- admin.service.ts ---
svc = Path("backend/src/admin/admin.service.ts")
t = svc.read_text()
if "PLACEHOLDER" in t and len(t) < 200:
    raise SystemExit("admin.service PLACEHOLDER")

old = '''  async listAuditLogs(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 50));
    const where: Prisma.AuditLogWhereInput = {};
    if (q?.action) where.action = q.action;
    if (q?.entityType) where.entityType = q.entityType;
    if (q?.entityId) where.entityId = q.entityId;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }'''

new = '''  async listAuditLogs(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 50));
    const where: Prisma.AuditLogWhereInput = {};
    if (q?.action?.trim()) {
      where.action = { contains: String(q.action).trim(), mode: 'insensitive' };
    }
    if (q?.entityType?.trim()) where.entityType = String(q.entityType).trim();
    if (q?.entityId?.trim()) where.entityId = String(q.entityId).trim();
    if (q?.actorId?.trim()) where.actorId = String(q.actorId).trim();
    if (q?.startDate || q?.endDate) {
      where.createdAt = {};
      if (q?.startDate) {
        const d = new Date(q.startDate);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (q?.endDate) {
        const d = new Date(q.endDate);
        if (!Number.isNaN(d.getTime())) {
          if (String(q.endDate).length <= 10) d.setHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }
    }
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entityType,
      entityType: r.entityType,
      entityId: r.entityId,
      actorId: r.actorId,
      actor: r.actor
        ? {
            id: r.actor.id,
            phone: r.actor.phone,
            displayName: r.actor.profile?.displayName ?? null,
          }
        : null,
      before: r.before,
      after: r.after,
      meta: r.after ?? r.before,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
    }));
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }'''

if 'displayName: r.actor.profile' in t or "displayName: r.actor.profile" in t:
    print('listAuditLogs already enhanced')
elif old not in t:
    # try flexible whitespace
    pat = re.compile(
        r"async listAuditLogs\(q\?: any\) \{[\s\S]*?return \{ items, meta: \{ page, limit, total, totalPages: Math\.ceil\(total / limit\) \|\| 0 \} \};\n  }",
        re.M,
    )
    m = pat.search(t)
    if not m:
        raise SystemExit('listAuditLogs block not found')
    t = pat.sub(new.strip(), t, count=1)
    svc.write_text(t)
    print('listAuditLogs patched via regex')
else:
    svc.write_text(t.replace(old, new, 1))
    print('listAuditLogs patched exact')

# --- panel-api.ts ---
api = Path('frontend/src/lib/panel-api.ts')
p = api.read_text()
if 'PLACEHOLDER' in p and len(p) < 100:
    raise SystemExit('panel-api PLACEHOLDER')

old_type = "export type AuditLogItem = { id: string; action?: string; entity?: string; entityId?: string; actorId?: string; meta?: unknown; createdAt: string };"
new_type = """export type AuditLogItem = {
  id: string; action?: string; entity?: string; entityType?: string; entityId?: string;
  actorId?: string;
  actor?: { id?: string; phone?: string | null; displayName?: string | null } | null;
  meta?: unknown; before?: unknown; after?: unknown; ipAddress?: string | null;
  createdAt: string;
};
export type AuditLogsQuery = {
  page?: number; limit?: number; action?: string; actorId?: string;
  entityType?: string; entityId?: string; startDate?: string; endDate?: string;
};"""

if 'export type AuditLogsQuery' in p:
    print('AuditLogsQuery already present')
elif old_type in p:
    p = p.replace(old_type, new_type, 1)
    print('AuditLogItem type expanded')
else:
    print('WARN: AuditLogItem type not found for exact replace')

old_fn = '''export async function fetchAuditLogs(page = 1, limit = 30) {
  const res = await apiClient.get<Paginated<AuditLogItem> | AuditLogItem[]>(`/admin/audit-logs?page=${page}&limit=${limit}`);
  return { items: unwrapList(res as Paginated<AuditLogItem>), raw: res };
}'''

new_fn = '''export async function fetchAuditLogs(pageOrQuery: number | AuditLogsQuery = 1, limit = 30) {
  const q: AuditLogsQuery =
    typeof pageOrQuery === 'number' ? { page: pageOrQuery, limit } : { limit: 30, ...pageOrQuery };
  const params = new URLSearchParams();
  if (q.page != null) params.set('page', String(q.page));
  if (q.limit != null) params.set('limit', String(q.limit));
  if (q.action) params.set('action', q.action);
  if (q.actorId) params.set('actorId', q.actorId);
  if (q.entityType) params.set('entityType', q.entityType);
  if (q.entityId) params.set('entityId', q.entityId);
  if (q.startDate) params.set('startDate', q.startDate);
  if (q.endDate) params.set('endDate', q.endDate);
  const res = await apiClient.get<Paginated<AuditLogItem> & { meta?: { page?: number; limit?: number; total?: number; totalPages?: number } }>(
    `/admin/audit-logs?${params.toString()}`,
  );
  const items = unwrapList(res as Paginated<AuditLogItem>);
  const meta = (res as { meta?: { page?: number; limit?: number; total?: number; totalPages?: number } })?.meta
    ?? { page: q.page ?? 1, limit: q.limit ?? 30, total: items.length, totalPages: 1 };
  return { items, meta, raw: res };
}'''

if 'pageOrQuery' in p and 'AuditLogsQuery' in p and 'startDate' in p and 'fetchAuditLogs' in p:
    # check if already new signature
    if 'pageOrQuery: number | AuditLogsQuery' in p:
        print('fetchAuditLogs already enhanced')
    elif old_fn in p:
        p = p.replace(old_fn, new_fn, 1)
        print('fetchAuditLogs replaced exact')
    else:
        # flexible
        pat = re.compile(
            r"export async function fetchAuditLogs\([^{]+\{[\s\S]*?return \{ items: unwrapList\(res as Paginated<AuditLogItem>\), raw: res \};\n\}",
            re.M,
        )
        if pat.search(p):
            p = pat.sub(new_fn.strip(), p, count=1)
            print('fetchAuditLogs replaced regex')
        else:
            raise SystemExit('fetchAuditLogs not found')
elif old_fn in p:
    p = p.replace(old_fn, new_fn, 1)
    print('fetchAuditLogs replaced')
else:
    pat = re.compile(
        r"export async function fetchAuditLogs\([^{]+\{[\s\S]*?return \{ items: unwrapList\(res as Paginated<AuditLogItem>\), raw: res \};\n\}",
        re.M,
    )
    if pat.search(p):
        p = pat.sub(new_fn.strip(), p, count=1)
        print('fetchAuditLogs replaced regex')
    else:
        raise SystemExit('fetchAuditLogs not found')

api.write_text(p)
print('panel-api written', len(p))
