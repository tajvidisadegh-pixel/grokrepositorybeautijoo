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
  sortOrder?: number;
};

type AttrGroup = {
  id: string;
  name: string;
  required?: boolean;
  isActive?: boolean;
  sortOrder?: number;
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

type TemplateRow = { id: string; name: string; isActive?: boolean };

type Props = {
  serviceId: string;
  serviceName: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function ServicePricingPanel({ serviceId, serviceName, onClose, onSaved }: Props) {
  const [data, setData] = useState<PricingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [allowFixed, setAllowFixed] = useState(true);
  const [allowVariable, setAllowVariable] = useState(false);
  const [allowDeposit, setAllowDeposit] = useState(false);
  const [defaultMode, setDefaultMode] = useState('fixed');

  const [groupName, setGroupName] = useState('');
  const [optionDraft, setOptionDraft] = useState<
    Record<string, { label: string; priceDelta: string; durationDelta: string; forcesDeposit: boolean }>
  >({});

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [variantName, setVariantName] = useState('');

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const row = await apiClient.get<PricingPayload>(`/admin/catalog-services/${serviceId}/pricing`);
      setData(row);
      setAllowFixed(row.allowFixed !== false);
      setAllowVariable(!!row.allowVariable);
      setAllowDeposit(!!row.allowDeposit);
      setDefaultMode(row.defaultPricingMode || 'fixed');
    } catch (e) {
      setError(friendlyApiError(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiClient.get<TemplateRow[] | { items?: TemplateRow[] }>(
        '/admin/attribute-templates',
      );
      const list = Array.isArray(res) ? res : res.items || [];
      setTemplates(list.filter((t) => t.isActive !== false));
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTemplates();
  }, [load, loadTemplates]);

  async function saveFlags() {
    if (!allowFixed && !allowVariable && !allowDeposit) {
      setError('حداقل یک حالت قیمت باید فعال باشد');
      return;
    }
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
      setData((prev) => (prev ? { ...prev, ...row } : row));
      setMsg('حالت‌های مجاز ذخیره شد');
      onSaved?.();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyTemplate() {
    if (!templateId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/admin/catalog-services/${serviceId}/apply-template`, { templateId });
      setMsg('قالب اعمال شد');
      await load();
      onSaved?.();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/admin/catalog-services/${serviceId}/save-as-template`, { name });
      setNewTemplateName('');
      setMsg('به‌عنوان قالب ذخیره شد');
      await loadTemplates();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addVariant() {
    if (!variantName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/admin/catalog-services/${serviceId}/variants`, {
        name: variantName.trim(),
      });
      setVariantName('');
      setMsg('زیرخدمت اضافه شد');
      onSaved?.();
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
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleForcesDeposit(optionId: string, next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiClient.patch(`/admin/attribute-options/${optionId}`, { forcesDeposit: next });
      await load();
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
    if (!confirm('این گزینه غیرفعال شود؟')) return;
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

  const groups = (data?.attributeGroups || []).filter((g) => g.isActive !== false);

  // lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={`قیمت‌گذاری ${serviceName}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="بستن"
        onClick={onClose}
      />
      <div className="relative z-[81] flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-[#0B2C4A]">قیمت‌گذاری: {serviceName}</h3>
            <p className="mt-0.5 text-[11px] text-gray-500">
              مشخص کنید زیباگر برای این خدمت کدام حالت‌ها را بتواند استفاده کند.
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

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          {msg && (
            <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{msg}</p>
          )}

          {loading || !data ? (
            <p className="text-sm text-gray-500">در حال بارگذاری…</p>
          ) : (
            <div className="space-y-6">
              {/* 1 — allowed modes */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-[#0B2C4A]">حالت‌های قیمت مجاز</h4>
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

              {/* 2 — variable attributes */}
              {allowVariable && (
                <section className="space-y-3 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-[#0B2C4A]">ویژگی‌ها و گزینه‌ها</h4>
                  <p className="text-[11px] text-gray-500">
                    گروه و گزینه برای محاسبه قیمت مشتری. زیباگر فقط مبالغ Δ را تنظیم می‌کند.
                  </p>

                  <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[#2D6CDF]/40 bg-[#F7FBFF] p-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] text-gray-500">اعمال قالب آماده</label>
                      <select
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm"
                      >
                        <option value="">انتخاب قالب…</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !templateId}
                      onClick={() => void applyTemplate()}
                      className="h-10 rounded-xl border border-[#2D6CDF] px-4 text-sm text-[#2D6CDF] disabled:opacity-50"
                    >
                      اعمال قالب
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
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

                  <div className="space-y-3">
                    {groups.length === 0 && (
                      <p className="text-xs text-gray-400">هنوز گروهی تعریف نشده.</p>
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
                              غیرفعال
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
                          <label className="mt-1.5 flex items-center gap-2 text-[11px] text-amber-900">
                            <input
                              type="checkbox"
                              checked={!!draft.forcesDeposit}
                              onChange={(e) =>
                                setOptionDraft((prev) => ({
                                  ...prev,
                                  [g.id]: { ...draft, forcesDeposit: e.target.checked },
                                }))
                              }
                            />
                            اگر مشتری این گزینه را زد → مسیر بیعانه
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="نام قالب جدید"
                      className="max-w-xs"
                    />
                    <button
                      type="button"
                      disabled={busy || !newTemplateName.trim() || groups.length === 0}
                      onClick={() => void saveAsTemplate()}
                      className="rounded-xl border border-border px-3 py-2 text-xs disabled:opacity-50"
                    >
                      ذخیره به‌عنوان قالب
                    </button>
                  </div>
                </section>
              )}

              {/* 3 — deposit note */}
              {allowDeposit && (
                <section className="space-y-2 border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-[#0B2C4A]">بیعانه + بررسی</h4>
                  <p className="text-[11px] text-gray-500">
                    زیباگر مبلغ بیعانه و بازه تقریبی را در پنل خودش تنظیم می‌کند. اینجا فقط مجوز حالت را
                    باز می‌کنید.
                  </p>
                </section>
              )}

              {/* 4 — variants */}
              <section className="space-y-2 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-[#0B2C4A]">زیرخدمت / واریانت (اختیاری)</h4>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    placeholder="نام زیرخدمت"
                    className="max-w-xs"
                  />
                  <button
                    type="button"
                    disabled={busy || !variantName.trim()}
                    onClick={() => void addVariant()}
                    className="rounded-xl border border-border px-3 py-2 text-xs disabled:opacity-50"
                  >
                    + زیرخدمت
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
