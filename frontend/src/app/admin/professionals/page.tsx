'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchAdminProfessionals, adminSetProfessionalStatus, type AdminProfessional } from '@/lib/panel-api';
import { persianProfessionalStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';

const STATUSES = ['approved', 'pending_review', 'suspended', 'rejected', 'draft'];

export default function AdminProfessionalsPage() {
  const [items, setItems] = useState<AdminProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await fetchAdminProfessionals(1, 50)).items); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function onStatus(id: string, status: string) {
    setBusyId(id); setError(null);
    try { await adminSetProfessionalStatus(id, status); await load(); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setBusyId(null); }
  }
  if (loading) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">زیباگرها</h1>
        <p className="mt-1 text-sm text-gray">مدیریت وضعیت از /admin/professionals</p></div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {items.length === 0 ? <PanelEmpty title="زیباگری یافت نشد" /> : (
        <ul className="space-y-3">{items.map((p) => (
          <li key={p.id}><Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.user?.profile?.displayName || p.title || p.slug}</p>
                <p className="text-xs text-gray" dir="ltr">{p.slug} · {p.user?.phone || ''}</p>
              </div>
              <span className="rounded-full bg-coral-soft px-3 py-1 text-xs text-coral">{persianProfessionalStatus(p.status)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.filter((s) => s !== p.status).map((s) => (
                <Button key={s} size="sm" variant="outline" loading={busyId === p.id} onClick={() => onStatus(p.id, s)}>
                  {persianProfessionalStatus(s)}
                </Button>
              ))}
            </div>
          </Card></li>
        ))}</ul>
      )}
    </div>
  );
}
