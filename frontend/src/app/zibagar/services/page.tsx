'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import {
  fetchMyServices,
  fetchCategories,
  fetchMyProfessional,
  setMySelectedCategories,
  upsertMyService,
  patchMyService,
  renameMyService,
  deactivateMyService,
  upsertMyAddOn,
  deactivateMyAddOn,
  uploadMyMedia,
  deleteMyMedia,
  resolveMediaUrl,
  upsertMyPriceRule,
  deleteMyPriceRule,
  fetchMyPriceRules,
  upsertMyDurationRule,
  deleteMyDurationRule,
  fetchMyDurationRules,
  createServiceNode,
  createCategoryNode,
  type ProfessionalServiceItem,
  type CatalogCategory,
  type ServiceAddOnItem,
  type PriceRuleItem,
  type DurationRuleItem,
  type MediaAssetItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, parsePriceInput, formatPriceDigits, priceToWords } from '@/lib/utils';
import {
  FEATURED_ROOT_NAMES,
  collectLeaves,
  findCategory,
  flattenSearch,
  navy,
  rootOf,
  serviceLabel,
  statusOf,
  type PathNode,
} from './services-helpers';
import { SpecialtyView } from './SpecialtyView';
import { ServiceEditPanel } from './ServiceEditPanel';

export default function ZibagarServicesPage() {
  const [tree, setTree] = useState<CatalogCategory[]>([]);
  const [mine, setMine] = useState<ProfessionalServiceItem[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<'home' | 'specialty' | 'edit' | 'add'>('home');
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [path, setPath] = useState<PathNode[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPsId, setSelectedPsId] = useState<string | null>(null);

  const [price, setPrice] = useState(0);
  const [durationMin, setDurationMin] = useState(60);
  const [showModels, setShowModels] = useState(false);
  const [priceRules, setPriceRules] = useState<PriceRuleItem[]>([]);
  const [durationRules, setDurationRules] = useState<DurationRuleItem[]>([]);
  const [ruleLabel, setRuleLabel] = useState('');
  const [rulePrice, setRulePrice] = useState(0);
  const [ruleDuration, setRuleDuration] = useState(60);

  const [showAddOnForm, setShowAddOnForm] = useState(false);
  const [addOnName, setAddOnName] = useState('');
  const [addOnPrice, setAddOnPrice] = useState(0);
  const [addOnExtra, setAddOnExtra] = useState(0);
  const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'ok' | 'err'>('idle');
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState('');

  const [showCreateSpecialty, setShowCreateSpecialty] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [newSpecPrice, setNewSpecPrice] = useState(0);
  const [newSpecDuration, setNewSpecDuration] = useState(60);
  const [newSpecDesc, setNewSpecDesc] = useState('');

  const [editingNamePsId, setEditingNamePsId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editingSubKey, setEditingSubKey] = useState<string | null>(null);
  const [editSubLabel, setEditSubLabel] = useState('');
  const [editSubPrice, setEditSubPrice] = useState(0);
  const [editSubDuration, setEditSubDuration] = useState(60);

  const roots = useMemo(() => (tree || []).filter((c) => !c.parentId), [tree]);
  const myRoots = useMemo(() => roots.filter((r) => selectedRootIds.includes(r.id)), [roots, selectedRootIds]);
  const searchIndex = useMemo(() => flattenSearch(tree), [tree]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, services, pro] = await Promise.all([
        fetchCategories(),
        fetchMyServices(),
        fetchMyProfessional().catch(() => null),
      ]);
      setTree(cats || []);
      setMine(services || []);
      const ids = (pro?.selectedCategoryIds as string[] | null) || [];
      setSelectedRootIds(Array.isArray(ids) ? ids.filter(Boolean) : []);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedPs = useMemo(
    () => (selectedPsId ? mine.find((m) => m.id === selectedPsId) || null : null),
    [mine, selectedPsId],
  );

  useEffect(() => {
    if (!selectedPs) return;
    setPrice(selectedPs.price || 0);
    setDurationMin(selectedPs.durationMin || 60);
    setShowModels((selectedPs.priceRules?.length || 0) > 0 || (selectedPs.durationRules?.length || 0) > 0);
    setPriceRules(selectedPs.priceRules || []);
    setDurationRules(selectedPs.durationRules || []);
    (async () => {
      try {
        const [pr, dr] = await Promise.all([
          fetchMyPriceRules(selectedPs.id),
          fetchMyDurationRules(selectedPs.id),
        ]);
        if (pr.length) setPriceRules(pr);
        if (dr.length) setDurationRules(dr);
        if (pr.length || dr.length) setShowModels(true);
      } catch { /* ignore */ }
    })();
  }, [selectedPsId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRoot = useMemo(
    () => (activeRootId ? roots.find((r) => r.id === activeRootId) || null : null),
    [roots, activeRootId],
  );

  const currentCategory = useMemo(() => {
    if (!path.length) return activeRootId ? findCategory(tree, activeRootId) : null;
    return findCategory(tree, path[path.length - 1].id);
  }, [path, tree, activeRootId]);

  const children = useMemo(() => {
    if (!activeRootId) return [];
    if (path.length === 0) return findCategory(tree, activeRootId)?.children || [];
    return currentCategory?.children || [];
  }, [path, currentCategory, activeRootId, tree]);

  const leafServices = useMemo(() => {
    if (path.length === 0 && activeRootId) return findCategory(tree, activeRootId)?.services || [];
    return currentCategory?.services || [];
  }, [path, currentCategory, activeRootId, tree]);

  const specialtyMenu = useMemo(() => {
    if (!activeRootId) return [];
    const root = findCategory(tree, activeRootId);
    const leaves = collectLeaves(root);
    const leafIds = new Set(leaves.map((l) => l.id));
    return mine
      .filter(
        (ps) =>
          leafIds.has(ps.serviceId) ||
          (ps.service?.category?.id && rootOf(tree, ps.service.category.id)?.id === activeRootId),
      )
      .sort((a, b) => serviceLabel(a).localeCompare(serviceLabel(b), 'fa'));
  }, [activeRootId, tree, mine]);

  const menuSections = useMemo(() => {
    const map = new Map<string, ProfessionalServiceItem[]>();
    for (const ps of specialtyMenu) {
      const section = ps.service?.category?.name?.trim() || activeRoot?.name || 'خدمات';
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(ps);
    }
    return Array.from(map.entries());
  }, [specialtyMenu, activeRoot?.name]);

  const specialtyMedia = useMemo(() => {
    const items: MediaAssetItem[] = [];
    for (const ps of specialtyMenu) {
      for (const m of ps.mediaAssets || []) items.push(m);
    }
    return items;
  }, [specialtyMenu]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q))
      .slice(0, 20);
  }, [search, searchIndex]);

  async function persistRoots(ids: string[]) {
    setSelectedRootIds(ids);
    await setMySelectedCategories(ids);
  }

  async function addRootSpecialty(rootId: string) {
    if (selectedRootIds.includes(rootId)) return;
    setBusy(true);
    try {
      await persistRoots([...selectedRootIds, rootId]);
      setActiveRootId(rootId);
      setPath([]);
      setMode('specialty');
      setMsg(null);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRootSpecialty(rootId: string) {
    setBusy(true);
    try {
      await persistRoots(selectedRootIds.filter((id) => id !== rootId));
      if (activeRootId === rootId) goHome();
    } finally {
      setBusy(false);
    }
  }

  function goHome() {
    setMode('home');
    setActiveRootId(null);
    setPath([]);
    setSelectedPsId(null);
    setSearch('');
  }

  async function ensureAndEditService(
    serviceId: string,
    nameHint?: string,
    initial?: { price?: number; durationMin?: number },
  ) {
    setBusy(true);
    setError(null);
    try {
      let ps = mine.find((m) => m.serviceId === serviceId);
      if (!ps) {
        await upsertMyService({
          serviceId,
          durationMin: initial?.durationMin && initial.durationMin > 0 ? initial.durationMin : 60,
          price: initial?.price && initial.price > 0 ? initial.price : 0,
          isActive: true,
        });
        await load();
        const refreshed = await fetchMyServices();
        setMine(refreshed || []);
        ps = (refreshed || []).find((m) => m.serviceId === serviceId);
      }
      if (ps) {
        setSelectedPsId(ps.id);
        setMode('edit');
        setMsg(null);
      } else {
        setError(nameHint ? `نتوانستیم «${nameHint}» را اضافه کنیم` : 'خدمت اضافه نشد');
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createAndEditCustomService(
    name: string,
    initial?: { price?: number; durationMin?: number },
  ) {
    if (!activeRootId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const parentCatId = path.length > 0 ? path[path.length - 1].id : activeRootId;
      const created = await createServiceNode({
        name: name.trim(),
        categoryId: parentCatId,
      });
      setSearch('');
      setMsg(`«${created.name}» اضافه شد`);
      await load();
      await ensureAndEditService(created.id, created.name, initial);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createFeature(name: string) {
    if (!activeRootId || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const parentId = path.length > 0 ? path[path.length - 1].id : activeRootId;
      const created = await createCategoryNode({
        name: name.trim(),
        parentId,
      });
      setMsg(`ویژگی «${created.name}» اضافه شد`);
      await load();
      setPath((p) => [...p, { id: created.id, name: created.name }]);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createSpecialtyDirect() {
    if (!newSpecName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let categoryId = selectedRootIds[0] || roots[0]?.id || null;
      if (!categoryId) {
        const cat = await createCategoryNode({ name: newSpecName.trim() });
        categoryId = cat.id;
        await persistRoots([cat.id]);
      }
      const created = await createServiceNode({
        name: newSpecName.trim(),
        categoryId,
        description: newSpecDesc.trim() || undefined,
      });
      await upsertMyService({
        serviceId: created.id,
        price: newSpecPrice || 0,
        durationMin: newSpecDuration > 0 ? newSpecDuration : 60,
        description: newSpecDesc.trim() || undefined,
        isActive: true,
      });
      setNewSpecName('');
      setNewSpecPrice(0);
      setNewSpecDuration(60);
      setNewSpecDesc('');
      setShowCreateSpecialty(false);
      setMsg(`تخصص «${created.name}» اضافه شد`);
      await load();
      const refreshed = await fetchMyServices();
      setMine(refreshed || []);
      const ps = (refreshed || []).find((m) => m.serviceId === created.id);
      if (ps) {
        setSelectedPsId(ps.id);
        setMode('edit');
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSavePs() {
    if (!selectedPs) return;
    setBusy(true);
    setError(null);
    try {
      await patchMyService(selectedPs.id, { price, durationMin, isActive: true });
      setMsg('ذخیره شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyFixedToAllUnderRoot() {
    if (!activeRootId) return;
    const root = findCategory(tree, activeRootId);
    const leaves = collectLeaves(root);
    if (!leaves.length) { setError('خدمتی برای اعمال وجود ندارد'); return; }
    setBusy(true);
    setError(null);
    try {
      for (const leaf of leaves) {
        await upsertMyService({ serviceId: leaf.id, durationMin: durationMin || 60, price: price || 0, isActive: true });
      }
      setMsg(`قیمت برای ${leaves.length} مورد اعمال شد`);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddModel() {
    if (!selectedPs || !ruleLabel.trim()) return;
    setBusy(true);
    try {
      await upsertMyPriceRule(selectedPs.id, { label: ruleLabel.trim(), price: rulePrice || price || 0 });
      await upsertMyDurationRule(selectedPs.id, { label: ruleLabel.trim(), durationMin: ruleDuration || durationMin || 60 });
      setRuleLabel(''); setRulePrice(0); setRuleDuration(60);
      setPriceRules(await fetchMyPriceRules(selectedPs.id));
      setDurationRules(await fetchMyDurationRules(selectedPs.id));
      setMsg('زیرمجموعه اضافه شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAddOn() {
    if (!selectedPs || !addOnName.trim()) return;
    setBusy(true);
    try {
      await upsertMyAddOn(selectedPs.id, {
        ...(editingAddOnId ? { id: editingAddOnId } : {}),
        name: addOnName.trim(),
        price: addOnPrice || 0,
        extraDurationMin: addOnExtra || 0,
        isActive: true,
      });
      setAddOnName(''); setAddOnPrice(0); setAddOnExtra(0); setEditingAddOnId(null); setShowAddOnForm(false);
      setMsg(editingAddOnId ? 'ویژگی به‌روزرسانی شد' : 'ویژگی اضافه شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(ps: ProfessionalServiceItem) {
    setBusy(true);
    try {
      await patchMyService(ps.id, { isActive: !(ps.isActive !== false) });
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMedia(id: string) {
    setBusy(true);
    try {
      await deleteMyMedia(id);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadMedia(file: File, attachToPsId?: string) {
    setUploadState('uploading');
    setUploadErr(null);
    try {
      await uploadMyMedia(file, 'portfolio', attachToPsId);
      setUploadState('ok');
      await load();
    } catch (e) {
      setUploadState('err');
      setUploadErr(friendlyApiError(e));
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !tree.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-3 py-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className={`text-lg font-bold ${navy.title}`}>
            {mode === 'home' && 'تخصص‌های من'}
            {mode === 'specialty' && (activeRoot?.name || 'تخصص')}
            {mode === 'edit' && 'ویرایش خدمت'}
            {mode === 'add' && 'افزودن تخصص'}
          </h1>
          {msg && <p className="text-xs text-green-600">{msg}</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        {mode !== 'home' && (
          <button type="button" onClick={goHome} className="text-sm text-gray-500 underline">← بازگشت</button>
        )}
      </div>

      {mode === 'home' && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-500">تخصص‌ها را مدیریت کنید؛ زیرمجموعه‌ها زیر هر تخصص دیده می‌شوند.</p>
            <button type="button" onClick={() => setShowCreateSpecialty((v) => !v)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium ${navy.btn}`}>+ افزودن تخصص</button>
          </div>

          {showCreateSpecialty && (
            <div className={`space-y-3 rounded-2xl border ${navy.border} bg-white p-4`}>
              <p className={`text-sm font-semibold ${navy.title}`}>تخصص جدید</p>
              <Input autoFocus placeholder="نام تخصص" value={newSpecName} onChange={(e) => setNewSpecName(e.target.value)} className="text-right" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[11px] text-gray-500">قیمت (تومان)</label>
                  <Input inputMode="numeric" placeholder="۰" value={newSpecPrice ? formatPriceDigits(newSpecPrice) : ''} onChange={(e) => setNewSpecPrice(parsePriceInput(e.target.value))} className="text-right" />
                </div>
                <div>
                  <label className="mb-0.5 block text-[11px] text-gray-500">مدت (دقیقه)</label>
                  <Input type="number" min={5} placeholder="۶۰" value={newSpecDuration || ''} onChange={(e) => setNewSpecDuration(Number(e.target.value) || 60)} className="text-right" />
                </div>
              </div>
              <Input placeholder="توضیحات (اختیاری)" value={newSpecDesc} onChange={(e) => setNewSpecDesc(e.target.value)} className="text-right" />
              <div className="flex gap-2">
                <button type="button" disabled={busy || !newSpecName.trim()} onClick={() => void createSpecialtyDirect()} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>ذخیره تخصص</button>
                <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setShowCreateSpecialty(false); setNewSpecName(''); setNewSpecPrice(0); setNewSpecDuration(60); setNewSpecDesc(''); }}>انصراف</button>
              </div>
            </div>
          )}

          {mine.length === 0 && !showCreateSpecialty ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
              <p className={`text-sm font-medium ${navy.title}`}>هنوز تخصصی اضافه نکرده‌اید</p>
              <p className="mt-1 text-xs text-gray-500">اولین تخصص خود را با قیمت و مدت ثبت کنید.</p>
              <button type="button" onClick={() => setShowCreateSpecialty(true)} className={`mt-4 rounded-xl px-5 py-2.5 text-sm font-medium ${navy.btn}`}>+ افزودن تخصص</button>
            </div>
          ) : mine.length > 0 ? (
            <div className={`overflow-hidden rounded-2xl border ${navy.border} bg-white`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-right text-sm">
                  <thead>
                    <tr className="bg-[#F3F4F6] text-[11px] font-semibold text-gray-500">
                      <th className="px-3 py-2.5">تخصص / زیرمجموعه</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">قیمت</th>
                      <th className="px-3 py-2.5 whitespace-nowrap">مدت</th>
                      <th className="px-3 py-2.5">وضعیت</th>
                      <th className="px-3 py-2.5">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mine.map((ps, idx) => {
                      const st = statusOf(ps);
                      const subs = (ps.priceRules || []).filter((r) => r.isActive !== false);
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]';
                      const isEditingName = editingNamePsId === ps.id;
                      return (
                        <tr key={ps.id} className={`border-t border-gray-100 ${rowBg}`}>
                          <td className="px-3 py-2.5 align-top">
                            {isEditingName ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <Input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="h-8 max-w-[160px] text-right text-sm" />
                                <button type="button" disabled={busy || !editNameValue.trim()} className="text-xs font-medium text-[#2D6CDF] disabled:opacity-50" onClick={async () => { setBusy(true); try { await renameMyService(ps.id, editNameValue.trim()); setEditingNamePsId(null); setMsg('نام تخصص ذخیره شد'); await load(); } catch (e) { setError(friendlyApiError(e)); } finally { setBusy(false); } }}>ذخیره</button>
                                <button type="button" className="text-xs text-gray-500" onClick={() => setEditingNamePsId(null)}>انصراف</button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-[#0B2C4A]">{serviceLabel(ps)}</span>
                                <button type="button" className="text-[10px] text-gray-400 hover:text-[#2D6CDF]" onClick={() => { setEditingNamePsId(ps.id); setEditNameValue(serviceLabel(ps)); setEditingSubKey(null); }}>ویرایش نام</button>
                              </div>
                            )}
                            {subs.length > 0 && (
                              <ul className="mt-1.5 space-y-1 border-r border-[#E7F1FF] pr-2">
                                {subs.map((pr) => {
                                  const dr = (ps.durationRules || []).find((d) => d.label === pr.label && d.isActive !== false);
                                  const subKey = `${ps.id}:${pr.id}`;
                                  const isEditingSub = editingSubKey === subKey;
                                  return (
                                    <li key={pr.id} className="text-[11px] text-gray-600">
                                      {isEditingSub ? (
                                        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F3F6F9] p-1.5">
                                          <Input value={editSubLabel} onChange={(e) => setEditSubLabel(e.target.value)} className="h-7 w-24 text-right text-[11px]" placeholder="نام" />
                                          <Input inputMode="numeric" value={editSubPrice ? formatPriceDigits(editSubPrice) : ''} onChange={(e) => setEditSubPrice(parsePriceInput(e.target.value))} className="h-7 w-20 text-right text-[11px]" placeholder="قیمت" />
                                          <Input type="number" min={5} value={editSubDuration || ''} onChange={(e) => setEditSubDuration(Number(e.target.value) || 60)} className="h-7 w-14 text-right text-[11px]" placeholder="مدت" />
                                          <button type="button" disabled={busy || !editSubLabel.trim()} className="text-[10px] font-medium text-[#2D6CDF] disabled:opacity-50" onClick={async () => { setBusy(true); try { await upsertMyPriceRule(ps.id, { id: pr.id, label: editSubLabel.trim(), price: editSubPrice || 0 }); if (dr) { await upsertMyDurationRule(ps.id, { id: dr.id, label: editSubLabel.trim(), durationMin: editSubDuration || 60 }); } else { await upsertMyDurationRule(ps.id, { label: editSubLabel.trim(), durationMin: editSubDuration || 60 }); } setEditingSubKey(null); setMsg('زیرمجموعه ذخیره شد'); await load(); } catch (e) { setError(friendlyApiError(e)); } finally { setBusy(false); } }}>ذخیره</button>
                                          <button type="button" className="text-[10px] text-gray-500" onClick={() => setEditingSubKey(null)}>انصراف</button>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                          <span className="text-gray-700">{pr.label}</span>
                                          <span className="tabular-nums text-gray-500">{(pr.price ?? 0) > 0 ? formatPrice(pr.price) : '—'}</span>
                                          <span className="tabular-nums text-gray-400">{dr && (dr.durationMin ?? 0) > 0 ? `${dr.durationMin} د` : '—'}</span>
                                          <button type="button" className="text-[10px] text-[#2D6CDF] hover:underline" onClick={() => { setEditingSubKey(subKey); setEditSubLabel(pr.label); setEditSubPrice(pr.price || 0); setEditSubDuration(dr?.durationMin || 60); setEditingNamePsId(null); }}>ویرایش</button>
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top tabular-nums whitespace-nowrap text-gray-700">{(ps.price ?? 0) > 0 ? formatPrice(ps.price) : '—'}</td>
                          <td className="px-3 py-2.5 align-top tabular-nums whitespace-nowrap text-gray-600">{(ps.durationMin ?? 0) > 0 ? `${ps.durationMin} د` : '—'}</td>
                          <td className="px-3 py-2.5 align-top">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${st === 'ready' ? 'bg-[#E7F1FF] text-[#2D6CDF]' : 'bg-[#FFE6E2] text-[#FF6F61]'}`}>
                              {ps.isActive === false ? 'غیرفعال' : st === 'ready' ? 'آماده' : 'ناقص'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex items-center gap-2">
                              <button type="button" className="text-xs font-medium text-[#2D6CDF] hover:underline" onClick={() => { setSelectedPsId(ps.id); setMode('edit'); }}>جزئیات</button>
                              <button type="button" className="text-xs text-red-600 hover:underline" onClick={async () => { if (!window.confirm(`حذف «${serviceLabel(ps)}»؟`)) return; setBusy(true); try { await deactivateMyService(ps.id); setMsg('حذف شد'); await load(); } catch (e) { setError(friendlyApiError(e)); } finally { setBusy(false); } }}>حذف</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {myRoots.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs font-semibold text-gray-400">دسته‌بندی‌ها</p>
              <div className="flex flex-wrap gap-2">
                {myRoots.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setActiveRootId(r.id); setPath([]); setMode('specialty'); }} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-[#0B2C4A]/40">{r.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'add' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">تخصص‌های تعریف‌شده توسط ادمین را انتخاب کنید.</p>
          <Input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="جستجوی تخصص..." className="w-full" />
          {!roots.length ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-gray-500">
              هنوز تخصصی از پنل سوپرادمین ثبت نشده است.
            </p>
          ) : (
            <ul className={`max-h-80 overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1`}>
              {roots
                .filter((r) => !addSearch.trim() || r.name.includes(addSearch.trim()))
                .map((r) => {
                  const already = selectedRootIds.includes(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={busy || already}
                        className={`w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9] disabled:opacity-50 ${already ? 'text-[#2D6CDF]' : ''}`}
                        onClick={() => void addRootSpecialty(r.id)}
                      >
                        {r.name}{already ? ' · انتخاب‌شده' : ''}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}

      {mode === 'specialty' && activeRootId && (
        <SpecialtyView
          activeRootId={activeRootId}
          activeRoot={activeRoot}
          tree={tree}
          mine={mine}
          path={path}
          setPath={setPath}
          search={search}
          setSearch={setSearch}
          searchResults={searchResults}
          categoryChildren={children}
          leafServices={leafServices}
          menuSections={menuSections}
          specialtyMedia={specialtyMedia}
          specialtyMenu={specialtyMenu}
          busy={busy}
          uploadState={uploadState}
          uploadErr={uploadErr}
          ensureAndEditService={ensureAndEditService}
          setSelectedPsId={setSelectedPsId}
          setMode={setMode}
          setBusy={setBusy}
          setError={setError}
          setMsg={setMsg}
          load={load}
          onDeleteMedia={onDeleteMedia}
          onUploadMedia={onUploadMedia}
          removeRootSpecialty={removeRootSpecialty}
          createAndEditCustomService={createAndEditCustomService}
          createFeature={createFeature}
        />
      )}

      {mode === 'edit' && selectedPs && (
        <ServiceEditPanel
          selectedPs={selectedPs}
          busy={busy}
          price={price}
          setPrice={setPrice}
          durationMin={durationMin}
          setDurationMin={setDurationMin}
          activeRootId={activeRootId}
          showModels={showModels}
          setShowModels={setShowModels}
          priceRules={priceRules}
          setPriceRules={setPriceRules}
          durationRules={durationRules}
          setDurationRules={setDurationRules}
          ruleLabel={ruleLabel}
          setRuleLabel={setRuleLabel}
          rulePrice={rulePrice}
          setRulePrice={setRulePrice}
          ruleDuration={ruleDuration}
          setRuleDuration={setRuleDuration}
          showAddOnForm={showAddOnForm}
          setShowAddOnForm={setShowAddOnForm}
          addOnName={addOnName}
          setAddOnName={setAddOnName}
          addOnPrice={addOnPrice}
          setAddOnPrice={setAddOnPrice}
          addOnExtra={addOnExtra}
          setAddOnExtra={setAddOnExtra}
          editingAddOnId={editingAddOnId}
          setEditingAddOnId={setEditingAddOnId}
          uploadState={uploadState}
          uploadErr={uploadErr}
          onSavePs={onSavePs}
          applyFixedToAllUnderRoot={applyFixedToAllUnderRoot}
          onAddModel={onAddModel}
          onAddOn={onAddOn}
          onToggleActive={onToggleActive}
          onDeleteMedia={onDeleteMedia}
          onUploadMedia={onUploadMedia}
          load={load}
        />
      )}

      <p className="text-center text-xs text-gray-400">
        <Link href="/zibagar/profile/complete" className="underline">تکمیل پروفایل</Link>
      </p>
    </div>
  );
}
