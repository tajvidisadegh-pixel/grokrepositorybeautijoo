'use client';

import { Input } from '@/components/ui/input';
import {
  deactivateMyAddOn,
  deleteMyDurationRule,
  deleteMyPriceRule,
  fetchMyDurationRules,
  fetchMyPriceRules,
  resolveMediaUrl,
  type DurationRuleItem,
  type MediaAssetItem,
  type PriceRuleItem,
  type ProfessionalServiceItem,
  type ServiceAddOnItem,
} from '@/lib/panel-api';
import { formatPrice, formatPriceDigits, parsePriceInput, priceToWords } from '@/lib/utils';
import { ServiceFilterCategoryPicker } from './ServiceFilterCategoryPicker';
import { isVideoMime, navy, serviceLabel, statusOf } from './services-helpers';

export type ServiceEditPanelProps = {
  selectedPs: ProfessionalServiceItem;
  busy: boolean;
  price: number;
  setPrice: (n: number) => void;
  durationMin: number;
  setDurationMin: (n: number) => void;
  activeRootId: string | null;
  showModels: boolean;
  setShowModels: (v: boolean) => void;
  priceRules: PriceRuleItem[];
  setPriceRules: (v: PriceRuleItem[]) => void;
  durationRules: DurationRuleItem[];
  setDurationRules: (v: DurationRuleItem[]) => void;
  ruleLabel: string;
  setRuleLabel: (v: string) => void;
  rulePrice: number;
  setRulePrice: (n: number) => void;
  ruleDuration: number;
  setRuleDuration: (n: number) => void;
  showAddOnForm: boolean;
  setShowAddOnForm: (v: boolean) => void;
  addOnName: string;
  setAddOnName: (v: string) => void;
  addOnPrice: number;
  setAddOnPrice: (n: number) => void;
  addOnExtra: number;
  setAddOnExtra: (n: number) => void;
  editingAddOnId: string | null;
  setEditingAddOnId: (id: string | null) => void;
  uploadState: 'idle' | 'uploading' | 'ok' | 'err';
  uploadErr: string | null;
  onSavePs: () => void | Promise<void>;
  applyFixedToAllUnderRoot: () => void | Promise<void>;
  onAddModel: () => void | Promise<void>;
  onAddOn: () => void | Promise<void>;
  onToggleActive: (ps: ProfessionalServiceItem) => void | Promise<void>;
  onDeleteMedia: (id: string) => void | Promise<void>;
  onUploadMedia: (file: File, attachToPsId?: string) => void | Promise<void>;
  load: () => void | Promise<void>;
};

export function ServiceEditPanel(props: ServiceEditPanelProps) {
  const { selectedPs, busy, price, setPrice, durationMin, setDurationMin, activeRootId, showModels, setShowModels, priceRules, setPriceRules, durationRules, setDurationRules, ruleLabel, setRuleLabel, rulePrice, setRulePrice, ruleDuration, setRuleDuration, showAddOnForm, setShowAddOnForm, addOnName, setAddOnName, addOnPrice, setAddOnPrice, addOnExtra, setAddOnExtra, editingAddOnId, setEditingAddOnId, uploadState, uploadErr, onSavePs, applyFixedToAllUnderRoot, onAddModel, onAddOn, onToggleActive, onDeleteMedia, onUploadMedia, load } = props;

  return (
    <div className={`space-y-5 rounded-2xl border ${navy.border} bg-white p-4`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{statusOf(selectedPs) === 'ready' ? '🟢 آماده رزرو' : '🟡 نیاز به تکمیل'}</p>
        <button type="button" disabled={busy} onClick={() => onToggleActive(selectedPs)} className="text-xs text-gray-500 underline">{selectedPs.isActive === false ? 'فعال کردن' : 'غیرفعال'}</button>
      </div>

      <div>
        <p className={`mb-1 text-sm font-semibold ${navy.title}`}>{serviceLabel(selectedPs)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">قیمت (تومان) — اختیاری</label>
            <Input inputMode="numeric" value={price ? formatPriceDigits(price) : ''} onChange={(e) => setPrice(parsePriceInput(e.target.value))} />
            {price > 0 && <span className="mt-1 block text-xs text-gray-500">{priceToWords(price)}</span>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">مدت (دقیقه)</label>
            <Input type="number" min={5} value={durationMin || ''} onChange={(e) => setDurationMin(parsePriceInput(e.target.value) || 0)} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={onSavePs} className={`rounded-xl px-5 py-2.5 text-sm font-medium ${navy.btn} disabled:opacity-50`}>ذخیره</button>
          {activeRootId && <button type="button" disabled={busy || !(price > 0)} onClick={applyFixedToAllUnderRoot} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${navy.btnOutline} disabled:opacity-50`}>اعمال به همه زیر این تخصص</button>}
        </div>
      </div>

      <ServiceFilterCategoryPicker psId={selectedPs.id} />

      <div className={`border-t ${navy.border} pt-4`}>
        <button type="button" onClick={() => setShowModels(!showModels)} className={`mb-2 text-sm font-medium ${navy.title}`}>{showModels ? '▼' : '▶'} زیرمجموعه‌ها</button>
        {showModels && <div className="space-y-3">
          {(priceRules.length > 0 || durationRules.length > 0) && <div className="overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="text-xs text-gray-400"><th className="py-1">نام</th><th className="py-1">قیمت</th><th className="py-1">زمان</th><th className="py-1"></th></tr></thead><tbody>
            {Array.from(new Set([...priceRules.map((r) => r.label), ...durationRules.map((r) => r.label)])).map((label) => {
              const pr = priceRules.find((r) => r.label === label); const dr = durationRules.find((r) => r.label === label);
              return <tr key={label} className={`border-t ${navy.border}`}><td className="py-2">{label}</td><td className="py-2 tabular-nums">{pr ? formatPrice(pr.price) : '—'}</td><td className="py-2">{dr ? `${dr.durationMin} دقیقه` : '—'}</td><td className="py-2"><button type="button" className="text-xs text-red-600" onClick={async () => { if (!selectedPs) return; if (pr) await deleteMyPriceRule(selectedPs.id, pr.id); if (dr) await deleteMyDurationRule(selectedPs.id, dr.id); setPriceRules(await fetchMyPriceRules(selectedPs.id)); setDurationRules(await fetchMyDurationRules(selectedPs.id)); }}>حذف</button></td></tr>;
            })}
          </tbody></table></div>}
          <div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام زیرمجموعه" value={ruleLabel} onChange={(e) => setRuleLabel(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت" value={rulePrice ? formatPriceDigits(rulePrice) : ''} onChange={(e) => setRulePrice(parsePriceInput(e.target.value))} /><Input type="number" min={5} placeholder="زمان" value={ruleDuration || ''} onChange={(e) => setRuleDuration(Number(e.target.value) || 60)} /></div>
          <button type="button" disabled={busy || !ruleLabel.trim()} onClick={onAddModel} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>افزودن زیرمجموعه</button>
        </div>}
      </div>

      <div className={`border-t ${navy.border} pt-4`}>
        {(selectedPs.addOns || []).filter((a) => a.isActive !== false).length > 0 && <ul className="mb-3 space-y-2">{(selectedPs.addOns || []).filter((a: ServiceAddOnItem) => a.isActive !== false).map((a) => <li key={a.id} className={`flex items-center justify-between rounded-xl border ${navy.border} px-3 py-2 text-sm`}><span>{a.name}<span className="mr-2 text-xs text-gray-500">{formatPrice(a.price)}{a.extraDurationMin ? ` · +${a.extraDurationMin}د` : ''}</span></span><span className="flex items-center gap-2"><button type="button" className="text-xs text-blue-600" onClick={() => { setEditingAddOnId(a.id); setAddOnName(a.name); setAddOnPrice(a.price || 0); setAddOnExtra(a.extraDurationMin || 0); setShowAddOnForm(true); }}>ویرایش</button><button type="button" className="text-xs text-gray-500" onClick={() => deactivateMyAddOn(a.id).then(load)}>حذف</button></span></li>)}</ul>}
        {!showAddOnForm ? <button type="button" onClick={() => setShowAddOnForm(true)} className={`text-sm font-medium ${navy.title}`}>+ افزودن ویژگی</button> : <div className="space-y-2"><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام ویژگی" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت" value={addOnPrice ? formatPriceDigits(addOnPrice) : ''} onChange={(e) => setAddOnPrice(parsePriceInput(e.target.value))} /><Input type="number" min={0} placeholder="زمان اضافه" value={addOnExtra || ''} onChange={(e) => setAddOnExtra(Number(e.target.value) || 0)} /></div><div className="flex gap-2"><button type="button" disabled={busy || !addOnName.trim()} onClick={onAddOn} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>{editingAddOnId ? 'ذخیره تغییرات' : 'تأیید'}</button>{editingAddOnId && <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setEditingAddOnId(null); setAddOnName(''); setAddOnPrice(0); setAddOnExtra(0); setShowAddOnForm(false); }}>انصراف</button>}</div></div>}
      </div>

      <div className={`border-t ${navy.border} pt-4`}>
        <p className={`mb-2 text-sm font-medium ${navy.title}`}>نمونه‌کار این خدمت</p>
        <div className="mb-2 grid grid-cols-3 gap-2">{(selectedPs.mediaAssets || []).map((m: MediaAssetItem) => <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">{isVideoMime(m.mimeType) ? <video src={resolveMediaUrl(m.publicUrl)} className="h-full w-full object-cover" /> : <img src={resolveMediaUrl(m.publicUrl)} alt="" className="h-full w-full object-cover" />}<button type="button" className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white" onClick={() => onDeleteMedia(m.id)}>حذف</button></div>)}</div>
        <label className="inline-block cursor-pointer text-sm text-blue-600">+ آپلود عکس/ویدیو<input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUploadMedia(f, selectedPs.id); e.target.value = ''; }} /></label>
        {uploadState === 'err' && uploadErr && <p className="mt-1 text-xs text-red-600">{uploadErr}</p>}
      </div>
    </div>
  );
}
