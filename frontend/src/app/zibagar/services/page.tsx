'use client';

/**
 * منوی خدمات زیباگر — کاربردی و کامل
 * ساختار همیشه از CATALOG_TEMPLATE (حتی اگر API ناقص باشد).
 * اتصال به کاتالوگ واقعی: تطبیق نام خدمت، در صورت نبود ایجاد زیر دستهٔ موجود.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import {
  fetchCategories,
  fetchMyServices,
  upsertMyService,
  upsertMyPriceRule,
  fetchMyPriceRules,
  setMySelectedCategories,
  fetchMyProfessional,
  createServiceNode,
  patchMyService,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type PriceRuleItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import {
  CATALOG_TEMPLATE,
  matrixLabels,
  type CatalogFamily,
  type CatalogSpecialty,
  type CatalogVariant,
} from '@/lib/catalog-template';
import { PriceMatrix } from '@/components/catalog/price-matrix';
import { formatPrice } from '@/lib/utils';
import { apiClient } from '@/lib/api';

type Step = 1 | 2 | 3;

type CatNode = CatalogCategory & {
  children?: CatNode[];
  services?: { id: string; name: string; categoryId?: string }[];
  parentId?: string | null;
};

type FlatSvc = { id: string; name: string; categoryId?: string; slug?: string };

function norm(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

function flattenCats(nodes: CatNode[], out: CatNode[] = []): CatNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) flattenCats(n.children, out);
  }
  return out;
}

function findRootForSpecialty(tree: CatNode[], sp: CatalogSpecialty): CatNode | null {
  const all = flattenCats(tree);
  return (
    all.find((c) => !c.parentId && (c.slug === sp.slug || norm(c.name) === norm(sp.name))) ||
    all.find((c) => c.slug === sp.slug || norm(c.name) === norm(sp.name)) ||
    null
  );
}

function findFamilyCat(tree: CatNode[], root: CatNode | null, familyName: string): CatNode | null {
  if (!root) return null;
  const kids = root.children?.length
    ? root.children
    : flattenCats(tree).filter((c) => c.parentId === root.id);
  return kids.find((c) => norm(c.name) === norm(familyName)) || null;
}

function findServiceByName(list: FlatSvc[], name: string): FlatSvc | null {
  const n = norm(name);
  return list.find((s) => norm(s.name) === n) || null;
}

export default function ZibagarServicesPage() {
  const [step, setStep] = useState<Step>(1);
  const [tree, setTree] = useState<CatNode[]>([]);
  const [flatServices, setFlatServices] = useState<FlatSvc[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  /** specialty slugs selected */
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [familySearch, setFamilySearch] = useState('');
  const [activeVariant, setActiveVariant] = useState<CatalogVariant | null>(null);
  const [activeFamily, setActiveFamily] = useState<CatalogFamily | null>(null);
  const [psId, setPsId] = useState<string | null>(null);
  const [rules, setRules] = useState<PriceRuleItem[]>([]);
  const [durationMin, setDurationMin] = useState(60);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, services, pro, allSvcs] = await Promise.all([
        fetchCategories().catch(() => [] as CatalogCategory[]),
        fetchMyServices().catch(() => [] as ProfessionalServiceItem[]),
        fetchMyProfessional().catch(() => null),
        apiClient
          .get<FlatSvc[] | { items?: FlatSvc[] }>('/services')
          .catch(() => [] as FlatSvc[]),
      ]);
      setTree((Array.isArray(cats) ? cats : []) as CatNode[]);
      setMine(Array.isArray(services) ? services : []);
      const flat = Array.isArray(allSvcs)
        ? allSvcs
        : (allSvcs as { items?: FlatSvc[] })?.items || [];
      setFlatServices(flat);

      // restore selected specialties from pro.selectedCategoryIds matched to template
      const selIds = (pro as { selectedCategoryIds?: string[] } | null)?.selectedCategoryIds;
      if (Array.isArray(selIds) && selIds.length) {
        const all = flattenCats(cats as CatNode[]);
        const slugs: string[] = [];
        for (const id of selIds) {
          const cat = all.find((c) => c.id === id);
          if (!cat) continue;
          const sp = CATALOG_TEMPLATE.find(
            (s) => s.slug === cat.slug || norm(s.name) === norm(cat.name),
          );
          if (sp && !slugs.includes(sp.slug)) slugs.push(sp.slug);
        }
        if (slugs.length) setSelectedSlugs(slugs);
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSpecialty = useMemo(
    () => CATALOG_TEMPLATE.find((s) => s.slug === activeSlug) || null,
    [activeSlug],
  );

  const mineByServiceId = useMemo(() => {
    const m = new Map<string, ProfessionalServiceItem>();
    for (const ps of mine) {
      const sid = ps.serviceId || ps.service?.id;
      if (sid) m.set(sid, ps);
      if (ps.service?.name) m.set(`name:${norm(ps.service.name)}`, ps);
    }
    return m;
  }, [mine]);

  async function persistSelected(slugs: string[]) {
    const ids: string[] = [];
    for (const slug of slugs) {
      const sp = CATALOG_TEMPLATE.find((s) => s.slug === slug);
      if (!sp) continue;
      const root = findRootForSpecialty(tree, sp);
      if (root?.id) ids.push(root.id);
    }
    if (ids.length) {
      try {
        await setMySelectedCategories(ids);
      } catch {
        /* non-blocking */
      }
    }
  }

  async function toggleSpecialty(slug: string) {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((x) => x !== slug)
      : [...selectedSlugs, slug];
    setSelectedSlugs(next);
    setBusy(true);
    try {
      await persistSelected(next);
      setMsg('تخصص‌ها ذخیره شد');
    } finally {
      setBusy(false);
    }
  }

  /** Resolve or create catalog Service for a template variant, then open pricing */
  async function enableAndPrice(family: CatalogFamily, variant: CatalogVariant) {
    if (!activeSpecialty) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    setActiveFamily(family);
    setActiveVariant(variant);
    try {
      let svc = findServiceByName(flatServices, variant.name);

      // also search nested category services
      if (!svc) {
        for (const c of flattenCats(tree)) {
          const hit = c.services?.find((s) => norm(s.name) === norm(variant.name));
          if (hit) {
            svc = { id: hit.id, name: hit.name, categoryId: c.id };
            break;
          }
        }
      }

      if (!svc) {
        const root = findRootForSpecialty(tree, activeSpecialty);
        const famCat = findFamilyCat(tree, root, family.name);
        const categoryId = famCat?.id || root?.id;
        if (!categoryId) {
          throw new Error(
            'این تخصص هنوز در کاتالوگ سرور نیست. از پنل ادمین «بارگذاری قالب استاندارد» را بزنید، بعد اینجا «بارگذاری دوباره» را بزنید.',
          );
        }
        const created = await createServiceNode({
          name: variant.name,
          categoryId,
        });
        svc = { id: created.id, name: created.name, categoryId: created.categoryId };
        setFlatServices((prev) => [...prev, svc!]);
      }

      let ps =
        mineByServiceId.get(svc.id) ||
        mineByServiceId.get(`name:${norm(variant.name)}`) ||
        mine.find((m) => m.serviceId === svc!.id || m.service?.id === svc!.id);

      if (!ps) {
        await upsertMyService({
          serviceId: svc.id,
          durationMin: 60,
          price: 0,
          isActive: true,
        });
        const refreshed = await fetchMyServices();
        setMine(refreshed);
        ps = refreshed.find((m) => m.serviceId === svc!.id || m.service?.id === svc!.id);
      } else if (ps.isActive === false) {
        await patchMyService(ps.id, { isActive: true });
        const refreshed = await fetchMyServices();
        setMine(refreshed);
        ps = refreshed.find((m) => m.id === ps!.id) || ps;
      }

      if (!ps) throw new Error('خدمت برای شما فعال نشد. دوباره تلاش کنید.');

      setPsId(ps.id);
      setDurationMin(ps.durationMin || 60);

      let pr = await fetchMyPriceRules(ps.id);
      const labels = matrixLabels(family, variant);
      const have = new Set(pr.map((r) => r.label));
      for (const label of labels) {
        if (!have.has(label)) {
          await upsertMyPriceRule(ps.id, { label, price: 0 });
        }
      }
      // remove nothing — keep extra custom rules
      pr = await fetchMyPriceRules(ps.id);
      // order rules by labels order
      const ordered: PriceRuleItem[] = [];
      for (const l of labels) {
        const hit = pr.find((r) => r.label === l);
        if (hit) ordered.push(hit);
      }
      for (const r of pr) {
        if (!labels.includes(r.label)) ordered.push(r);
      }
      setRules(ordered.length ? ordered : pr);
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
    setError(null);
    try {
      await upsertMyPriceRule(psId, { id: ruleId, label, price });
      const next = await fetchMyPriceRules(psId);
      setRules(next);
      const positive = next.filter((r) => r.price > 0).map((r) => r.price);
      if (positive.length) {
        const min = Math.min(...positive);
        await patchMyService(psId, { price: min, durationMin });
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
    setError(null);
    try {
      for (const label of labels) {
        const existing = rules.find((r) => r.label === label);
        await upsertMyPriceRule(psId, { id: existing?.id, label, price });
      }
      const next = await fetchMyPriceRules(psId);
      setRules(next);
      await patchMyService(psId, { price, durationMin });
      setMsg(`قیمت ${formatPrice(price)} روی ${labels.length.toLocaleString('fa-IR')} مورد اعمال شد`);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDuration() {
    if (!psId) return;
    setBusy(true);
    try {
      await patchMyService(psId, { durationMin: Math.max(5, durationMin) });
      setMsg('مدت زمان ذخیره شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading label="بارگذاری منوی خدمات…" />;
  if (error && !tree.length && !CATALOG_TEMPLATE.length) {
    return <PanelError message={error} onRetry={load} />;
  }

  const filteredFamilies = useMemo(() => {
    if (!activeSpecialty) return [];
    const q = familySearch.trim();
    return activeSpecialty.families.filter((f) => {
      if (!q) return true;
      if (f.name.includes(q)) return true;
      return f.variants.some((v) => v.name.includes(q));
    });
  }, [activeSpecialty, familySearch]);

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28" dir="rtl">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#0B2C4A]">منوی خدمات من</h1>
        <p className="mt-1 text-sm text-gray">تخصص → خدمت → قیمت؛ فقط موارد فعال به مشتری نشان داده می‌شود</p>
      </div>

      {/* Stepper */}
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

      {/* STEP 1 */}
      {step === 1 && (
        <Card className="space-y-4 rounded-2xl border border-border p-4 shadow-sm">
          <h2 className="text-center text-base font-semibold text-[#0B2C4A]">تخصص‌هایی که بلدی</h2>
          <p className="text-center text-xs text-gray">چند مورد را انتخاب کن؛ بعد خدمات همان‌ها را قیمت می‌گذاری</p>
          <div className="grid grid-cols-2 gap-3">
            {CATALOG_TEMPLATE.map((sp) => {
              const on = selectedSlugs.includes(sp.slug);
              const root = findRootForSpecialty(tree, sp);
              return (
                <button
                  key={sp.slug}
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleSpecialty(sp.slug)}
                  className={`rounded-2xl border-2 px-3 py-4 text-sm font-medium transition ${
                    on
                      ? 'border-coral bg-[#FFE6E2] text-coral'
                      : 'border-gray-200 bg-white text-[#0B2C4A]'
                  }`}
                >
                  <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                    {on ? '✓' : ''}
                  </span>
                  {sp.name}
                  {!root && (
                    <span className="mt-1 block text-[10px] font-normal text-amber-600">
                      در سرور نیست
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={!selectedSlugs.length || busy}
            onClick={() => {
              setActiveSlug(selectedSlugs[0]);
              setOpenFamily(null);
              setStep(2);
              setMsg(null);
              setError(null);
            }}
          >
            ادامه به انتخاب خدمات
          </Button>
          <button type="button" className="w-full text-center text-xs text-gray underline" onClick={() => void load()}>
            بارگذاری دوباره از سرور
          </button>
        </Card>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <Card className="space-y-4 rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-sm text-gray underline"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
            >
              → تخصص‌ها
            </button>
            <div className="flex flex-wrap gap-1">
              {selectedSlugs.map((slug) => {
                const sp = CATALOG_TEMPLATE.find((s) => s.slug === slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => {
                      setActiveSlug(slug);
                      setOpenFamily(null);
                      setFamilySearch('');
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activeSlug === slug ? 'bg-coral text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {sp?.name || slug}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            placeholder="جستجوی خانواده یا خدمت…"
            value={familySearch}
            onChange={(e) => setFamilySearch(e.target.value)}
            className="bg-white"
          />

          {!activeSpecialty ? (
            <p className="text-sm text-gray">یک تخصص را از چیپ‌های بالا انتخاب کنید.</p>
          ) : (
            <ul className="space-y-2">
              {filteredFamilies.map((fam) => {
                const open = openFamily === fam.name;
                const variants = fam.variants;
                const pricedCount = variants.filter((v) => {
                  const svc = findServiceByName(flatServices, v.name);
                  if (svc && mineByServiceId.has(svc.id)) return true;
                  return mineByServiceId.has(`name:${norm(v.name)}`);
                }).length;
                return (
                  <li key={fam.name} className="overflow-hidden rounded-xl border border-border">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between px-3 py-3 text-right text-sm font-medium ${
                        open ? 'bg-[#FFE6E2] text-coral' : 'bg-white text-[#0B2C4A]'
                      }`}
                      onClick={() => setOpenFamily(open ? null : fam.name)}
                    >
                      <span>{fam.name}</span>
                      <span className="text-xs text-gray">
                        {pricedCount.toLocaleString('fa-IR')}/{variants.length.toLocaleString('fa-IR')} قیمت‌گذاری
                      </span>
                    </button>
                    {open && (
                      <div className="space-y-2 border-t border-border bg-gray-50/80 p-3">
                        {variants.map((v) => {
                          const svc = findServiceByName(flatServices, v.name);
                          const ps =
                            (svc && mineByServiceId.get(svc.id)) ||
                            mineByServiceId.get(`name:${norm(v.name)}`);
                          const active = !!ps && ps.isActive !== false;
                          const minP =
                            ps?.priceRules?.filter((r) => r.price > 0).map((r) => r.price) ||
                            (ps?.price && ps.price > 0 ? [ps.price] : []);
                          const from =
                            minP.length > 0 ? Math.min(...minP) : ps?.price && ps.price > 0 ? ps.price : null;
                          return (
                            <div
                              key={v.name}
                              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#0B2C4A]">
                                  {v.name}
                                  {active && (
                                    <span className="mr-2 text-[10px] text-emerald-600">فعال</span>
                                  )}
                                </p>
                                {from != null && (
                                  <p className="text-[11px] text-gray">از {formatPrice(from)}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => void enableAndPrice(fam, v)}
                              >
                                {active ? 'ویرایش قیمت' : 'قیمت‌گذاری'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {mine.length > 0 && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <p className="mb-2 text-xs font-medium text-gray">خدمات فعال شما ({mine.filter((m) => m.isActive !== false).length.toLocaleString('fa-IR')})</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {mine
                  .filter((m) => m.isActive !== false)
                  .map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span>{m.service?.name || '—'}</span>
                      <span className="text-gray">{m.price > 0 ? formatPrice(m.price) : '—'}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* STEP 3 */}
      {step === 3 && psId && activeVariant && (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm text-gray underline"
            onClick={() => {
              setStep(2);
              setError(null);
            }}
          >
            → بازگشت به خدمات
          </button>

          <Card className="flex flex-wrap items-end gap-3 rounded-2xl border border-border p-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray">مدت زمان تقریبی (دقیقه)</label>
              <Input
                type="number"
                min={5}
                step={5}
                dir="ltr"
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value) || 60)}
                className="max-w-[120px]"
              />
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveDuration()}>
              ذخیره مدت
            </Button>
          </Card>

          <PriceMatrix
            title={activeVariant.name}
            busy={busy}
            cells={rules.map((r) => ({
              label: r.label,
              price: r.price,
              ruleId: r.id,
            }))}
            onSaveCell={saveCell}
            onBatchApply={batchApply}
          />

          {activeFamily && activeFamily.dims.length > 0 && (
            <p className="text-center text-[11px] text-gray">
              ابعاد قیمت: {activeFamily.dims.map((d) => d.label).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
