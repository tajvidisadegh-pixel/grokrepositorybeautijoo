'use client';

import { Input } from '@/components/ui/input';
import type {
  OptionDeltaMap,
  PricingMode,
  ProfessionalServiceItem,
  ServiceAttributeGroupItem,
} from '@/lib/panel-api';

export type PricingModeState = {
  mode: PricingMode;
  depositAmount: string;
  estimateMin: string;
  estimateMax: string;
  optionDeltas: OptionDeltaMap;
};

export function allowedModesFromService(
  service?: ProfessionalServiceItem['service'],
): PricingMode[] {
  const modes: PricingMode[] = [];
  if (service?.allowFixed !== false) modes.push('fixed');
  if (service?.allowVariable) modes.push('variable');
  if (service?.allowDeposit) modes.push('deposit');
  if (modes.length === 0) modes.push('fixed');
  return modes;
}

export function initPricingState(ps?: ProfessionalServiceItem | null): PricingModeState {
  const allowed = allowedModesFromService(ps?.service);
  const raw = (ps?.pricingMode || ps?.service?.defaultPricingMode || 'fixed') as PricingMode;
  const mode = allowed.includes(raw) ? raw : allowed[0];
  return {
    mode,
    depositAmount: ps?.depositAmount != null ? String(ps.depositAmount) : '',
    estimateMin: ps?.estimateMinPrice != null ? String(ps.estimateMinPrice) : '',
    estimateMax: ps?.estimateMaxPrice != null ? String(ps.estimateMaxPrice) : '',
    optionDeltas: { ...(ps?.optionDeltas || {}) },
  };
}

export function pricingPayload(state: PricingModeState): {
  pricingMode: PricingMode;
  depositAmount?: number;
  estimateMinPrice?: number;
  estimateMaxPrice?: number;
  optionDeltas?: OptionDeltaMap;
} {
  const out: {
    pricingMode: PricingMode;
    depositAmount?: number;
    estimateMinPrice?: number;
    estimateMaxPrice?: number;
    optionDeltas?: OptionDeltaMap;
  } = { pricingMode: state.mode };

  if (state.mode === 'deposit') {
    const n = Number(String(state.depositAmount).replace(/[^\d]/g, ''));
    if (Number.isFinite(n)) out.depositAmount = n;
  }
  if (state.mode === 'variable') {
    const min = Number(String(state.estimateMin).replace(/[^\d]/g, ''));
    const max = Number(String(state.estimateMax).replace(/[^\d]/g, ''));
    if (Number.isFinite(min) && min > 0) out.estimateMinPrice = min;
    if (Number.isFinite(max) && max > 0) out.estimateMaxPrice = max;
    if (Object.keys(state.optionDeltas).length > 0) out.optionDeltas = state.optionDeltas;
  }
  return out;
}

const MODE_LABEL: Record<PricingMode, string> = {
  fixed: 'قیمت ثابت',
  variable: 'قیمت متغیر (گزینه‌ها)',
  deposit: 'بیعانه',
};

type Props = {
  allowed: PricingMode[];
  state: PricingModeState;
  onChange: (next: PricingModeState) => void;
  groups?: ServiceAttributeGroupItem[];
  disabled?: boolean;
};

export function PricingModeFields({ allowed, state, onChange, groups, disabled }: Props) {
  // Pure fixed with no other modes: explain why picker is hidden
  if (allowed.length === 1 && allowed[0] === 'fixed') {
    return (
      <p className="rounded-xl border border-border bg-gray-50 px-3 py-2 text-xs text-gray-600" dir="rtl">
        حالت این خدمت: <b>قیمت ثابت</b> (در کاتالوگ ادمین فقط ثابت مجاز است — برای متغیر/بیعانه از پنل ادمین مجوز بدهید)
      </p>
    );
  }

  const activeGroups = (groups || []).filter((g) => g.isActive !== false);
  const showModePicker = allowed.length > 1;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-[#F7FBFF] p-3" dir="rtl">
      {showModePicker && (
        <>
          <p className="text-sm font-medium text-[#0B2C4A]">حالت قیمت‌گذاری</p>
          <p className="text-[11px] text-gray-500">فقط حالت‌هایی که برای این خدمت باز شده‌اند.</p>
          <div className="flex flex-wrap gap-2">
            {allowed.map((m) => (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...state, mode: m })}
                className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                  state.mode === m
                    ? 'bg-[#2D6CDF] text-white'
                    : 'border border-border bg-white text-gray-700'
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </>
      )}

      {state.mode === 'deposit' && (
        <div>
          <label className="mb-1 block text-xs text-gray-500">مبلغ بیعانه (تومان)</label>
          <Input
            value={state.depositAmount}
            onChange={(e) => onChange({ ...state, depositAmount: e.target.value })}
            disabled={disabled}
            inputMode="numeric"
            placeholder="مثلاً 100000"
          />
        </div>
      )}

      {state.mode === 'variable' && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">حداقل تخمینی</label>
              <Input
                value={state.estimateMin}
                onChange={(e) => onChange({ ...state, estimateMin: e.target.value })}
                disabled={disabled}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">حداکثر تخمینی</label>
              <Input
                value={state.estimateMax}
                onChange={(e) => onChange({ ...state, estimateMax: e.target.value })}
                disabled={disabled}
                inputMode="numeric"
              />
            </div>
          </div>
          {activeGroups.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-white p-2">
              <p className="text-[11px] font-medium text-gray-600">Δ قیمت گزینه‌ها (تومان)</p>
              {activeGroups.map((g) => (
                <div key={g.id}>
                  <p className="text-[11px] text-[#0B2C4A]">{g.name}</p>
                  <div className="mt-1 space-y-1">
                    {(g.options || [])
                      .filter((o) => o.isActive !== false)
                      .map((o) => (
                        <div key={o.id} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 text-[11px] text-gray-600">{o.label}</span>
                          <Input
                            className="h-8"
                            value={state.optionDeltas[o.id] != null ? String(state.optionDeltas[o.id]) : ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = { ...state.optionDeltas };
                              if (v === '') delete next[o.id];
                              else next[o.id] = Number(v.replace(/[^\d-]/g, '')) || 0;
                              onChange({ ...state, optionDeltas: next });
                            }}
                            disabled={disabled}
                            inputMode="numeric"
                            placeholder="0"
                          />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
