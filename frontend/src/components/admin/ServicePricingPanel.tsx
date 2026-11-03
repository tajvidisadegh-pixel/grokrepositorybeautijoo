'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';

type PricingMode = 'fixed' | 'variable' | 'deposit';

type AttrOption = {
  id: string;
  label: string;
  suggestedPriceDelta: number;
  suggestedDurationDeltaMin: number;
  forcesDeposit: boolean;
  sortOrder: number;
  isActive: boolean;
};

type AttrGroup = {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  isActive: boolean;
  options: AttrOption[];
};

type PricingPayload = {
  id: string;
  name: string;
  allowFixed: boolean;
  allowVariable: boolean;
  allowDeposit: boolean;
  defaultPricingMode: string;
  attributeGroups: AttrGroup[];
};

type Props = {
  serviceId: string;
  serviceName: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function ServicePricingPanel({ serviceId, serviceName, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<PricingPayload | null>(null);

  const [allowFixed, setAllowFixed] = useState(true);
  const [allowVariable, setAllowVariable] = useState(false);
  const [allowDeposit, setAllowDeposit] = useState(false);
  const [defaultMode, setDefaultMode] = useState<PricingMode>('fixed');

  const [groupName, setGroupName] = useState('');
  const [optionDraft, setOptionDraft] = useState<
    Record<string, { label: string; priceDelta: string; durationDelta: string }>
  >({});

  const load = useCallback(async () => {
    setError(null);
    const row = await apiClient.get<PricingPayload>(`/admin/catalog-services/${serviceId}/pricing`);
    setData(row);
    setAllowFixed(row.allowFixed);
    setAllowVariable(row.allowVariable);
    setAllowDeposit(row.allowDeposit);
    setDefaultMode(
      (['fixed', 'variable', 'deposit'].includes(row.defaultPricingMode)
        ? row.defaultPricingMode
        : 'fixed') as PricingMode,
    );
  }, [serviceId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'بارگذاری ناموفق'));
  }, [load]);

  async function saveFlags() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const row = await apiClient.patch<PricingPayload>(
        `/admin/catalog-services/${serviceId}/pricing-flags`,
        {
          allowFixed,
          allowVariable,
          allowDeposit,
          defaultPricingMode: defaultMode,
        },
      );
      setData(row);
      setMsg('حالت‌های قیمت‌گذاری ذخیره شد');
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره');
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
      await load();
      setMsg('گروه ویژگی اضافه شد');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در افزودن گروه');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
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
      });
      setOptionDraft((prev) => ({ ...prev, [groupId]: { label: '', priceDelta: '0', durationDelta: '0' } }));
      await load();
      setMsg('گزینه اضافه شد');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در افزودن گزینه');
    } finally {
      setBusy(false);
    }
  }

  async function deactivateOption(optionId: string) {
    if (!confirm('این گزینه غیرفعال شود؟')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/attribute-options/${optionId}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  const groups = (data?.attributeGroups || []).filter((g) => g.isActive !== false);

  return (
    <div className="mt-3 rounded-2xl border border-[#2D6CDF]/30 bg-[#F7FBFF] p-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#0B2C4A]">قیمت‌گذاری: {serviceName}</h3>
          <p className="text-[11px] text-gray-500">
            تعیین کنید زیباگر برای این تخصص کدام حالت‌ها را بتواند انتخاب کند (ثابت / متغیر / بیعانه).
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs">
          بستن
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {msg && <p className="mt-2 text-xs text-emerald-600">{msg}</p>}

      {!data ? (
        <p className="mt-3 text-xs text-gray-500">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={allowFixed} onChange={(e) => setAllowFixed(e.target.checked)} />
              قیمت ثابت
            </label>
            <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={allowVariable}
                onChange={(e) => setAllowVariable(e.target.checked)}
              />
              قیمت متغیر (گزینه‌ها)
            </label>
            <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={allowDeposit}
                onChange={(e) => setAllowDeposit(e.target.checked)}
              />
              بیعانه
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-gray-500">حالت پیش‌فرض</label>
              <select
                value={defaultMode}
                onChange={(e) => setDefaultMode(e.target.value as PricingMode)}
                className="h-10 w-full rounded-xl border bg-white px-3 text-sm"
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
              className="h-10 rounded-xl bg-[#2D6CDF] px-4 text-sm text-white disabled:opacity-50"
            >
              ذخیره حالت‌ها
            </button>
          </div>

          <div className="mt-6 border-t border-[#2D6CDF]/20 pt-4">
            <h4 className="text-sm font-semibold text-[#0B2C4A]">گروه‌های ویژگی (برای قیمت متغیر)</h4>
            <p className="mt-1 text-[11px] text-gray-500">
              مثلاً «طول مو» یا «نوع رنگ». هر گروه چند گزینه با اختلاف قیمت پیشنهادی دارد.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="نام گروه (مثلاً طول مو)"
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

            <div className="mt-4 space-y-4">
              {groups.length === 0 && (
                <p className="text-xs text-gray-400">هنوز گروهی تعریف نشده.</p>
              )}
              {groups.map((g) => {
                const draft = optionDraft[g.id] || { label: '', priceDelta: '0', durationDelta: '0' };
                const options = (g.options || []).filter((o) => o.isActive !== false);
                return (
                  <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-3">
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
                        غیرفعال
                      </button>
                    </div>

                    <ul className="mt-2 space-y-1">
                      {options.map((o) => (
                        <li
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs"
                        >
                          <span>
                            {o.label}
                            <span className="mr-2 text-gray-400">
                              {o.suggestedPriceDelta >= 0 ? '+' : ''}
                              {o.suggestedPriceDelta.toLocaleString('fa-IR')} تومان ·{' '}
                              {o.suggestedDurationDeltaMin >= 0 ? '+' : ''}
                              {o.suggestedDurationDeltaMin} دقیقه
                              {o.forcesDeposit ? ' · بیعانه' : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deactivateOption(o.id)}
                            className="text-[#FF6F61]"
                          >
                            حذف
                          </button>
                        </li>
                      ))}
                      {options.length === 0 && (
                        <li className="text-xs text-gray-400">گزینه‌ای نیست</li>
                      )}
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
                        type="number"
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
                        type="number"
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
          </div>
        </>
      )}
    </div>
  );
}
