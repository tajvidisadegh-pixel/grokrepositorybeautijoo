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
  // #80 pure fixed: no extra UI at all
  if (allowed.length === 1 && allowed[0] === 'fixed') {
    return null;
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
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
              state.mode === m
                ? 'border-[#0B2C4A] bg-[#0B2C4A] text-white'
                : 'border-gray-200 bg-white text-gray-700'
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
            inputMode="numeric"
            disabled={disabled}
            value={state.depositAmount}
            onChange={(e) =>
              onChange({ ...state, depositAmount: e.target.value.replace(/[^\d]/g, '') })
            }
            className="h-11 rounded-xl"
            placeholder="مثلاً ۵۰۰۰۰۰"
          />
        </div>
      )}

      {state.mode === 'variable' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">حداقل برآورد</label>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={state.estimateMin}
                onChange={(e) =>
                  onChange({ ...state, estimateMin: e.target.value.replace(/[^\d]/g, '') })
                }
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">حداکثر برآورد</label>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={state.estimateMax}
                onChange={(e) =>
                  onChange({ ...state, estimateMax: e.target.value.replace(/[^\d]/g, '') })
                }
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          {activeGroups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                اختلاف قیمت گزینه‌ها (پیشنهاد کاتالوگ را می‌توانید سفارشی کنید)
              </p>
              {activeGroups.map((g) => (
                <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-2">
                  <p className="mb-2 text-xs font-medium text-[#0B2C4A]">{g.name}</p>
                  <ul className="space-y-2">
                    {(g.options || [])
                      .filter((o) => o.isActive !== false)
                      .map((o) => {
                        const d = state.optionDeltas[o.id];
                        const val =
                          d?.priceDelta != null
                            ? String(d.priceDelta)
                            : String(o.suggestedPriceDelta ?? 0);
                        return (
                          <li key={o.id} className="flex items-center gap-2 text-xs">
                            <span className="min-w-[5rem] flex-1">{o.label}</span>
                            <Input
                              inputMode="numeric"
                              disabled={disabled}
                              value={val}
                              onChange={(e) => {
                                const n = Number(e.target.value.replace(/[^\d-]/g, '')) || 0;
                                onChange({
                                  ...state,
                                  optionDeltas: {
                                    ...state.optionDeltas,
                                    [o.id]: {
                                      priceDelta: n,
                                      durationDeltaMin:
                                        d?.durationDeltaMin ?? o.suggestedDurationDeltaMin ?? 0,
                                      active: true,
                                    },
                                  },
                                });
                              }}
                              className="h-9 w-28 rounded-lg text-xs"
                            />
                            <span className="text-gray-400">تومان</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
