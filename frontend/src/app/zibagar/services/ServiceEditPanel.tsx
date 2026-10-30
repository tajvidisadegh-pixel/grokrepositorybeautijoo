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
  showPortfolio: boolean;
  setShowPortfolio: (v: boolean) => void;
  priceRules: PriceRuleItem[];
  setPriceRules: (v: PriceRuleItem[] | ((p: PriceRuleItem[]) => PriceRuleItem[])) => void;
  durationRules: DurationRuleItem[];
  setDurationRules: (v: DurationRuleItem[] | ((p: DurationRuleItem[]) => DurationRuleItem[])) => void;
  addOns: ServiceAddOnItem[];
  setAddOns: (v: ServiceAddOnItem[] | ((p: ServiceAddOnItem[]) => ServiceAddOnItem[])) => void;
  portfolio: MediaAssetItem[];
  msg: string | null;
  onSaveBasic: () => void;
  onReloadExtras: () => void;
  children?: React.ReactNode;
};

/** Full service editor panel used by /zibagar/services (restored after bad push). */
export function ServiceEditPanel(props: ServiceEditPanelProps) {
  const {
    selectedPs,
    busy,
    price,
    setPrice,
    durationMin,
    setDurationMin,
    showModels,
    setShowModels,
    showPortfolio,
    setShowPortfolio,
    priceRules,
    durationRules,
    addOns,
    portfolio,
    msg,
    onSaveBasic,
    children,
  } = props;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">{serviceLabel(selectedPs)}</h3>
          <p className="text-xs text-gray">وضعیت: {statusOf(selectedPs)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">قیمت (تومان)</label>
          <Input
            inputMode="numeric"
            min={10000}
            value={price ? formatPriceDigits(price) : ''}
            onChange={(e) => setPrice(parsePriceInput(e.target.value))}
          />
          {price != null && price > 0 && price < 10000 && (
            <p className="mt-1 text-xs font-medium text-red-600">قیمت باید حداقل ۱۰٬۰۰۰ تومان باشد.</p>
          )}
          {price >= 10000 && (
            <p className="mt-1 text-[11px] text-gray">{formatPrice(price)} — {priceToWords(price)}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">مدت زمان (دقیقه)</label>
          <Input
            inputMode="numeric"
            value={durationMin ? String(durationMin) : ''}
            onChange={(e) => setDurationMin(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSaveBasic}
          className="inline-flex h-10 items-center rounded-xl bg-coral px-4 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: navy }}
        >
          ذخیره قیمت و زمان
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-xl border border-border px-3 text-xs"
          onClick={() => setShowModels(!showModels)}
        >
          {showModels ? 'بستن مدل‌های قیمت' : 'مدل‌های قیمت / مدت'}
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-xl border border-border px-3 text-xs"
          onClick={() => setShowPortfolio(!showPortfolio)}
        >
          {showPortfolio ? 'بستن نمونه‌کار' : 'نمونه‌کار این خدمت'}
        </button>
      </div>

      {msg && <p className="text-xs text-gray">{msg}</p>}

      {showModels && (
        <div className="space-y-2 rounded-xl bg-gray-light/50 p-3 text-xs">
          <p className="font-medium">قوانین قیمت: {priceRules.length}</p>
          <p>قوانین مدت: {durationRules.length}</p>
          <p>افزودنی‌ها: {addOns.length}</p>
        </div>
      )}

      {showPortfolio && (
        <div className="grid grid-cols-3 gap-2">
          {portfolio.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-lg border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {!isVideoMime(m.mimeType) && m.publicUrl ? (
                <img src={resolveMediaUrl(m.publicUrl)} alt="" className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center text-[10px] text-gray">رسانه</div>
              )}
            </div>
          ))}
          {portfolio.length === 0 && <p className="col-span-3 text-xs text-gray">نمونه‌کاری ثبت نشده.</p>}
        </div>
      )}

      {children}
    </div>
  );
}
