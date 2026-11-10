'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

type PricingPayload = {
  id: string;
  name: string;
  allowFixed: boolean;
  allowVariable: boolean;
  allowDeposit: boolean;
  defaultPricingMode: string;
  attributeGroups?: any[];
};

type Props = {
  serviceId: string;
  serviceName: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function ServicePricingPanel({ serviceId, serviceName, onClose, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowFixed, setAllowFixed] = useState(true);
  const [allowVariable, setAllowVariable] = useState(false);
  const [allowDeposit, setAllowDeposit] = useState(false);
  const [defaultMode, setDefaultMode] = useState('fixed');
  const [groups, setGroups] = useState<any[]>([]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const row = await apiClient.get<PricingPayload>(`/admin/catalog-services/${serviceId}/pricing`);
      setAllowFixed(row.allowFixed !== false);
      setAllowVariable(!!row.allowVariable);
      setAllowDeposit(!!row.allowDeposit);
      setDefaultMode(row.defaultPricingMode || 'fixed');
      setGroups((row.attributeGroups || []).filter((g: any) => g.isActive !== false));
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { void load(); }, [load]);

  function resolveDefaultMode(): string {
    const allowed: string[] = [];
    if (allowFixed) allowed.push('fixed');
    if (allowVariable) allowed.push('variable');
    if (allowDeposit) allowed.push('deposit');
    if (allowed.includes(defaultMode)) return defaultMode;
    return allowed[0] || 'fixed';
  }

  async function saveFlags() {
    if (!allowFixed && !allowVariable && !allowDeposit) {
      setError('حداقل یک حالت قیمت باید فعال باشد');
      return;
    }
    const mode = resolveDefaultMode();
    if (mode !== defaultMode) setDefaultMode(mode);
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiClient.patch(`/admin/catalog-services/${serviceId}/pricing-flags`, {
        allowFixed,
        allowVariable,
        allowDeposit,
        defaultPricingMode: mode,
      });
      setMsg('حالت‌های مجاز ذخیره شد');
      onSaved?.();
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function applySampleVariable() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiClient.patch(`/admin/catalog-services/${serviceId}/pricing-flags`, {
        allowFixed: true,
        allowVariable: true,
        allowDeposit,
        defaultPricingMode: 'variable',
      });
      setAllowFixed(true);
      setAllowVariable(true);
      setDefaultMode('variable');

      const current = await apiClient.get<PricingPayload>(`/admin/catalog-services/${serviceId}/pricing`);
      const existing = (current.attributeGroups || []).filter((g: any) => g.isActive !== false);
      if (existing.length === 0) {
        const g1 = await apiClient.post<{ id: string }>(`/admin/catalog-services/${serviceId}/attribute-groups`, { name: 'طول مو', required: true });
        for (const opt of [
          { label: 'کوتاه', suggestedPriceDelta: 0, suggestedDurationDeltaMin: 0 },
          { label: 'متوسط', suggestedPriceDelta: 50000, suggestedDurationDeltaMin: 15 },
          { label: 'بلند', suggestedPriceDelta: 120000, suggestedDurationDeltaMin: 30 },
        ]) {
          await apiClient.post(`/admin/attribute-groups/${g1.id}/options`, opt);
        }
        const g2 = await apiClient.post<{ id: string }>(`/admin/catalog-services/${serviceId}/attribute-groups`, { name: 'نوع کار', required: false });
        for (const opt of [
          { label: 'اصلاح ساده', suggestedPriceDelta: 0, suggestedDurationDeltaMin: 0 },
          { label: 'رنگ ریشه‌ای', suggestedPriceDelta: 200000, suggestedDurationDeltaMin: 45 },
          { label: 'دکلره', suggestedPriceDelta: 450000, suggestedDurationDeltaMin: 90, forcesDeposit: true },
        ]) {
          await apiClient.post(`/admin/attribute-groups/${g2.id}/options`, opt);
        }
      }
      setMsg('نمونه قیمت متغیر اعمال شد — گروه «طول مو» و «نوع کار»');
      await load();
      onSaved?.();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" dir="rtl" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="بستن" onClick={onClose} />
      <div className="relative z-[81] flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-[#0B2C4A]">قیمت‌گذاری: {serviceName}</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">حالت‌های مجاز برای زیباگر + نمونه قیمت متغیر</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium">بستن</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p>}
          {loading ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : (
            <>
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0B2C4A]">حالت‌های قیمت مجاز</h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input type="checkbox" checked={allowFixed} onChange={(e) => setAllowFixed(e.target.checked)} />
                    قیمت ثابت
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input type="checkbox" checked={allowVariable} onChange={(e) => setAllowVariable(e.target.checked)} />
                    قیمت با گزینه‌ها
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input type="checkbox" checked={allowDeposit} onChange={(e) => setAllowDeposit(e.target.checked)} />
                    بیعانه + بررسی
                  </label>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">پیش‌فرض برای زیباگر</p>
                  <select value={defaultMode} onChange={(e) => setDefaultMode(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm sm:w-auto">
                    {allowFixed && <option value="fixed">ثابت</option>}
                    {allowVariable && <option value="variable">متغیر</option>}
                    {allowDeposit && <option value="deposit">بیعانه</option>}
                  </select>
                </div>
                <button type="button" disabled={busy || (!allowFixed && !allowVariable && !allowDeposit)} onClick={() => void saveFlags()} className="h-11 w-full rounded-xl bg-[#2D6CDF] px-4 text-sm font-medium text-white disabled:opacity-50 sm:w-auto">
                  ذخیره حالت‌ها
                </button>
              </section>

              <section className="space-y-2 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-[#0B2C4A]">نمونه قیمت متغیر</h4>
                <p className="text-[11px] text-gray-600">با زدن دکمه زیر، گروه‌های نمونه «طول مو» و «نوع کار» ساخته می‌شوند تا ببینید قیمت متغیر چطور کار می‌کند.</p>
                <button type="button" disabled={busy} onClick={() => void applySampleVariable()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                  اعمال نمونه قیمت متغیر
                </button>
                {groups.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-700">
                    {groups.map((g: any) => (
                      <li key={g.id} className="rounded-lg bg-gray-50 px-2 py-1">
                        {g.name} ({(g.options || []).filter((o: any) => o.isActive !== false).length} گزینه)
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
