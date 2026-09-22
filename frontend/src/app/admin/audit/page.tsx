'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAuditLogs,
  type AuditLogItem,
  type AuditLogsQuery,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

const ACTION_PRESETS = [
  '',
  'user.',
  'auth.',
  'professional.',
  'booking.',
  'payment.',
  'admin.',
];

export default function AdminAuditPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q: AuditLogsQuery = {
        page,
        limit: 30,
        action: action.trim() || undefined,
        actorId: actorId.trim() || undefined,
        entityType: entityType.trim() || undefined,
        entityId: entityId.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      const res = await fetchAuditLogs(q);
      setItems(res.items);
      setMeta({
        page: res.meta?.page ?? page,
        limit: res.meta?.limit ?? 30,
        total: res.meta?.total ?? res.items.length,
        totalPages: res.meta?.totalPages ?? 1,
      });
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, action, actorId, entityType, entityId, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  function onFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    // load runs via state change when page resets; if already 1, force reload
    if (page === 1) void load();
  }

  function clearFilters() {
    setAction('');
    setActorId('');
    setEntityType('');
    setEntityId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  function actorLabel(log: AuditLogItem) {
    if (log.actor?.displayName) return log.actor.displayName;
    if (log.actor?.phone) return log.actor.phone;
    return log.actorId ? log.actorId.slice(0, 8) + '…' : '—';
  }

  function formatMeta(log: AuditLogItem) {
    const m = log.after ?? log.meta ?? log.before;
    if (m == null) return null;
    try {
      return typeof m === 'string' ? m : JSON.stringify(m);
    } catch {
      return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لاگ‌های ممیزی</h1>
        <p className="mt-1 text-sm text-gray">
          رویدادهای حساس سیستم با فیلتر تاریخ، کاربر و نوع عملیات
        </p>
      </div>

      <Card className="space-y-3">
        <form onSubmit={onFilterSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray">عملیات (شامل)</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="مثلاً user. یا auth.refresh"
              list="audit-action-presets"
            />
            <datalist id="audit-action-presets">
              {ACTION_PRESETS.filter(Boolean).map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">شناسه عامل (actorId)</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              dir="ltr"
              placeholder="uuid"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">نوع موجودیت</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="user / professional / booking"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">شناسه موجودیت</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              dir="ltr"
              placeholder="uuid"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">از تاریخ</label>
            <input
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">تا تاریخ</label>
            <input
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <Button type="submit">اعمال فیلتر</Button>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              پاک کردن
            </Button>
            <span className="text-xs text-gray">
              {meta.total > 0 ? `${meta.total} رکورد` : ''}
            </span>
          </div>
        </form>
      </Card>

      {loading ? (
        <PanelLoading />
      ) : error ? (
        <PanelError message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <PanelEmpty title="لاگی یافت نشد" />
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((log) => {
              const metaStr = formatMeta(log);
              return (
                <li key={log.id}>
                  <Card className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-semibold">
                        {log.action || '—'}
                        {(log.entity || log.entityType) ? ` · ${log.entity || log.entityType}` : ''}
                      </span>
                      <span className="text-xs text-gray" dir="ltr">
                        {new Date(log.createdAt).toLocaleString('fa-IR')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray">
                      <span>
                        عامل: <span dir="ltr">{actorLabel(log)}</span>
                      </span>
                      {log.entityId && (
                        <span dir="ltr">entity: {log.entityId.slice(0, 8)}…</span>
                      )}
                      {log.ipAddress && <span dir="ltr">ip: {log.ipAddress}</span>}
                    </div>
                    {metaStr && (
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed" dir="ltr">
                        {metaStr.length > 400 ? metaStr.slice(0, 400) + '…' : metaStr}
                      </pre>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                قبلی
              </Button>
              <span className="text-sm text-gray">
                صفحه {meta.page} از {meta.totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
