#!/usr/bin/env python3
"""#80 Phase2.2 — customer booking UI when forcesDeposit option selected."""
from pathlib import Path


def patch_booking_page() -> None:
    path = Path('frontend/src/app/booking/[slug]/page.tsx')
    t = path.read_text()
    if 'forcesDeposit' in t:
        print('booking page already has forcesDeposit')
        return
    old_type = """  options?: Array<{
    id: string;
    label: string;
    suggestedPriceDelta?: number;
    suggestedDurationDeltaMin?: number;
  }>;"""
    new_type = """  options?: Array<{
    id: string;
    label: string;
    suggestedPriceDelta?: number;
    suggestedDurationDeltaMin?: number;
    forcesDeposit?: boolean;
  }>;"""
    if old_type not in t:
        raise SystemExit('AttrGroupLite options type missing')
    t = t.replace(old_type, new_type, 1)

    old_map = """      options: (g.options || []).map((o) => ({
        id: o.id,
        label: o.label,
        suggestedPriceDelta: o.suggestedPriceDelta ?? 0,
        suggestedDurationDeltaMin: o.suggestedDurationDeltaMin ?? 0,
      })),"""
    new_map = """      options: (g.options || []).map((o) => ({
        id: o.id,
        label: o.label,
        suggestedPriceDelta: o.suggestedPriceDelta ?? 0,
        suggestedDurationDeltaMin: o.suggestedDurationDeltaMin ?? 0,
        forcesDeposit: !!(o as { forcesDeposit?: boolean }).forcesDeposit,
      })),"""
    if old_map not in t:
        raise SystemExit('options map missing')
    t = t.replace(old_map, new_map, 1)
    path.write_text(t)
    print('booking page patched', path.stat().st_size)


def patch_wizard() -> None:
    path = Path('frontend/src/components/booking/booking-wizard.tsx')
    t = path.read_text()
    if 'forcesDepositActive' in t:
        print('wizard already has forcesDepositActive')
        return

    old_opt = """type AttrOption = {
  id: string;
  label: string;
  suggestedPriceDelta: number;
  suggestedDurationDeltaMin: number;
};"""
    new_opt = """type AttrOption = {
  id: string;
  label: string;
  suggestedPriceDelta: number;
  suggestedDurationDeltaMin: number;
  forcesDeposit?: boolean;
};"""
    if old_opt not in t:
        raise SystemExit('AttrOption missing')
    t = t.replace(old_opt, new_opt, 1)

    if 'const displayPrice = basePrice + optionExtras.price + addOnExtraPrice;' not in t:
        raise SystemExit('displayPrice line missing')

    inject = """
  const forcesDepositActive = useMemo(() => {
    if (!selected || mode !== 'variable') return false;
    for (const g of selected.attributeGroups || []) {
      for (const o of g.options || []) {
        if (selectedOptionIds.includes(o.id) && o.forcesDeposit) return true;
      }
    }
    return false;
  }, [selected, mode, selectedOptionIds]);

  const isDepositPath = mode === 'deposit' || forcesDepositActive;

  const displayPriceRaw = basePrice + optionExtras.price + addOnExtraPrice;
  const displayPrice =
    forcesDepositActive && selected?.depositAmount != null && selected.depositAmount >= 0
      ? selected.depositAmount
      : displayPriceRaw;
"""
    t = t.replace(
        '  const displayPrice = basePrice + optionExtras.price + addOnExtraPrice;\n',
        inject,
        1,
    )

    t = t.replace(
        "{selected && mode === 'deposit' && (",
        "{selected && isDepositPath && (",
    )

    if 'این انتخاب مسیر بیعانه را فعال کرد' not in t:
        notice = """
            {selected && forcesDepositActive && (
              <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                <p className="font-semibold">این انتخاب مسیر بیعانه را فعال کرد</p>
                <p className="mt-1 text-xs leading-5">
                  به‌خاطر گزینه‌ای که انتخاب کردید، مبلغ قابل پرداخت الان فقط بیعانه است
                  {selected.depositAmount != null
                    ? ` (${formatPrice(selected.depositAmount)})`
                    : ''}
                  . قیمت نهایی پس از بررسی حضوری/قبل از شروع کار مشخص می‌شود.
                </p>
              </div>
            )}
"""
        placed = False
        for anchor in [
            '{(selected.addOns || []).length > 0 && (',
            '{selected && (selected.addOns || []).length > 0 && (',
        ]:
            if anchor in t:
                t = t.replace(anchor, notice + anchor, 1)
                placed = True
                break
        if not placed and 'جزئیات مبلغ' in t:
            t = t.replace(
                '<p className="font-medium">جزئیات مبلغ</p>',
                notice + '<p className="font-medium">جزئیات مبلغ</p>',
                1,
            )

    t = t.replace(
        '<span>مبلغ نهایی قابل پرداخت</span>',
        "<span>{isDepositPath ? 'مبلغ بیعانه قابل پرداخت' : 'مبلغ نهایی قابل پرداخت'}</span>",
        1,
    )

    old_hint = 'مبلغ نهایی همین است؛ هزینه پنهان، مالیات جدا یا کارمزد اضافه در درگاه ندارید.'
    new_hint = (
        "{isDepositPath"
        " ? 'الان فقط بیعانه پرداخت می‌شود؛ زمان نوبت قطعی است و مانده پس از بررسی توافق می‌شود.'"
        " : 'مبلغ نهایی همین است؛ هزینه پنهان، مالیات جدا یا کارمزد اضافه در درگاه ندارید.'}"
    )
    if old_hint in t:
        t = t.replace(old_hint, new_hint, 1)

    path.write_text(t)
    print('wizard patched', path.stat().st_size)


if __name__ == '__main__':
    patch_booking_page()
    patch_wizard()
