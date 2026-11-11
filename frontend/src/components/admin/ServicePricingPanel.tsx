'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

type AttrOption = {
  id: string;
  label: string;
  suggestedPriceDelta?: number;
  suggestedDurationDeltaMin?: number;
  forcesDeposit?: boolean;
  isActive?: boolean;
};

type AttrGroup = {
  id: string;
  name: string;
  required?: boolean;
  isActive?: boolean;
  options?: AttrOption[];
};

type PricingPayload = {
  id: string;
  name: string;
  allowFixed: boolean;
  allowVariable: boolean;
  allowDeposit: boolean;
  defaultPricingMode: string;
  attributeGroups?: AttrGroup[];
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
  const [groups, setGroups] = useState<AttrGroup[]>([]);
  const [groupName, setGroupName] = useState('');
  const [optionDraft, setOptionDraft] = useState<
    Record<string, { label: string; priceDelta: string; durationDelta: string; forcesDeposit: boolean }>
  >({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const row = await apiClient.get<PricingPayload>(`/admin/catalog-services/${serviceId}/pricing`);
      setAllowFixed(row.allowFixed !== false);
      setAllowVariable(!!row.allowVariable);
      setAllowDeposit(!!row.allowDeposit);
      setDefaultMode(row.defaultPricingMode || 'fixed');
      setGroups((row.attributeGroups || []).filter((g) => g.isActive !== false));
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

  async function addGroup() {
    if (!groupName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/admin/catalog-services/${serviceId}/attribute-groups`, {
        name: groupName.trim(),
        required: true,
      });
      setGroupName('');
      setMsg('گروه اضافه شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivateGroup(groupId: string) {
    if (!confirm('این گروه غیرفعال شود؟')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/attribute-groups/${groupId}`);
      await load();
      setMsg('گروه غیرفعال شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addOption(groupId: string) {
    const d = optionDraft[groupId];
    if (!d?.label?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/admin/attribute-groups/${groupId}/options`, {
        label: d.label.trim(),
        suggestedPriceDelta: Number(d.priceDelta) || 0,
        suggestedDurationDeltaMin: Number(d.durationDelta) || 0,
        forcesDeposit: !!d.forcesDeposit,
      });
      setOptionDraft((prev) => ({
        ...prev,
        [groupId]: { label: '', priceDelta: '0', durationDelta: '0', forcesDeposit: false },
      }));
      setMsg('گزینه اضافه شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivateOption(optionId: string) {
    if (!confirm('این گزینه حذف شود؟')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/attribute-options/${optionId}`);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleForcesDeposit(optionId: string, next: boolean) {
    setBusy(true);
    try {
      await apiClient.patch(`/admin/attribute-options/${optionId}`, { forcesDeposit: next });
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
      const existing = (current.attributeGroups || []).filter((g) => g.isActive !== false);
      if (existing.length === 0) {
        const g1 = await apiClient.post<{ id: string }>(
          `/admin/catalog-services/${serviceId}/attribute-groups`,
          { name: 'طول مو', required: true },
        );
        for (const opt of [
          { label: 'کوتاه', suggestedPriceDelta: 0, suggestedDurationDeltaMin: 0 },
          { label: 'متوسط', suggestedPriceDelta: 50000, suggestedDurationDeltaMin: 15 },
          { label: 'بلند', suggestedPriceDelta: 120000, suggestedDurationDeltaMin: 30 },
        ]) {
          await apiClient.post(`/admin/attribute-groups/${g1.id}/options`, opt);
        }
        const g2 = await apiClient.post<{ id: string }>(
          `/admin/catalog-services/${serviceId}/attribute-groups`,
          { name: 'نوع کار', required: false },
        );
        for (const opt of [
          { label: 'اصلاح ساده', suggestedPriceDelta: 0, suggestedDurationDeltaMin: 0 },
          { label: 'رنگ ریشه‌ای', suggestedPriceDelta: 200000, suggestedDurationDeltaMin: 45 },
          {
            label: 'دکلره',
            suggestedPriceDelta: 450000,
            suggestedDurationDeltaMin: 90,
            forcesDeposit: true,
          },
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
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="بستن" onClick={onClose} />
      <div className="relative z-[81] flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-[#0B2C4A]">قیمت‌گذاری: {serviceName}</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">
              حالت‌های مجاز + گروه‌ها و گزینه‌های متغیر (افزودن / حذف)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium"
          >
            بستن
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p>}
          {loading ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : (
            <>
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0B2C4A]">۱) حالت‌های قیمت مجاز</h4>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowFixed}
                      onChange={(e) => setAllowFixed(e.target.checked)}
                    />
                    قیمت ثابت
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowVariable}
                      onChange={(e) => setAllowVariable(e.target.checked)}
                    />
                    قیمت با گزینه‌ها
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowDeposit}
                      onChange={(e) => setAllowDeposit(e.target.checked)}
                    />
                    بیعانه + بررسی
                  </label>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">پیش‌فرض برای زیباگر</p>
                  <select
                    value={defaultMode}
                    onChange={(e) => setDefaultMode(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm sm:w-auto"
                  >
                    {allowFixed && <option value="fixed">ثابت</option>}
                    {allowVariable && <option value="variable">متغیر</option>}
                    {allowDeposit && <option value="deposit">بیعانه</option>}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={busy || (!allowFixed && !allowVariable && !allowDeposit)}
                  onClick={() => void saveFlags()}
                  className="h-11 w-full rounded-xl bg-[#2D6CDF] px-4 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
                >
                  ذخیره حالت‌ها
                </button>
              </section>

              <section className="space-y-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-[#0B2C4A]">۲) ویژگی‌ها و گزینه‌ها (افزونه قیمت)</h4>
                <p className="text-[11px] text-gray-600">
                  گروه بسازید (مثلاً طول مو)، بعد برای هر گروه گزینه با Δ قیمت و مدت اضافه کنید.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void applySampleVariable()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  اعمال نمونه (طول مو + نوع کار)
                </button>

                <div className="flex flex-wrap gap-2">
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="نام گروه جدید (مثلاً حجم مو)"
                    className="max-w-xs"
                  />
                  <button
                    type="button"
                    disabled={busy || !groupName.trim()}
                    onClick={() => void addGroup()}
                    className="rounded-xl bg-[#FF6F61] px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    + گروه
                  </button>
                </div>

                <div className="space-y-3">
                  {groups.length === 0 && (
                    <p className="text-xs text-gray-400">هنوز گروهی نیست — نمونه بزنید یا گروه بسازید.</p>
                  )}
                  {groups.map((g) => {
                    const draft = optionDraft[g.id] || {
                      label: '',
                      priceDelta: '0',
                      durationDelta: '0',
                      forcesDeposit: false,
                    };
                    const options = (g.options || []).filter((o) => o.isActive !== false);
                    return (
                      <div key={g.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#0B2C4A]">
                            {g.name}
                            {g.required && (
                              <span className="mr-2 text-[10px] text-gray-400">(اجباری)</span>
                            )}
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deactivateGroup(g.id)}
                            className="text-xs text-[#FF6F61]"
                          >
                            حذف گروه
                          </button>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {options.map((o) => (
                            <li
                              key={o.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs"
                            >
                              <span>
                                {o.label}
                                <span className="mr-2 text-gray-400">
                                  {' '}
                                  · Δ{o.suggestedPriceDelta ?? 0} ت · Δ
                                  {o.suggestedDurationDeltaMin ?? 0} د
                                </span>
                                {o.forcesDeposit && (
                                  <span className="mr-1 rounded bg-amber-50 px-1 text-amber-800">
                                    بیعانه
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-[10px] text-gray-600">
                                  <input
                                    type="checkbox"
                                    checked={!!o.forcesDeposit}
                                    disabled={busy}
                                    onChange={(e) =>
                                      void toggleForcesDeposit(o.id, e.target.checked)
                                    }
                                  />
                                  forcesDeposit
                                </label>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void deactivateOption(o.id)}
                                  className="text-[#FF6F61]"
                                >
                                  حذف
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 grid gap-2 sm:grid-cols-4">
                          <Input
                            value={draft.label}
                            onChange={(e) =>
                              setOptionDraft((prev) => ({
                                ...prev,
                                [g.id]: { ...draft, label: e.target.value },
                              }))
                            }
                            placeholder="برچسب گزینه"
                          />
                          <Input
                            value={draft.priceDelta}
                            onChange={(e) =>
                              setOptionDraft((prev) => ({
                                ...prev,
                                [g.id]: { ...draft, priceDelta: e.target.value },
                              }))
                            }
                            placeholder="Δ قیمت"
                            inputMode="numeric"
                          />
                          <Input
                            value={draft.durationDelta}
                            onChange={(e) =>
                              setOptionDraft((prev) => ({
                                ...prev,
                                [g.id]: { ...draft, durationDelta: e.target.value },
                              }))
                            }
                            placeholder="Δ دقیقه"
                            inputMode="numeric"
                          />
                          <button
                            type="button"
                            disabled={busy || !draft.label.trim()}
                            onClick={() => void addOption(g.id)}
                            className="rounded-xl border border-[#2D6CDF] px-3 py-2 text-xs text-[#2D6CDF] disabled:opacity-50"
                          >
                            + گزینه
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
