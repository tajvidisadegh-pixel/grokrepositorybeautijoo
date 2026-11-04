#!/usr/bin/env python3
"""#80.5 — booking create: variable options + deposit pricing."""
from pathlib import Path

def patch_controller() -> None:
    path = Path('backend/src/bookings/bookings.controller.ts')
    t = path.read_text()
    if 'selectedOptionIds' in t:
        print('controller already patched')
        return
    if 'class CreateBookingDto' not in t:
        raise SystemExit('CreateBookingDto missing')
    if 'durationRuleId' in t and 'selectedOptionIds' not in t:
        t = t.replace(
            "@IsOptional() @IsUUID() durationRuleId?: string;\n}",
            "@IsOptional() @IsUUID() durationRuleId?: string;\n"
            "  /** Catalog attribute option ids for variable pricing (#80) */\n"
            "  @IsOptional() @IsArray() @IsUUID('4', { each: true }) selectedOptionIds?: string[];\n"
            "}",
            1,
        )
    elif 'priceRuleId' in t and 'selectedOptionIds' not in t:
        t = t.replace(
            "@IsOptional() @IsUUID() priceRuleId?: string;\n}",
            "@IsOptional() @IsUUID() priceRuleId?: string;\n"
            "  @IsOptional() @IsArray() @IsUUID('4', { each: true }) selectedOptionIds?: string[];\n"
            "}",
            1,
        )
    else:
        lines = t.splitlines(keepends=True)
        out = []
        in_dto = False
        done = False
        for line in lines:
            if 'class CreateBookingDto' in line:
                in_dto = True
            if in_dto and not done and line.strip() == '}' and 'selectedOptionIds' not in ''.join(out):
                out.append("  @IsOptional() @IsArray() @IsUUID('4', { each: true }) selectedOptionIds?: string[];\n")
                done = True
                in_dto = False
            out.append(line)
        t = ''.join(out)
        if 'selectedOptionIds' not in t:
            raise SystemExit('failed to insert selectedOptionIds')

    path.write_text(t)
    print('controller patched', path.stat().st_size)


def patch_service() -> None:
    path = Path('backend/src/bookings/bookings.service.ts')
    t = path.read_text()
    if 'computeVariableTotals' in t and 'selectedOptionIds' in t:
        print('service already patched')
        return

    if "from '../services/pricing-mode'" not in t:
        if "from '@prisma/client'" in t:
            t = t.replace(
                "from '@prisma/client';",
                "from '@prisma/client';\nimport {\n  computeVariableTotals,\n  normalizePricingMode,\n  resolveOptionDeltas,\n  type PricingMode,\n} from '../services/pricing-mode';",
                1,
            )
        else:
            raise SystemExit('prisma import missing')

    old_sig = """  async create(
    customerId: string,
    data: {
      professionalId: string;
      serviceIds: string[];
      startAt: string;
      locationId?: string;
      notes?: string;
      addOnIds?: string[];
      priceRuleId?: string;
      durationRuleId?: string;
    },
  ) {"""
    new_sig = """  async create(
    customerId: string,
    data: {
      professionalId: string;
      serviceIds: string[];
      startAt: string;
      locationId?: string;
      notes?: string;
      addOnIds?: string[];
      priceRuleId?: string;
      durationRuleId?: string;
      selectedOptionIds?: string[];
    },
  ) {"""
    if old_sig not in t:
        raise SystemExit('create signature missing')
    t = t.replace(old_sig, new_sig, 1)

    old_inc = """      include: {
        addOns: { where: { isActive: true } },
        priceRules: { where: { isActive: true } },
        durationRules: { where: { isActive: true } },
      },"""
    new_inc = """      include: {
        addOns: { where: { isActive: true } },
        priceRules: { where: { isActive: true } },
        durationRules: { where: { isActive: true } },
        service: {
          include: {
            attributeGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },"""
    if old_inc not in t:
        raise SystemExit('proServices include missing')
    t = t.replace(old_inc, new_inc, 1)

    inject_after = """      let price = ps.price;
      let durationMin = ps.durationMin;
      if (priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === priceRuleId);
        if (rule) price = rule.price;
      }
      if (durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === durationRuleId);
        if (rule) durationMin = rule.durationMin;
      }"""

    inject = """      let price = ps.price;
      let durationMin = ps.durationMin;
      if (priceRuleId) {
        const rule = ps.priceRules.find((r) => r.id === priceRuleId);
        if (rule) price = rule.price;
      }
      if (durationRuleId) {
        const rule = ps.durationRules.find((r) => r.id === durationRuleId);
        if (rule) durationMin = rule.durationMin;
      }

      const mode: PricingMode = normalizePricingMode(ps.pricingMode || 'fixed');
      let isDeposit = false;
      let selectedOptionsSnapshot: Array<{
        optionId: string;
        groupId: string;
        label: string;
        priceDelta: number;
        durationDeltaMin: number;
      }> = [];

      if (mode === 'variable') {
        const groups = ps.service?.attributeGroups || [];
        const selectedIds = new Set(data.selectedOptionIds || []);
        const deltas: Array<{ priceDelta: number; durationDeltaMin: number }> = [];
        for (const g of groups) {
          const opts = g.options || [];
          const picked = opts.filter((o) => selectedIds.has(o.id));
          if (g.required && picked.length === 0) {
            throw new BadRequestException(`انتخاب «${g.name}» الزامی است`);
          }
          for (const o of picked) {
            const resolved = resolveOptionDeltas(
              o.id,
              {
                priceDelta: o.suggestedPriceDelta ?? 0,
                durationDeltaMin: o.suggestedDurationDeltaMin ?? 0,
              },
              (ps.optionDeltas as Record<string, { priceDelta?: number; durationDeltaMin?: number; active?: boolean }> | null) ||
                null,
            );
            if (!resolved.active) continue;
            deltas.push(resolved);
            selectedOptionsSnapshot.push({
              optionId: o.id,
              groupId: g.id,
              label: o.label,
              priceDelta: resolved.priceDelta,
              durationDeltaMin: resolved.durationDeltaMin,
            });
          }
        }
        const totals = computeVariableTotals(price, durationMin, deltas);
        price = totals.price;
        durationMin = totals.durationMin;
      } else if (mode === 'deposit') {
        const dep = ps.depositAmount;
        if (dep == null || dep < 0) {
          throw new BadRequestException('مبلغ بیعانه برای این خدمت تنظیم نشده است');
        }
        price = dep;
        isDeposit = true;
      }"""

    if inject_after not in t:
        raise SystemExit('inject point missing')
    t = t.replace(inject_after, inject, 1)

    old_ret = """      return {
        serviceId: ps.serviceId,
        professionalServiceId: ps.id,
        durationMin: durationMin + addOnDur,
        price: price + addOnPrice,
        addOnsSnapshot: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        priceRuleId,
        durationRuleId,
      };"""
    new_ret = """      return {
        serviceId: ps.serviceId,
        professionalServiceId: ps.id,
        durationMin: durationMin + addOnDur,
        price: price + addOnPrice,
        addOnsSnapshot: addOns.map((a) => ({ id: a.id, name: a.name, price: a.price })),
        priceRuleId,
        durationRuleId,
        pricingMode: mode,
        isDeposit,
        selectedOptions: selectedOptionsSnapshot.length
          ? selectedOptionsSnapshot
          : null,
      };"""
    if old_ret not in t:
        raise SystemExit('return object missing')
    t = t.replace(old_ret, new_ret, 1)

    old_item = """                create: lines.map((line, i) => ({
                  serviceId: line.serviceId,
                  professionalServiceId: line.professionalServiceId,
                  durationMin: line.durationMin,
                  price: line.price,
                  addOnsSnapshot: line.addOnsSnapshot as unknown as Prisma.InputJsonValue,
                  priceRuleId: line.priceRuleId,
                  durationRuleId: line.durationRuleId,
                  sortOrder: i,
                })),"""
    new_item = """                create: lines.map((line, i) => ({
                  serviceId: line.serviceId,
                  professionalServiceId: line.professionalServiceId,
                  durationMin: line.durationMin,
                  price: line.price,
                  addOnsSnapshot: line.addOnsSnapshot as unknown as Prisma.InputJsonValue,
                  priceRuleId: line.priceRuleId,
                  durationRuleId: line.durationRuleId,
                  pricingMode: line.pricingMode,
                  isDeposit: line.isDeposit,
                  selectedOptions: line.selectedOptions
                    ? (line.selectedOptions as unknown as Prisma.InputJsonValue)
                    : undefined,
                  sortOrder: i,
                })),"""
    if old_item not in t:
        raise SystemExit('items create missing')
    t = t.replace(old_item, new_item, 1)

    path.write_text(t)
    print('service patched', path.stat().st_size)


if __name__ == '__main__':
    patch_controller()
    patch_service()
