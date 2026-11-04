#!/usr/bin/env python3
"""#74 — each service line priced/duration independently then summed."""
from pathlib import Path


def patch_backend() -> None:
    path = Path('backend/src/bookings/bookings.service.ts')
    t = path.read_text()

    old = '''    if (proServices.length !== data.serviceIds.length) {
      throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
    }

    const requestedAddOnIds = Array.from(new Set(data.addOnIds || []));
    const addOnById = new Map(
      proServices.flatMap((ps) => ps.addOns.map((a) => [a.id, { ...a, professionalServiceId: ps.id }] as const)),
    );
    for (const id of requestedAddOnIds) {
      if (!addOnById.has(id)) {
        throw new BadRequestException('یکی از افزودنی‌های انتخاب‌شده معتبر یا فعال نیست');
      }
    }

    const primary = proServices[0];
    let priceRuleId: string | null = null;
    let durationRuleId: string | null = null;
    if (data.priceRuleId) {
      const rule = primary.priceRules.find((r) => r.id === data.priceRuleId);
      if (!rule) throw new BadRequestException('قانون قیمت انتخاب‌شده معتبر نیست');
      priceRuleId = rule.id;
    }
    if (data.durationRuleId) {
      const rule = primary.durationRules.find((r) => r.id === data.durationRuleId);
      if (!rule) throw new BadRequestException('قانون زمان انتخاب‌شده معتبر نیست');
      durationRuleId = rule.id;
    }

    const lines = proServices.map((ps) => {
      let price = ps.price;
      let durationMin = ps.durationMin;
      if (priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === priceRuleId);
        if (rule) price = rule.price;
      }
      if (durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === durationRuleId);
        if (rule) durationMin = rule.durationMin;
      }
'''

    new = '''    if (proServices.length !== data.serviceIds.length) {
      throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
    }

    // #74 — preserve request order (not DB order)
    const byServiceId = new Map(proServices.map((ps) => [ps.serviceId, ps]));
    const orderedServices = data.serviceIds.map((sid) => {
      const ps = byServiceId.get(sid);
      if (!ps) throw new BadRequestException('یکی از خدمات برای این زیباگر فعال نیست');
      return ps;
    });

    const requestedAddOnIds = Array.from(new Set(data.addOnIds || []));
    const addOnById = new Map(
      orderedServices.flatMap((ps) =>
        ps.addOns.map((a) => [a.id, { ...a, professionalServiceId: ps.id }] as const),
      ),
    );
    for (const id of requestedAddOnIds) {
      if (!addOnById.has(id)) {
        throw new BadRequestException('یکی از افزودنی‌های انتخاب‌شده معتبر یا فعال نیست');
      }
    }

    // #74 — rules validated against any selected service; applied only on matching line
    if (data.priceRuleId) {
      const ok = orderedServices.some((ps) => ps.priceRules.some((r) => r.id === data.priceRuleId));
      if (!ok) throw new BadRequestException('قانون قیمت انتخاب‌شده معتبر نیست');
    }
    if (data.durationRuleId) {
      const ok = orderedServices.some((ps) =>
        ps.durationRules.some((r) => r.id === data.durationRuleId),
      );
      if (!ok) throw new BadRequestException('قانون زمان انتخاب‌شده معتبر نیست');
    }

    const lines = orderedServices.map((ps) => {
      let price = ps.price;
      let durationMin = ps.durationMin;
      // Apply price/duration rules only when they belong to THIS service
      let linePriceRuleId: string | null = null;
      let lineDurationRuleId: string | null = null;
      if (data.priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === data.priceRuleId);
        if (rule) {
          price = rule.price;
          linePriceRuleId = rule.id;
        }
      }
      if (data.durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === data.durationRuleId);
        if (rule) {
          durationMin = rule.durationMin;
          lineDurationRuleId = rule.id;
        }
      }
'''

    if old not in t:
        raise SystemExit('backend pricing block not found')
    t = t.replace(old, new, 1)

    # Fix line snapshot to use per-line rule ids
    t = t.replace(
        '''        addOnsSnapshot: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        priceRuleId,
        durationRuleId,
        pricingMode: mode,
''',
        '''        addOnsSnapshot: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        priceRuleId: linePriceRuleId,
        durationRuleId: lineDurationRuleId,
        pricingMode: mode,
''',
        1,
    )

    path.write_text(t)
    print('backend ok', path.stat().st_size)


def patch_frontend() -> None:
    path = Path('frontend/src/components/booking/booking-wizard.tsx')
    t = path.read_text()

    # Multi-select state alongside single (compat)
    if 'selectedServiceIds' in t:
        print('frontend already multi')
        return

    t = t.replace(
        "  const [serviceId, setServiceId] = useState(initialServiceId || '');\n",
        "  const [serviceId, setServiceId] = useState(initialServiceId || '');\n"
        "  /** #74 multi-service selection (includes focused serviceId) */\n"
        "  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(\n"
        "    initialServiceId ? [initialServiceId] : [],\n"
        "  );\n",
        1,
    )

    # selectedServices list
    if 'const selectedServices = useMemo' not in t:
        t = t.replace(
            '''  const selected = useMemo(
    () => services.find((s) => s.serviceId === serviceId) || null,
    [services, serviceId],
  );
''',
            '''  const selected = useMemo(
    () => services.find((s) => s.serviceId === serviceId) || null,
    [services, serviceId],
  );

  const selectedServices = useMemo(() => {
    const ids = selectedServiceIds.length
      ? selectedServiceIds
      : serviceId
        ? [serviceId]
        : [];
    return ids
      .map((id) => services.find((s) => s.serviceId === id))
      .filter((s): s is ServiceOption => !!s);
  }, [services, selectedServiceIds, serviceId]);
''',
            1,
        )

    # Totals: when multi, sum bases; when single keep detailed calc
    # Replace totalDuration / displayPrice usage path carefully

    # Add multi totals after displayPriceRaw block
    if 'multiServiceTotals' not in t:
        needle = '  const serviceDuration = baseDuration + optionExtras.duration + addOnExtraDuration;'
        insert = '''  const serviceDuration = baseDuration + optionExtras.duration + addOnExtraDuration;

  // #74 — multi-service: each line independent, then sum (base or cheapest rule)
  const multiServiceTotals = useMemo(() => {
    if (selectedServices.length <= 1) {
      return null;
    }
    let price = 0;
    let duration = 0;
    const lines = selectedServices.map((s) => {
      const rules = [...(s.priceRules || [])].sort((a, b) => a.price - b.price);
      const linePrice = rules.length ? rules[0]!.price : s.price;
      const lineDur = s.durationMin + (s.bufferMin || 0);
      price += linePrice;
      duration += lineDur;
      return { serviceId: s.serviceId, name: s.name, price: linePrice, durationMin: lineDur };
    });
    return { price, duration, lines };
  }, [selectedServices]);
'''
        if needle not in t:
            raise SystemExit('serviceDuration needle missing')
        t = t.replace(needle, insert, 1)

    # submit with all service ids
    t = t.replace(
        '        serviceIds: [selected.serviceId],',
        '        serviceIds: selectedServices.length\n'
        '          ? selectedServices.map((s) => s.serviceId)\n'
        '          : [selected.serviceId],',
        1,
    )

    # Only send priceRule/duration/addOn/options when single service
    # (keep existing fields; backend ignores rules on non-matching lines)

    # Toggle multi on service list buttons
    old_btn = '''                  onClick={() => {
                    setServiceId(s.serviceId);
                    trackFunnel('service_select', { serviceId: s.serviceId, pro: professional.id });
                    if (!(s.priceRules || []).length) setStep('datetime');
                  }}
'''
    new_btn = '''                  onClick={() => {
                    setServiceId(s.serviceId);
                    setSelectedServiceIds((prev) => {
                      if (prev.includes(s.serviceId)) {
                        // keep at least one selection when tapping focused
                        if (prev.length === 1) return prev;
                        return prev.filter((id) => id !== s.serviceId);
                      }
                      return [...prev, s.serviceId];
                    });
                    trackFunnel('service_select', { serviceId: s.serviceId, pro: professional.id });
                  }}
'''
    if old_btn in t:
        t = t.replace(old_btn, new_btn, 1)
        print('service toggle multi')

    # Highlight if in selectedServiceIds
    t = t.replace(
        '''                    serviceId === s.serviceId
                      ? 'border-coral bg-coral-soft'
                      : 'border-border hover:border-coral-light'
''',
        '''                    selectedServiceIds.includes(s.serviceId) || serviceId === s.serviceId
                      ? 'border-coral bg-coral-soft'
                      : 'border-border hover:border-coral-light'
''',
        1,
    )

    # Helper text under service list
    if 'چند خدمت' not in t:
        t = t.replace(
            '          <ul className="space-y-2">\n            {services.map((s) => (',
            '          <p className="text-xs text-gray">برای رزرو چندخدمت، چند مورد را انتخاب کنید؛ قیمت و مدت هر کدام جدا جمع می‌شود.</p>\n'
            '          <ul className="space-y-2">\n            {services.map((s) => (',
            1,
        )

    # Summary breakdown
    if 'تفکیک خدمات' not in t and 'multiServiceTotals' in t:
        # inject near summary service row
        mark = '<dt className="text-gray">خدمت</dt>'
        if mark in t:
            t = t.replace(
                mark,
                '''{multiServiceTotals && multiServiceTotals.lines.length > 1 ? (
                <>
                  <dt className="text-gray">تفکیک خدمات</dt>
                  <dd className="font-medium">
                    <ul className="space-y-1 text-sm">
                      {multiServiceTotals.lines.map((l) => (
                        <li key={l.serviceId} className="flex justify-between gap-2">
                          <span>{l.name}</span>
                          <span className="text-gray" dir="ltr">
                            {l.durationMin}m · {l.price.toLocaleString('fa-IR')}
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-between gap-2 border-t border-border pt-1 font-bold">
                        <span>جمع</span>
                        <span>
                          {multiServiceTotals.duration} دقیقه ·{' '}
                          {multiServiceTotals.price.toLocaleString('fa-IR')} تومان
                        </span>
                      </li>
                    </ul>
                  </dd>
                </>
              ) : null}
              <dt className="text-gray">خدمت</dt>''',
                1,
            )

    # goDatetime disabled when none selected
    t = t.replace(
        'disabled={!serviceId}',
        'disabled={!serviceId && selectedServiceIds.length === 0}',
        1,
    )

    # Sync selectedServiceIds when serviceId set from quick book
    t = t.replace(
        '''                setServiceId(s.serviceId);
                trackFunnel('service_select', { serviceId: s.serviceId, pro: professional.id, quick: 1 });
''',
        '''                setServiceId(s.serviceId);
                setSelectedServiceIds([s.serviceId]);
                trackFunnel('service_select', { serviceId: s.serviceId, pro: professional.id, quick: 1 });
''',
        1,
    )

    path.write_text(t)
    print('frontend ok', path.stat().st_size)


if __name__ == '__main__':
    patch_backend()
    patch_frontend()
