'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

type Step = 'specialty' | 'family' | 'matrix';

export default function ZibagarMenuPage() {
  const [step, setStep] = useState<Step>('specialty');
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [psId, setPsId] = useState<string | null>(null);
  const [rules, setRules] = useState<PriceRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
      if (Array.isArray(sel)) setSelectedRootIds(sel);
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

  const familyServices = useMemo(() => {
    if (!familyId) return [];
    const fam = tree.find((c) => c.id === familyId);
    const svcs = (fam as CatalogCategory & { services?: { id: string; name: string }[] })?.services || [];
    return svcs;
  }, [tree, familyId]);

  const templateFamily = useMemo(() => {
    const root = roots.find((r) => r.id === rootId);
    if (!root) return null;
    const sp = CATALOG_TEMPLATE.find((s) => s.name === root.name || s.slug === root.slug);
    const fam = families.find((f) => f.id === familyId);
    if (!sp || !fam) return null;
    return sp.families.find((f) => f.name === fam.name) || null;
  }, [roots, rootId, families, familyId]);

  async function toggleRoot(id: string) {
    const next = selectedRootIds.includes(id)
      ? selectedRootIds.filter((x) => x !== id)
      : [...selectedRootIds, id];
    setSelectedRootIds(next);
    setBusy(true);
    try {
      await setMySelectedCategories(next);
      setMsg('تخصص‌ها ذخیره شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function openFamily(fid: string) {
    setFamilyId(fid);
    setStep('family');
  }

  async function enableAndPrice(serviceId: string, serviceName: string) {
    setBusy(true);
    setError(null);
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
      const pr = await fetchMyPriceRules(ps.id);
      setRules(pr);

      // ensure matrix labels exist as rules if template known
      const variant = templateFamily?.variants.find((v) => v.name === serviceName);
      if (templateFamily && variant) {
        const labels = matrixLabels(templateFamily, variant);
        const have = new Set(pr.map((r) => r.label));
        for (const label of labels) {
          if (!have.has(label)) {
            await upsertMyPriceRule(ps.id, { label, price: 0 });
          }
        }
        setRules(await fetchMyPriceRules(ps.id));
      }
      setStep('matrix');
      setMsg(serviceName);
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
      // also bump base price to min positive
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
      setMsg('قیمت ذخیره شد');
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
      setMsg(`قیمت ${formatPrice(price)} روی ${labels.length} مورد اعمال شد`);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !tree.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-[#0B2C4A]">منوی خدمات من</h1>
        <p className="mt-1 text-sm text-gray">تخصص → خانواده → جدول قیمت. بدون درخت پیچیده.</p>
      </div>

      <div className="flex gap-2 text-xs">
        {(['specialty', 'family', 'matrix'] as Step[]).map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-3 py-1 ${
              step === s ? 'bg-coral text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {i + 1}. {s === 'specialty' ? 'تخصص' : s === 'family' ? 'خانواده' : 'قیمت'}
          </span>
        ))}
      </div>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {step === 'specialty' && (
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">تخصص‌هایی که بلدی</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {roots.map((r) => {
              const on = selectedRootIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleRoot(r.id)}
                  className={`rounded-2xl border px-4 py-3 text-right text-sm font-medium ${
                    on ? 'border-coral bg-coral-soft text-coral' : 'border-border bg-white'
                  }`}
                >
                  {on ? '✓ ' : ''}{r.name}
                </button>
              );
            })}
          </div>
          {!roots.length && <PanelEmpty title="کاتالوگی نیست" description="ادمین باید قالب را بارگذاری کند." />}
          <Button
            disabled={!selectedRootIds.length}
            onClick={() => {
              setRootId(selectedRootIds[0] || null);
              setStep('family');
            }}
          >
            ادامه به خانواده خدمت
          </Button>
        </Card>
      )}

      {step === 'family' && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setStep('specialty')}>بازگشت</Button>
            {selectedRootIds.map((id) => {
              const r = roots.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    rootId === id ? 'border-coral bg-coral text-white' : ''
                  }`}
                  onClick={() => setRootId(id)}
                >
                  {r?.name || id.slice(0, 6)}
                </button>
              );
            })}
          </div>
          <h2 className="font-semibold">خانواده خدمت را روشن کنید</h2>
          <ul className="space-y-2">
            {(rootId ? families : []).map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border px-3 py-2 text-right text-sm hover:border-coral"
                  onClick={() => void openFamily(f.id)}
                >
                  {f.name}
                </button>
                {familyId === f.id && (
                  <ul className="mt-2 mr-3 space-y-1 border-r border-coral/30 pr-3">
                    {familyServices.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={busy}
                          className="text-sm text-coral underline"
                          onClick={() => void enableAndPrice(s.id, s.name)}
                        >
                          قیمت‌گذاری: {s.name}
                        </button>
                      </li>
                    ))}
                    {!familyServices.length && (
                      <li className="text-xs text-gray">خدمتی در این خانواده نیست — ادمین کاتالوگ را کامل کند.</li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 'matrix' && psId && (
        <div className="space-y-3">
          <Button size="sm" variant="outline" onClick={() => setStep('family')}>بازگشت</Button>
          <PriceMatrix
            title={msg || 'جدول قیمت'}
            busy={busy}
            cells={rules.map((r) => ({ label: r.label, price: r.price, ruleId: r.id }))}
            onSaveCell={saveCell}
            onBatchApply={batchApply}
          />
        </div>
      )}
    </div>
  );
}
