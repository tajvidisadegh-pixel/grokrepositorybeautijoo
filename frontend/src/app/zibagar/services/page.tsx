'use client';

/**
 * #66 — منوی خدمات تک‌صفحه‌ای برای کاربر مبتدی
 * یک لیست + شیت پایین (بدون ویزارد چندصفحه‌ای)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading } from '@/components/panel/state-blocks';
import { Dialog } from '@/components/ui/dialog';
import {
  fetchCategories,
  fetchMyServices,
  upsertMyService,
  upsertMyPriceRule,
  fetchMyPriceRules,
  patchMyService,
  deactivateMyService,
  createServiceNode,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type PriceRuleItem,
} from '@/lib/panel-api';
import {
  PricingModeFields,
  allowedModesFromService,
  initPricingState,
  pricingPayload,
  type PricingModeState,
} from '@/components/zibagar/PricingModeFields';

import { friendlyApiError } from '@/lib/api-errors';
import {
  CATALOG_TEMPLATE,
  type CatalogFamily,
  type CatalogSpecialty,
  type CatalogVariant,
} from '@/lib/catalog-template';
import { formatPrice } from '@/lib/utils';

const MIN_PRICE = 10_000;

type CatNode = CatalogCategory & {
  children?: CatNode[];
  services?: { id: string; name: string; categoryId?: string }[];
  parentId?: string | null;
};

type FlatSvc = { id: string; name: string; categoryId?: string };

type Sheet =
  | null
  | { kind: 'add' }
  | { kind: 'price'; ps: ProfessionalServiceItem }
  | { kind: 'actions'; ps: ProfessionalServiceItem }
  | { kind: 'delete'; ps: ProfessionalServiceItem };

type AddStep = 'specialty' | 'service' | 'price';

function norm(s: string) {
  return (s || '').trim().replace(/\s+/g, ' ');
}

function flattenCats(nodes: CatNode[], out: CatNode[] = []): CatNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) flattenCats(n.children, out);
  }
  return out;
}

function displayPrice(ps: ProfessionalServiceItem): number | null {
  const mode = String(ps.pricingMode || 'fixed').toLowerCase();
  if (mode === 'deposit') {
    if (ps.depositAmount != null && ps.depositAmount >= 0) return ps.depositAmount;
    return null;
  }
  if (mode === 'variable') {
    if (ps.estimateMinPrice != null && ps.estimateMinPrice >= MIN_PRICE) return ps.estimateMinPrice;
  }
  const fromRules = (ps.priceRules || [])
    .filter((r) => r.price >= MIN_PRICE)
    .map((r) => r.price);
  if (fromRules.length) return Math.min(...fromRules);
  if ((ps.price ?? 0) >= MIN_PRICE) return ps.price;
  return null;
}

function modeLabel(modeRaw?: string | null): string {
  const m = String(modeRaw || 'fixed').toLowerCase();
  if (m === 'variable') return 'گزینه‌ها';
  if (m === 'deposit') return 'بیعانه';
  return 'ثابت';
}

function findServiceByName(list: FlatSvc[], name: string): FlatSvc | null {
  const n = norm(name);
  return list.find((s) => norm(s.name) === n) || null;
}

function anyCategoryId(tree: CatNode[]): string | null {
  const all = flattenCats(tree);
  const root = all.find((c) => !c.parentId);
  return root?.id || all[0]?.id || null;
}

export default function ZibagarServicesPage() {
  const [tree, setTree] = useState<CatNode[]>([]);
  const [flatServices, setFlatServices] = useState<FlatSvc[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [sheet, setSheet] = useState<Sheet>(null);

  const [addStep, setAddStep] = useState<AddStep>('specialty');
  const [pickedSp, setPickedSp] = useState<CatalogSpecialty | null>(null);
  const [pickedFam, setPickedFam] = useState<CatalogFamily | null>(null);
  const [pickedVar, setPickedVar] = useState<CatalogVariant | null>(null);
  const [addPrice, setAddPrice] = useState('');
  const [addDuration, setAddDuration] = useState('60');

  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('60');
  const [editDescription, setEditDescription] = useState('');
  const [editPricing, setEditPricing] = useState<PricingModeState>(initPricingState(null));

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cats, services] = await Promise.all([fetchCategories(), fetchMyServices()]);
      setTree((cats || []) as CatNode[]);
      const flat: FlatSvc[] = [];
      function walk(nodes: CatNode[]) {
        for (const n of nodes) {
          for (const s of n.services || []) {
            flat.push({ id: s.id, name: s.name, categoryId: s.categoryId || n.id });
          }
          if (n.children?.length) walk(n.children as CatNode[]);
        }
      }
      walk((cats || []) as CatNode[]);
      setFlatServices(flat);
      setMine(services || []);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMine = useMemo(() => mine.filter((m) => m.isActive !== false), [mine]);
  const withoutPrice = useMemo(
    () => activeMine.filter((m) => displayPrice(m) == null).length,
    [activeMine],
  );

  const mineByName = useMemo(() => {
    const map = new Map<string, ProfessionalServiceItem>();
    for (const m of activeMine) {
      const n = norm(m.service?.name || '');
      if (n) map.set(n, m);
    }
    return map;
  }, [activeMine]);

  function openAdd() {
    setAddStep('specialty');
    setPickedSp(null);
    setPickedFam(null);
    setPickedVar(null);
    setAddPrice('');
    setAddDuration('60');
    setError(null);
    setSheet({ kind: 'add' });
  }

  function openPrice(ps: ProfessionalServiceItem) {
    const p = displayPrice(ps);
    setEditPrice(p != null ? String(p) : '');
    setEditDuration(String(ps.durationMin || 60));
    setEditDescription(ps.description || '');
    setEditPricing(initPricingState(ps));
    setError(null);
    setSheet({ kind: 'price', ps });
  }

  function openActions(ps: ProfessionalServiceItem) {
    setSheet({ kind: 'actions', ps });
  }

  function closeSheet() {
    if (busy) return;
    setSheet(null);
    setError(null);
  }

  async function saveNewService() {
    if (!pickedVar || !pickedFam || !pickedSp) return;
    const priceNum = Number(String(addPrice).replace(/[^\d]/g, ''));
    if (!Number.isFinite(priceNum) || priceNum < MIN_PRICE) {
      setError(`حداقل قیمت ${MIN_PRICE.toLocaleString('fa-IR')} تومان است`);
      return;
    }
    const dur = Math.max(5, Number(addDuration) || 60);
    setBusy(true);
    setError(null);
    try {
      let svc = findServiceByName(flatServices, pickedVar.name);
      if (!svc) {
        const catId = anyCategoryId(tree);
        if (!catId) throw new Error('دسته‌بندی خدمات در دسترس نیست');
        const created = (await createServiceNode({
          name: pickedVar.name,
          categoryId: catId,
        })) as { id: string; name?: string };
        svc = { id: created.id, name: created.name || pickedVar.name, categoryId: catId };
        setFlatServices((prev) => [...prev, svc!]);
      }
      const existing = mineByName.get(norm(pickedVar.name));
      if (existing) {
        await patchMyService(existing.id, {
          price: priceNum,
          durationMin: dur,
          isActive: true,
        });
      } else {
        await upsertMyService({
          serviceId: svc.id,
          price: priceNum,
          durationMin: dur,
          isActive: true,
        });
      }
      setMsg(`«${pickedVar.name}» به منو اضافه شد`);
      setTimeout(() => setMsg(null), 2500);
      setSheet(null);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function savePriceEdit() {
    if (!sheet || sheet.kind !== 'price') return;
    const priceNum = Number(String(editPrice).replace(/[^\d]/g, ''));
    if (!Number.isFinite(priceNum) || priceNum < MIN_PRICE) {
      setError(`حداقل قیمت ${MIN_PRICE.toLocaleString('fa-IR')} تومان است`);
      return;
    }
    const dur = Math.max(5, Number(editDuration) || 60);
    setBusy(true);
    setError(null);
    try {
      const pricing = pricingPayload(editPricing);
      if (pricing.pricingMode === 'deposit' && !(pricing.depositAmount != null && pricing.depositAmount >= 0)) {
        setError('مبلغ بیعانه را وارد کنید');
        setBusy(false);
        return;
      }
      await patchMyService(sheet.ps.id, {
        price: priceNum,
        durationMin: dur,
        description: editDescription.trim() || undefined,
        isActive: true,
        ...pricing,
      });
      try {
        const rules = await fetchMyPriceRules(sheet.ps.id);
        const first = (rules || [])[0] as PriceRuleItem | undefined;
        if (first) {
          await upsertMyPriceRule(sheet.ps.id, {
            id: first.id,
            label: first.label || 'پیش‌فرض',
            price: priceNum,
          });
        }
      } catch {
        /* optional */
      }
      setMsg('قیمت به‌روز شد');
      setTimeout(() => setMsg(null), 2000);
      setSheet(null);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!sheet || sheet.kind !== 'delete') return;
    setBusy(true);
    setError(null);
    try {
      await deactivateMyService(sheet.ps.id);
      setMsg('از منو حذف شد');
      setTimeout(() => setMsg(null), 2000);
      setSheet(null);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;

  const specialties = CATALOG_TEMPLATE;

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-28" dir="rtl">
      <div className="px-1 pt-1">
        <h1 className="text-xl font-bold text-navy">منوی من</h1>
        <p className="mt-0.5 text-sm text-gray">
          {activeMine.length === 0
            ? 'هنوز خدمتی ندارید'
            : `${activeMine.length.toLocaleString('fa-IR')} خدمت${
                withoutPrice > 0
                  ? ` · ${withoutPrice.toLocaleString('fa-IR')} بدون قیمت`
                  : ''
              }`}
        </p>
      </div>

      {msg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm text-emerald-800">
          {msg}
        </p>
      )}
      {error && !sheet && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={openAdd}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-coral text-base font-semibold text-white shadow-sm transition active:scale-[0.98]"
      >
        ＋ افزودن خدمت
      </button>

      {activeMine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="text-base font-medium text-navy">منوی شما خالی است</p>
          <p className="mt-2 text-sm leading-6 text-gray">
            با دکمه بالا اولین خدمت را اضافه کنید تا کاربر بتواند رزرو کند.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {activeMine.map((ps) => {
            const from = displayPrice(ps);
            const name = ps.service?.name || 'خدمت';
            const cat = ps.service?.category?.name;
            return (
              <li key={ps.id}>
                <button
                  type="button"
                  onClick={() => openActions(ps)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 text-right shadow-sm transition active:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-navy">{name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          String(ps.pricingMode || 'fixed').toLowerCase() === 'deposit'
                            ? 'bg-amber-50 text-amber-800'
                            : String(ps.pricingMode || 'fixed').toLowerCase() === 'variable'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {String(ps.pricingMode || 'fixed').toLowerCase() !== 'fixed' ? modeLabel(ps.pricingMode) : null}
                      </span>
                    </div>
                    {cat && <p className="mt-0.5 text-xs text-gray">{cat}</p>}
                    <p className="mt-1.5 text-sm">
                      {from != null ? (
                        <span className="font-bold text-coral">
                          {String(ps.pricingMode || 'fixed').toLowerCase() === 'variable'
                            ? `از ${formatPrice(from)}`
                            : String(ps.pricingMode || 'fixed').toLowerCase() === 'deposit'
                              ? `بیعانه ${formatPrice(from)}`
                              : formatPrice(from)}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600">قیمت بگذار</span>
                      )}
                      <span className="mr-2 text-xs text-gray">
                        · {ps.durationMin || 60} دقیقه
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 text-gray" aria-hidden>
                    ‹
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={sheet?.kind === 'add'}
        onClose={closeSheet}
        title={
          addStep === 'specialty'
            ? 'انتخاب تخصص'
            : addStep === 'service'
              ? pickedSp?.name || 'انتخاب خدمت'
              : 'قیمت'
        }
      >
        <div className="space-y-4 pb-2">
          {error && sheet?.kind === 'add' && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {addStep === 'specialty' && (
            <div className="grid grid-cols-2 gap-2.5">
              {specialties.map((sp) => (
                <button
                  key={sp.slug}
                  type="button"
                  onClick={() => {
                    setPickedSp(sp);
                    setPickedFam(sp.families[0] || null);
                    setPickedVar(null);
                    setAddStep('service');
                  }}
                  className="flex min-h-14 items-center justify-center rounded-2xl border border-border bg-white px-3 py-3 text-sm font-semibold text-navy shadow-sm transition active:border-coral active:bg-coral/5"
                >
                  {sp.name}
                </button>
              ))}
            </div>
          )}

          {addStep === 'service' && pickedSp && (
            <div className="space-y-4">
              <button
                type="button"
                className="text-sm text-gray underline"
                onClick={() => {
                  setAddStep('specialty');
                  setPickedVar(null);
                }}
              >
                → تغییر تخصص
              </button>

              {pickedSp.families.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {pickedSp.families.map((fam) => (
                    <button
                      key={fam.name}
                      type="button"
                      onClick={() => {
                        setPickedFam(fam);
                        setPickedVar(null);
                      }}
                      className={`min-h-11 rounded-full border px-3.5 py-2 text-sm ${
                        pickedFam?.name === fam.name
                          ? 'border-coral bg-coral text-white'
                          : 'border-border bg-white text-navy'
                      }`}
                    >
                      {fam.name}
                    </button>
                  ))}
                </div>
              )}

              <ul className="max-h-[45vh] space-y-2 overflow-y-auto">
                {(pickedFam?.variants || []).map((v) => {
                  const already = mineByName.has(norm(v.name));
                  return (
                    <li key={v.name}>
                      <button
                        type="button"
                        onClick={() => {
                          setPickedVar(v);
                          setAddStep('price');
                          if (already) {
                            const ps = mineByName.get(norm(v.name))!;
                            const p = displayPrice(ps);
                            if (p != null) setAddPrice(String(p));
                          }
                        }}
                        className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-right transition active:border-coral"
                      >
                        <span className="font-medium text-navy">{v.name}</span>
                        {already && (
                          <span className="text-[11px] text-emerald-600">در منو</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {addStep === 'price' && pickedVar && (
            <div className="space-y-4">
              <button
                type="button"
                className="text-sm text-gray underline"
                onClick={() => setAddStep('service')}
              >
                → تغییر خدمت
              </button>
              <p className="text-base font-semibold text-navy">{pickedVar.name}</p>

              <div>
                <label className="mb-1.5 block text-sm text-gray">قیمت (تومان)</label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="مثلاً ۳۵۰۰۰۰"
                  className="h-14 rounded-2xl text-base tabular-nums"
                  autoFocus
                />
                {addPrice && Number(addPrice) > 0 && Number(addPrice) < MIN_PRICE && (
                  <p className="mt-1.5 text-sm text-red-600">
                    حداقل {MIN_PRICE.toLocaleString('fa-IR')} تومان
                  </p>
                )}
                {addPrice && Number(addPrice) >= MIN_PRICE && (
                  <p className="mt-1.5 text-sm text-gray">{formatPrice(Number(addPrice))}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-gray">مدت (دقیقه)</label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={addDuration}
                  onChange={(e) => setAddDuration(e.target.value.replace(/[^\d]/g, ''))}
                  className="h-12 rounded-2xl text-base tabular-nums"
                />
              </div>

              <Button
                className="h-14 w-full rounded-2xl text-base font-semibold"
                disabled={busy || !addPrice || Number(addPrice) < MIN_PRICE}
                onClick={() => void saveNewService()}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره در منو'}
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={sheet?.kind === 'actions'}
        onClose={closeSheet}
        title={sheet?.kind === 'actions' ? sheet.ps.service?.name || 'خدمت' : 'عملیات'}
      >
        {sheet?.kind === 'actions' && (
          <div className="space-y-2 pb-2">
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-border bg-white text-base font-medium text-navy active:bg-gray-50"
              onClick={() => openPrice(sheet.ps)}
            >
              تغییر قیمت و مدت
            </button>
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-base font-medium text-red-600 active:bg-red-100"
              onClick={() => setSheet({ kind: 'delete', ps: sheet.ps })}
            >
              حذف از منو
            </button>
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center text-sm text-gray"
              onClick={closeSheet}
            >
              انصراف
            </button>
          </div>
        )}
      </Dialog>

      <Dialog
        open={sheet?.kind === 'price'}
        onClose={closeSheet}
        title="قیمت و مدت"
      >
        {sheet?.kind === 'price' && (
          <div className="space-y-4 pb-2">
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <p className="text-sm text-gray">{sheet.ps.service?.name}</p>
            <div>
              <label className="mb-1.5 block text-sm text-gray">قیمت (تومان)</label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value.replace(/[^\d]/g, ''))}
                className="h-14 rounded-2xl text-base tabular-nums"
                autoFocus
              />
              {editPrice && Number(editPrice) > 0 && Number(editPrice) < MIN_PRICE && (
                <p className="mt-1.5 text-sm text-red-600">
                  حداقل {MIN_PRICE.toLocaleString('fa-IR')} تومان
                </p>
              )}
              {editPrice && Number(editPrice) >= MIN_PRICE && (
                <p className="mt-1.5 text-sm text-gray">{formatPrice(Number(editPrice))}</p>
              )}
            </div>
            {sheet.ps && (
              <PricingModeFields
                allowed={allowedModesFromService(sheet.ps.service)}
                state={editPricing}
                onChange={setEditPricing}
                groups={sheet.ps.service?.attributeGroups}
                disabled={busy}
              />
            )}
            <div>
              <label className="mb-1.5 block text-sm text-gray">مدت (دقیقه)</label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value.replace(/[^\d]/g, ''))}
                className="h-12 rounded-2xl text-base tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray">توضیح خدمت (اختیاری)</label>
              <textarea
                dir="rtl"
                rows={3}
                maxLength={500}
                className="w-full rounded-2xl border border-border bg-white px-3 py-2.5 text-sm text-blue shadow-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
                placeholder="مثلاً: شامل شستشو و استایلینگ"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <Button
              className="h-14 w-full rounded-2xl text-base font-semibold"
              disabled={busy || !editPrice || Number(editPrice) < MIN_PRICE}
              onClick={() => void savePriceEdit()}
            >
              {busy ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </div>
        )}
      </Dialog>

      <Dialog
        open={sheet?.kind === 'delete'}
        onClose={closeSheet}
        title="حذف از منو"
      >
        {sheet?.kind === 'delete' && (
          <div className="space-y-4 pb-2">
            <p className="text-sm leading-6 text-gray">
              «{sheet.ps.service?.name || 'این خدمت'}» از منوی شما حذف می‌شود. کاربر دیگر نمی‌تواند آن را رزرو کند.
            </p>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-2xl"
                disabled={busy}
                onClick={closeSheet}
              >
                انصراف
              </Button>
              <Button
                className="h-12 flex-1 rounded-2xl bg-red-600 hover:bg-red-700"
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                {busy ? '…' : 'حذف'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
