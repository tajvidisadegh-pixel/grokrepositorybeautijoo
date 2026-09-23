'use client';

import { Fragment, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import {
  deactivateMyService,
  resolveMediaUrl,
  type CatalogCategory,
  type MediaAssetItem,
  type ProfessionalServiceItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatPriceDigits, parsePriceInput } from '@/lib/utils';
import {
  findCategory,
  isVideoMime,
  navy,
  serviceLabel,
  statusOf,
  type PathNode,
} from './services-helpers';

export type SpecialtyViewProps = {
  activeRootId: string;
  activeRoot: CatalogCategory | null;
  tree: CatalogCategory[];
  mine: ProfessionalServiceItem[];
  path: PathNode[];
  setPath: Dispatch<SetStateAction<PathNode[]>>;
  search: string;
  setSearch: (v: string) => void;
  searchResults: Array<{ type: 'cat' | 'svc'; id: string; name: string; path: string; rootId: string }>;
  categoryChildren: CatalogCategory[];
  leafServices: Array<{ id: string; name: string }>;
  menuSections: Array<[string, ProfessionalServiceItem[]]>;
  specialtyMedia: MediaAssetItem[];
  specialtyMenu: ProfessionalServiceItem[];
  busy: boolean;
  uploadState: 'idle' | 'uploading' | 'ok' | 'err';
  uploadErr: string | null;
  ensureAndEditService: (serviceId: string, nameHint?: string) => void | Promise<void>;
  setSelectedPsId: (id: string | null) => void;
  setMode: (m: 'home' | 'specialty' | 'edit' | 'add') => void;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  setMsg: (v: string | null) => void;
  load: () => void | Promise<void>;
  onDeleteMedia: (id: string) => void | Promise<void>;
  onUploadMedia: (file: File, attachToPsId?: string) => void | Promise<void>;
  removeRootSpecialty: (rootId: string) => void | Promise<void>;
  createAndEditCustomService: (
    name: string,
    initial?: { price?: number; durationMin?: number },
  ) => void | Promise<void>;
  createFeature: (name: string) => void | Promise<void>;
};

export function SpecialtyView(props: SpecialtyViewProps) {
  const {
    activeRootId,
    activeRoot,
    tree,
    mine,
    path,
    setPath,
    search,
    setSearch,
    searchResults,
    menuSections,
    specialtyMedia,
    specialtyMenu,
    busy,
    uploadState,
    uploadErr,
    ensureAndEditService,
    setSelectedPsId,
    setMode,
    setBusy,
    setError,
    setMsg,
    load,
    onDeleteMedia,
    onUploadMedia,
    removeRootSpecialty,
    createAndEditCustomService,
    createFeature,
  } = props;

  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeatureName, setNewFeatureName] = useState('');
  const [showAddFinal, setShowAddFinal] = useState(false);
  const [newFinalName, setNewFinalName] = useState('');
  const [newFinalPrice, setNewFinalPrice] = useState(0);
  const [newFinalDuration, setNewFinalDuration] = useState(60);

  const rootDirectChildren = useMemo(() => {
    if (!activeRootId) return [];
    return findCategory(tree, activeRootId)?.children || [];
  }, [activeRootId, tree]);

  const selectedHorizontalId = path.length > 0 ? path[0].id : null;

  const verticalItems = useMemo(() => {
    if (path.length === 0) return [];
    const cat = findCategory(tree, path[path.length - 1].id);
    return cat?.children || [];
  }, [path, tree]);

  const currentLeafServices = useMemo(() => {
    if (path.length === 0) return [];
    const cat = findCategory(tree, path[path.length - 1].id);
    return cat?.services || [];
  }, [path, tree]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <button type="button" className="font-medium text-[#0B2C4A]" onClick={() => setPath([])}>
          {activeRoot?.name}
        </button>
        {path.map((node, idx) => (
          <span key={node.id} className="flex items-center gap-1">
            <span>↓</span>
            <button type="button" className="font-medium text-[#0B2C4A]" onClick={() => setPath(path.slice(0, idx + 1))}>
              {node.name}
            </button>
          </span>
        ))}
      </div>

      {path.length === 0 && rootDirectChildren.length === 0 && (findCategory(tree, activeRootId)?.services || []).length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className={`mb-1 text-base font-semibold ${navy.title}`}>{activeRoot?.name}</p>
          <p className="text-sm text-gray-500">
            هنوز زیرمجموعه‌ای در کاتالوگ ادمین برای این تخصص تعریف نشده.
            از پنل سوپرادمین دسته‌بندی و خدمات را اضافه کنید.
          </p>
        </div>
      )}
      {path.length === 0 && (findCategory(tree, activeRootId)?.services || []).length > 0 && (
        <ul className="space-y-2">
          {(findCategory(tree, activeRootId)?.services || []).map((s) => {
            const offered = mine.find((m) => m.serviceId === s.id);
            const st = statusOf(offered);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => void ensureAndEditService(s.id, s.name)} className={`flex w-full items-center justify-between rounded-2xl border ${navy.border} bg-white px-4 py-3 text-right text-sm`}>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-gray-500">{offered ? (st === 'ready' ? `${formatPrice(offered.price)} · 🟢` : '🟡 تکمیل') : 'تنظیم قیمت'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
        </div>
      )}

      {rootDirectChildren.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2">
            {rootDirectChildren.map((c) => {
              const selected = selectedHorizontalId === c.id;
              return (
                <button key={c.id} type="button" onClick={() => setPath([{ id: c.id, name: c.name }])} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${selected ? 'bg-[#0B2C4A] text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-[#0B2C4A]/40'}`}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {path.length > 0 && (
        <div className="space-y-3">
          <p className={`text-sm font-semibold ${navy.title}`}>{path[path.length - 1].name}</p>
          {verticalItems.length > 0 && (
            <ul className="space-y-2">
              {verticalItems.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setPath((p) => [...p, { id: c.id, name: c.name }])} className={`flex w-full items-center justify-between rounded-2xl border ${navy.border} bg-white px-4 py-3 text-right text-sm`}>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-gray-400">ادامه ←</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {currentLeafServices.length > 0 && (
            <ul className="space-y-2">
              {currentLeafServices.map((s) => {
                const offered = mine.find((m) => m.serviceId === s.id);
                const st = statusOf(offered);
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => void ensureAndEditService(s.id, s.name)} className={`flex w-full items-center justify-between rounded-2xl border ${navy.border} bg-white px-4 py-3 text-right text-sm`}>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-gray-500">{offered ? (st === 'ready' ? `${formatPrice(offered.price)} · 🟢` : '🟡 تکمیل') : 'تنظیم قیمت'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {!showAddFeature ? (
              <button type="button" onClick={() => { setShowAddFeature(true); setShowAddFinal(false); }} className="rounded-xl border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-[#0B2C4A]/40">+ افزودن ویژگی</button>
            ) : (
              <div className="w-full space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <Input autoFocus placeholder="نام ویژگی بعدی..." value={newFeatureName} onChange={(e) => setNewFeatureName(e.target.value)} className="text-right" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !newFeatureName.trim()} onClick={async () => { await createFeature(newFeatureName.trim()); setNewFeatureName(''); setShowAddFeature(false); }} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>تأیید</button>
                  <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setShowAddFeature(false); setNewFeatureName(''); }}>انصراف</button>
                </div>
              </div>
            )}
            {!showAddFinal ? (
              <button type="button" onClick={() => { setShowAddFinal(true); setShowAddFeature(false); }} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn}`}>+ افزودن گزینه نهایی</button>
            ) : (
              <div className="w-full space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <Input autoFocus placeholder="نام گزینه نهایی" value={newFinalName} onChange={(e) => setNewFinalName(e.target.value)} className="text-right" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[11px] text-gray-500">قیمت (اختیاری)</label>
                    <Input inputMode="numeric" placeholder="۰" value={newFinalPrice ? formatPriceDigits(newFinalPrice) : ''} onChange={(e) => setNewFinalPrice(parsePriceInput(e.target.value))} className="text-right" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[11px] text-gray-500">مدت (دقیقه)</label>
                    <Input type="number" min={5} placeholder="۶۰" value={newFinalDuration || ''} onChange={(e) => setNewFinalDuration(Number(e.target.value) || 60)} className="text-right" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !newFinalName.trim()} onClick={async () => { await createAndEditCustomService(newFinalName.trim(), { price: newFinalPrice || 0, durationMin: newFinalDuration || 60 }); setNewFinalName(''); setNewFinalPrice(0); setNewFinalDuration(60); setShowAddFinal(false); }} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>ایجاد و ذخیره</button>
                  <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setShowAddFinal(false); setNewFinalName(''); setNewFinalPrice(0); setNewFinalDuration(60); }}>انصراف</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500">جستجوی سریع در کاتالوگ</summary>
        <div className="relative mt-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو..." className="w-full rounded-xl border border-gray-200 bg-white py-2 text-sm" />
          {search.trim() && (
            <ul className={`absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border ${navy.border} bg-white p-1 shadow-lg`}>
              {searchResults.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button type="button" className="w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-[#F3F6F9]" onClick={() => { setSearch(''); if (r.type === 'svc') { void ensureAndEditService(r.id, r.name); } else { const cat = findCategory(tree, r.id); if (cat) setPath([{ id: cat.id, name: cat.name }]); } }}>{r.name}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {menuSections.length > 0 && (
        <div className={`overflow-hidden rounded-2xl border ${navy.border} bg-white`}>
          <div className={`border-b ${navy.border} px-4 py-3`}>
            <h2 className={`text-sm font-semibold ${navy.title}`}>منوی {activeRoot?.name}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-right text-sm">
              <thead>
                <tr className="bg-[#F3F6F9] text-[11px] font-semibold tracking-wide text-gray-500">
                  <th className="px-3 py-2.5">خدمت</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">قیمت</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">مدت</th>
                  <th className="px-3 py-2.5">وضعیت</th>
                  <th className="px-3 py-2.5">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {menuSections.map(([section, items]) => (
                  <Fragment key={section}>
                    {menuSections.length > 1 && (
                      <tr className="bg-[#E7F1FF]/40">
                        <td colSpan={5} className="px-3 py-1.5 text-[11px] font-semibold text-[#2D6CDF]">{section}</td>
                      </tr>
                    )}
                    {items.map((ps, idx) => {
                      const st = statusOf(ps);
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]';
                      return (
                        <tr key={ps.id} className={`border-t border-gray-100 ${rowBg}`}>
                          <td className="px-3 py-2.5 font-medium text-[#0B2C4A]">
                            <button type="button" className="text-right hover:underline" onClick={() => { setSelectedPsId(ps.id); setMode('edit'); }}>{serviceLabel(ps)}</button>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-gray-700">{(ps.price ?? 0) > 0 ? formatPrice(ps.price) : '—'}</td>
                          <td className="px-3 py-2.5 tabular-nums whitespace-nowrap text-gray-600">{(ps.durationMin ?? 0) > 0 ? `${ps.durationMin} د` : '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${st === 'ready' ? 'bg-[#E7F1FF] text-[#2D6CDF]' : 'bg-[#FFE6E2] text-[#FF6F61]'}`}>
                              {st === 'ready' ? 'آماده' : 'ناقص'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <button type="button" className="text-xs font-medium text-[#2D6CDF] hover:underline" onClick={() => { setSelectedPsId(ps.id); setMode('edit'); }}>ویرایش</button>
                              <button type="button" className="text-xs text-red-600 hover:underline" onClick={async () => { if (!window.confirm(`حذف «${serviceLabel(ps)}»؟`)) return; setBusy(true); try { await deactivateMyService(ps.id); setMsg('حذف شد'); await load(); } catch (e) { setError(friendlyApiError(e)); } finally { setBusy(false); } }}>حذف</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`rounded-2xl border ${navy.border} bg-white p-4`}>
        <p className={`mb-2 text-sm font-medium ${navy.title}`}>نمونه‌کار تخصص</p>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {specialtyMedia.map((m) => (
            <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
              {isVideoMime(m.mimeType) ? (
                <video src={resolveMediaUrl(m.publicUrl)} className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveMediaUrl(m.publicUrl)} alt="" className="h-full w-full object-cover" />
              )}
              <button type="button" className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white" onClick={() => onDeleteMedia(m.id)}>حذف</button>
            </div>
          ))}
        </div>
        <label className="inline-block cursor-pointer text-sm text-blue-600">
          {uploadState === 'uploading' ? 'در حال آپلود...' : '+ افزودن نمونه‌کار'}
          <input type="file" accept="image/*,video/*" className="hidden" disabled={busy || uploadState === 'uploading'} onChange={(e) => { const f = e.target.files?.[0]; if (f) { void (async () => { if (specialtyMenu.length > 0) { await onUploadMedia(f, specialtyMenu[0].id); } else { setError('ابتدا یک خدمت ثبت کنید، سپس نمونه‌کار اضافه کنید.'); } })(); } e.target.value = ''; }} />
        </label>
        {uploadState === 'err' && uploadErr && <p className="mt-2 text-xs text-red-600">آپلود ناموفق بود: {uploadErr}</p>}
      </div>

      <button type="button" className="text-xs text-gray-400 underline" onClick={() => { const name = activeRoot?.name || 'این تخصص'; if (!window.confirm(`حذف تخصص «${name}»\n\nبا حذف این تخصص، تمام خدمات و ویژگی‌های مرتبط با آن از لیست تخصص‌های شما حذف خواهند شد.\nآیا مطمئن هستید؟`)) return; void removeRootSpecialty(activeRootId); }}>حذف تخصص</button>
    </div>
  );
}
