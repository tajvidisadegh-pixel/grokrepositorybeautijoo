'use client';

/**
 * منوی خدمات یکپارچه — تخصص + خانواده + جدول قیمت
 * UX مطابق طرح ماتریسی #60 (بدون صفحه جدا برای تخصص)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchCategories,
  fetchMyServices,
  upsertMyService,
  upsertMyPriceRule,
  fetchMyPriceRules,
  setMySelectedCategories,
  fetchMyProfessional,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type PriceRuleItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { CATALOG_TEMPLATE, matrixLabels } from '@/lib/catalog-template';
import { PriceMatrix } from '@/components/catalog/price-matrix';
import { formatPrice } from '@/lib/utils';

type Step = 1 | 2 | 3;

export default function ZibagarServicesPage() {
  const [step, setStep] = useState<Step>(1);
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [activeServiceName, setActiveServiceName] = useState('');
  const [psId, setPsId] = useState<string | null>(null);
  const [rules, setRules] = useState<PriceRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [familySearch, setFamilySearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, services, pro] = await Promise.all([
        fetchCategories(),
        fetchMyServices(),
        fetchMyProfessional().catch(() => null),
      ]);
      setTree(Array.isArray(cats) ? cats : []);
      setMine(Array.isArray(services) ? services : []);
      const sel = (pro as { selectedCategoryIds?: string[] } | null)?.selectedCategoryIds;
      if (Array.isArray(sel) && sel.length) setSelectedRootIds(sel);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roots = useMemo(() => {
    const list = tree.filter((c) => !c.parentId);
    return list.length ? list : tree;
  }, [tree]);

  const families = useMemo(() => {
    if (!rootId) return [];
    return tree.filter((c) => c.parentId === rootId);
  }, [tree, rootId]);

  const familyNode = useMemo(
    () => tree.find((c) => c.id === familyId) || null,
    [tree, familyId],
  );

  const familyServices = useMemo(() => {
    const svcs =
      (familyNode as CatalogCategory & { services?: { id: string; name: string }[] })?.services ||
      [];
    const q = familySearch.trim();
    if (!q) return svcs;
    return svcs.filter((s) => s.name.includes(q));
  }, [familyNode, familySearch]);

  const templateFamily = useMemo(() => {
    const root = roots.find((r) => r.id === rootId);
    if (!root || !familyNode) return null;
    const sp = CATALOG_TEMPLATE.find((s) => s.name === root.name || s.slug === root.slug);
    if (!sp) return null;
    return sp.families.find((f) => f.name === familyNode.name) || null;
  }, [roots, rootId, familyNode]);

  async function toggleRoot(id: string) {
    const next = selectedRootIds.includes(id)
      ? selectedRootIds.filter((x) => x !== id)
      : [...selectedRootIds, id];
    setSelectedRootIds(next);
    setBusy(true);
    setError(null);
    try {
      await setMySelectedCategories(next);
      setMsg('تخصص‌ها ذخیره شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function enableAndPrice(serviceId: string, serviceName: string) {
    setBusy(true);
    setError(null);
    setActiveServiceName(serviceName);
    try {
      let ps = mine.find((m) => m.serviceId === serviceId || m.service?.id === serviceId);
      if (!ps) {
        await upsertMyService({
          serviceId,
          durationMin: 60,
          price: 0,
          isActive: true,
        });
        const refreshed = await fetchMyServices();
        setMine(refreshed);
        ps = refreshed.find((m) => m.serviceId === serviceId || m.service?.id === serviceId);
      }
      if (!ps) throw new Error('خدمت فعال نشد');
      setPsId(ps.id);
      let pr = await fetchMyPriceRules(ps.id);

      const variant = templateFamily?.variants.find((v) => v.name === serviceName);
      if (templateFamily && variant) {
        const labels = matrixLabels(templateFamily, variant);
        const have = new Set(pr.map((r) => r.label));
        for (const label of labels) {
          if (!have.has(label)) {
            await upsertMyPriceRule(ps.id, { label, price: 0 });
          }
        }
        pr = await fetchMyPriceRules(ps.id);
      } else if (pr.length === 0) {
        await upsertMyPriceRule(ps.id, { label: 'قیمت پایه', price: ps.price || 0 });
        pr = await fetchMyPriceRules(ps.id);
      }
      setRules(pr);
      setStep(3);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveCell(label: string, price: number, ruleId?: string) {
    if (!psId) return;
    setBusy(true);
    try {
      await upsertMyPriceRule(psId, { id: ruleId, label, price });
      const next = await fetchMyPriceRules(psId);
      setRules(next);
      const positive = next.filter((r) => r.price > 0).map((r) => r.price);
      if (positive.length) {
        const min = Math.min(...positive);
        const ps = mine.find((m) => m.id === psId);
        if (ps?.serviceId) {
          await upsertMyService({
            serviceId: ps.serviceId,
            durationMin: ps.durationMin || 60,
            price: min,
            isActive: true,
          });
        }
      }
      setMsg('ذخیره شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function batchApply(labels: string[], price: number) {
    if (!psId) return;
    setBusy(true);
    try {
      for (const label of labels) {
        const existing = rules.find((r) => r.label === label);
        await upsertMyPriceRule(psId, { id: existing?.id, label, price });
      }
      setRules(await fetchMyPriceRules(psId));
      setMsg(`قیمت ${formatPrice(price)} روی ${labels.length.toLocaleString('fa-IR')} مورد اعمال شد`);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading label="بارگذاری منوی خدمات…" />;
  if (error && !tree.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-24" dir="rtl">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0B2C4A]">منوی خدمات من</h1>
        <p className="mt-1 text-sm text-gray">فقط خدمات فعال شما به مشتری نشان داده می‌شود</p>
      </div>

      {/* Step indicator — matches design */}
      <div className="flex items-center justify-center gap-0">
        {(
          [
            { n: 1 as Step, label: 'تخصص‌ها' },
            { n: 2 as Step, label: 'خدمات' },
            { n: 3 as Step, label: 'قیمت' },
          ] as const
        ).map((s, idx) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div key={s.n} className="flex items-center">
              {idx > 0 && (
                <div className={`h-0.5 w-8 sm:w-12 ${done || active ? 'bg-coral' : 'bg-gray-200'}`} />
              )}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    active || done
                      ? 'bg-coral text-white'
                      : 'border border-gray-200 bg-white text-gray-400'
                  }`}
                >
                  {done ? '✓' : s.n}
                </span>
                <span className={`text-[11px] ${active ? 'font-semibold text-coral' : 'text-gray'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {msg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">{msg}</p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</p>
      )}

      {/* STEP 1 — specialties */}
      {step === 1 && (
        <Card className="space-y-4 rounded-2xl border border-border p-4 shadow-sm">
          <h2 className="text-center text-base font-semibold text-[#0B2C4A]">تخصص‌هایی که بلدی</h2>
          {!roots.length ? (
            <PanelEmpty
              title="کاتالوگی نیست"
              description="سوپرادمین باید از «کاتالوگ قالب» قالب استاندارد را بارگذاری کند."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {roots.map((r) => {
                const on = selectedRootIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleRoot(r.id)}
                    className={`rounded-2xl border-2 px-3 py-4 text-sm font-medium transition ${
                      on
                        ? 'border-coral bg-[#FFE6E2] text-coral'
                        : 'border-gray-200 bg-white text-[#0B2C4A]'
                    }`}
                  >
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                      {on ? '✓' : ''}
                    </span>
                    {r.name}
                  </button>
                );
              })}
            </div>
          )}
          <Button
            className="w-full rounded-xl"
            disabled={!selectedRootIds.length || busy}
            onClick={() => {
              setRootId(selectedRootIds[0] || null);
              setFamilyId(null);
              setStep(2);
              setMsg(null);
            }}
          >
            ادامه به انتخاب خدمات
          </Button>
          <p className="text-center text-[11px] text-gray">دسته‌های محبوب فقط توسط ادمین تنظیم می‌شود</p>
        </Card>
      )}

      {/* STEP 2 — families + services as toggles */}
      {step === 2 && (
        <Card className="space-y-4 rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-sm text-gray underline"
              onClick={() => setStep(1)}
            >
              → تخصص‌ها
            </button>
            <div className="flex flex-wrap gap-1">
              {selectedRootIds.map((id) => {
                const r = roots.find((x) => x.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setRootId(id);
                      setFamilyId(null);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      rootId === id ? 'bg-coral text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {r?.name || '—'}
                  </button>
                );
              })}
            </div>
          </div>

          <h2 className="font-semibold text-[#0B2C4A]">خانواده خدمت</h2>
          {!families.length ? (
            <p className="text-sm text-gray">برای این تخصص خانواده‌ای در کاتالوگ نیست.</p>
          ) : (
            <ul className="space-y-2">
              {families.map((f) => {
                const open = familyId === f.id;
                const count =
                  (f as CatalogCategory & { services?: unknown[] }).services?.length ?? 0;
                return (
                  <li key={f.id} className="rounded-xl border border-border overflow-hidden">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-3 text-right text-sm font-medium ${
                        open ? 'bg-[#FFE6E2] text-coral' : 'bg-white'
                      }`}
                      onClick={() => setFamilyId(open ? null : f.id)}
                    >
                      <span>{f.name}</span>
                      <span className="text-xs text-gray">{count.toLocaleString('fa-IR')} مورد</span>
                    </button>
                    {open && (
                      <div className="space-y-2 border-t border-border bg-gray-50/80 p-3">
                        <Input
                          placeholder="جستجوی خدمت…"
                          value={familySearch}
                          onChange={(e) => setFamilySearch(e.target.value)}
                          className="bg-white"
                        />
                        {familyServices.map((s) => {
                          const active = mine.some(
                            (m) =>
                              (m.serviceId === s.id || m.service?.id === s.id) &&
                              m.isActive !== false,
                          );
                          return (
                            <div
                              key={s.id}
                              className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 border border-border"
                            >
                              <span className="text-sm font-medium text-[#0B2C4A]">{s.name}</span>
                              <div className="flex items-center gap-2">
                                {active && (
                                  <span className="text-[10px] text-emerald-600">فعال</span>
                                )}
                                <Button
                                  size="sm"
                                  variant={active ? 'outline' : 'primary'}
                                  disabled={busy}
                                  onClick={() => void enableAndPrice(s.id, s.name)}
                                >
                                  قیمت‌گذاری
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {!familyServices.length && (
                          <p className="text-xs text-gray">خدمتی نیست — ادمین کاتالوگ را کامل کند.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* STEP 3 — price matrix + batch */}
      {step === 3 && psId && (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm text-gray underline"
            onClick={() => setStep(2)}
          >
            → بازگشت به خدمات
          </button>
          <PriceMatrix
            title={activeServiceName || 'جدول قیمت'}
            busy={busy}
            cells={rules.map((r) => ({
              label: r.label,
              price: r.price,
              ruleId: r.id,
            }))}
            onSaveCell={saveCell}
            onBatchApply={batchApply}
          />
        </div>
      )}
    </div>
  );
}
