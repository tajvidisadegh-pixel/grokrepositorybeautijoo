#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('frontend/src/app/zibagar/services/page.tsx')
    t = path.read_text()
    if 'PricingModeFields' in t:
        print('page already patched')
        return

    imp = """import {
  PricingModeFields,
  allowedModesFromService,
  initPricingState,
  pricingPayload,
  type PricingModeState,
} from '@/components/zibagar/PricingModeFields';
"""
    marker = "from '@/lib/panel-api';"
    if marker not in t:
        raise SystemExit('panel-api import missing')
    t = t.replace(marker, marker + "\n" + imp, 1)

    old_state = None
    for line in t.splitlines():
        if 'editDescription' in line and 'useState' in line:
            old_state = line
            break
    if not old_state:
        raise SystemExit('description state not found')
    t = t.replace(
        old_state,
        old_state + "\n  const [editPricing, setEditPricing] = useState<PricingModeState>(initPricingState(null));",
        1,
    )

    old_open = """  function openPrice(ps: ProfessionalServiceItem) {
    const p = displayPrice(ps);
    setEditPrice(p != null ? String(p) : '');
    setEditDuration(String(ps.durationMin || 60));
    setEditDescription(ps.description || '');
    setError(null);
    setSheet({ kind: 'price', ps });
  }"""
    new_open = """  function openPrice(ps: ProfessionalServiceItem) {
    const p = displayPrice(ps);
    setEditPrice(p != null ? String(p) : '');
    setEditDuration(String(ps.durationMin || 60));
    setEditDescription(ps.description || '');
    setEditPricing(initPricingState(ps));
    setError(null);
    setSheet({ kind: 'price', ps });
  }"""
    if old_open not in t:
        raise SystemExit('openPrice block missing')
    t = t.replace(old_open, new_open, 1)

    old_save = """      await patchMyService(sheet.ps.id, {
        price: priceNum,
        durationMin: dur,
        description: editDescription.trim() || undefined,
        isActive: true,
      });"""
    new_save = """      const pricing = pricingPayload(editPricing);
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
      });"""
    if old_save not in t:
        raise SystemExit('savePriceEdit patch block missing')
    t = t.replace(old_save, new_save, 1)

    marker_dur = """            <div>
              <label className="mb-1.5 block text-sm text-gray">مدت (دقیقه)</label>"""
    insert = """            {sheet.ps && (
              <PricingModeFields
                allowed={allowedModesFromService(sheet.ps.service)}
                state={editPricing}
                onChange={setEditPricing}
                groups={sheet.ps.service?.attributeGroups}
                disabled={busy}
              />
            )}
            <div>
              <label className="mb-1.5 block text-sm text-gray">مدت (دقیقه)</label>"""
    idx = t.find("open={sheet?.kind === 'price'}")
    if idx < 0:
        raise SystemExit('price dialog missing')
    sub = t[idx:]
    if marker_dur not in sub:
        raise SystemExit('duration marker not in price dialog')
    t = t[:idx] + sub.replace(marker_dur, insert, 1)

    path.write_text(t)
    print('patched page', path.stat().st_size)


if __name__ == '__main__':
    main()
