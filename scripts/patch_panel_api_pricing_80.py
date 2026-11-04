#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('frontend/src/lib/panel-api.ts')
    t = path.read_text()
    if 'OptionDeltaMap' in t and 'pricingMode?:' in t:
        print('panel-api already patched')
        return

    old_type = """export type ProfessionalServiceItem = {
  id: string; serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string | null; isActive?: boolean;
  service?: { id: string; name: string; slug?: string; category?: { name?: string; id?: string; slug?: string; parentId?: string | null } | null };
  priceRules?: PriceRuleItem[];
  durationRules?: DurationRuleItem[];
  addOns?: ServiceAddOnItem[];
  mediaAssets?: MediaAssetItem[];
};"""

    new_type = """export type ServiceAttributeOptionItem = {
  id: string;
  label: string;
  suggestedPriceDelta: number;
  suggestedDurationDeltaMin: number;
  forcesDeposit?: boolean;
  sortOrder?: number;
  isActive?: boolean;
};

export type ServiceAttributeGroupItem = {
  id: string;
  name: string;
  required?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  options?: ServiceAttributeOptionItem[];
};

export type PricingMode = 'fixed' | 'variable' | 'deposit';

export type OptionDeltaMap = Record<
  string,
  { priceDelta?: number; durationDeltaMin?: number; active?: boolean }
>;

export type ProfessionalServiceItem = {
  id: string;
  serviceId: string;
  durationMin: number;
  price: number;
  bufferMin?: number;
  description?: string | null;
  isActive?: boolean;
  pricingMode?: PricingMode | string;
  depositAmount?: number | null;
  estimateMinPrice?: number | null;
  estimateMaxPrice?: number | null;
  optionDeltas?: OptionDeltaMap | null;
  service?: {
    id: string;
    name: string;
    slug?: string;
    allowFixed?: boolean;
    allowVariable?: boolean;
    allowDeposit?: boolean;
    defaultPricingMode?: string;
    attributeGroups?: ServiceAttributeGroupItem[];
    category?: { name?: string; id?: string; slug?: string; parentId?: string | null } | null;
  };
  priceRules?: PriceRuleItem[];
  durationRules?: DurationRuleItem[];
  addOns?: ServiceAddOnItem[];
  mediaAssets?: MediaAssetItem[];
};"""

    if old_type not in t:
        raise SystemExit('ProfessionalServiceItem type not found')
    t = t.replace(old_type, new_type, 1)

    old_up = """export async function upsertMyService(payload: { serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string; isActive?: boolean }) {
  return apiClient.post('/professionals/me/services', payload ?? {});
}"""
    new_up = """export async function upsertMyService(payload: {
  serviceId: string;
  durationMin: number;
  price: number;
  bufferMin?: number;
  description?: string;
  isActive?: boolean;
  pricingMode?: PricingMode | string;
  depositAmount?: number;
  estimateMinPrice?: number;
  estimateMaxPrice?: number;
  optionDeltas?: OptionDeltaMap;
}) {
  return apiClient.post('/professionals/me/services', payload ?? {});
}"""
    if old_up not in t:
        raise SystemExit('upsertMyService not found')
    t = t.replace(old_up, new_up, 1)

    old_patch = """export async function patchMyService(id: string, payload: { durationMin?: number; price?: number; bufferMin?: number; description?: string; isActive?: boolean }) {
  return apiClient.patch(`/professionals/me/services/${id}`, payload ?? {});
}"""
    new_patch = """export async function patchMyService(
  id: string,
  payload: {
    durationMin?: number;
    price?: number;
    bufferMin?: number;
    description?: string;
    isActive?: boolean;
    pricingMode?: PricingMode | string;
    depositAmount?: number;
    estimateMinPrice?: number;
    estimateMaxPrice?: number;
    optionDeltas?: OptionDeltaMap;
  },
) {
  return apiClient.patch(`/professionals/me/services/${id}`, payload ?? {});
}"""
    if old_patch not in t:
        raise SystemExit('patchMyService not found')
    t = t.replace(old_patch, new_patch, 1)

    path.write_text(t)
    print('panel-api patched', path.stat().st_size)


if __name__ == '__main__':
    main()
