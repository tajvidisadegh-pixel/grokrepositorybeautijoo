'use client';

import { formatDateTime } from '@/lib/utils';

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
import { JalaliDateInput } from '@/components/ui/jalali-date-input';

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
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">لاگ حسابرسی</h1>
        <p className="text-sm text-gray">
          رویدادهای حساس سیستم با فیلتر تاریخ، کاربر و نوع عملیات
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={onFilterSubmit}>
          <div>
            <label className="mb-1 block text-xs text-gray">اکشن (پیشوند)</label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              {ACTION_PRESETS.map((a) => (
                <option key={a || 'all'} value={a}>
                  {a || 'همه'}
                </option>
              ))}
            </select>
          </div>
          <div>
            
          <div className="flex flex-wrap gap-1 text-[11px]">
            <span className="text-gray">میانبر:</span>
            {['impersonate', 'review.delete', 'booking.cancel', 'user.suspend', 'otp'].map((a) => (
              <button key={a} type="button" className="rounded-full border border-border px-2 py-0.5" onClick={() => setAction(a)}>{a}</button>
            ))}
          </div>

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
              placeholder="مثلاً user"
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
            <JalaliDateInput value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">تا تاریخ</label>
            <JalaliDateInput value={endDate} onChange={setEndDate} />
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
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-gray-light/40 text-xs text-gray">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">زمان</th>
                  <th className="px-3 py-2 text-right font-medium">اکشن</th>
                  <th className="px-3 py-2 text-right font-medium">موجودیت</th>
                  <th className="px-3 py-2 text-right font-medium">عامل</th>
                  <th className="px-3 py-2 text-right font-medium">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log) => (
                  <tr key={log.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-gray-light/30" onClick={() => setSelectedLog(log)}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{log.action}</td>
                    <td className="px-3 py-2 text-xs">
                      {log.entityType || '—'}
                      {log.entityId ? (
                        <span className="mt-0.5 block font-mono text-[10px] text-gray" dir="ltr">
                          {log.entityId.slice(0, 8)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      عامل: <span dir="ltr">{actorLabel(log)}</span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-gray">
                      {log.meta ? JSON.stringify(log.meta).slice(0, 80) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
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

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelectedLog(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">جزئیات رویداد</h2><p className="mt-1 text-xs text-gray">{formatDateTime(selectedLog.createdAt)}</p></div>
              <button type="button" className="text-sm underline" onClick={() => setSelectedLog(null)}>بستن</button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="rounded-xl bg-gray-light/40 p-3"><dt className="text-xs text-gray">اکشن</dt><dd className="mt-1 font-mono" dir="ltr">{selectedLog.action}</dd></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><dt className="text-xs text-gray">نوع موجودیت</dt><dd className="mt-1">{selectedLog.entityType || '—'}</dd></div>
                <div><dt className="text-xs text-gray">شناسه موجودیت</dt><dd className="mt-1 break-all font-mono text-xs" dir="ltr">{selectedLog.entityId || '—'}</dd></div>
                <div><dt className="text-xs text-gray">عامل</dt><dd className="mt-1">{actorLabel(selectedLog)}</dd></div>
                <div><dt className="text-xs text-gray">شناسه عامل</dt><dd className="mt-1 break-all font-mono text-xs" dir="ltr">{selectedLog.actorId || '—'}</dd></div>
              </div>
              <div><dt className="text-xs text-gray">داده رویداد</dt><dd className="mt-1 overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs text-white" dir="ltr"><pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.meta ?? {}, null, 2)}</pre></dd></div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
