#!/usr/bin/env python3
from pathlib import Path
ctrl = Path("backend/src/admin/admin.controller.ts")
ct = ctrl.read_text()
if "failed-alert/threshold" in ct:
    print("already done")
else:
    needle = """  @Get('finance/failed-alert')
  failedAlert() {
    return this.service.getFailedTransactionsAlert();
  }"""
    insert = needle + """

  @Post('finance/settings/commission')
  setCommissionPost(@Body() dto: CommissionDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateCommissionSetting(dto.rate, actorId);
  }

  @Post('finance/failed-alert/threshold')
  setFailedThreshold(@Body() body: { threshold?: number }, @CurrentUser('id') actorId?: string) {
    return this.service.setFailedTransactionsThreshold(Number(body?.threshold ?? 0), actorId);
  }"""
    if needle not in ct:
        print("needle missing")
    else:
        ct = ct.replace(needle, insert, 1)
        ctrl.write_text(ct)
        print("controller patched")

fin = Path("frontend/src/app/admin/finance/page.tsx")
ft = fin.read_text()
ft2 = ft.replace(
    "{summary.transactions.paid} / {summary.transactions.failed}",
    "{summary.transactions?.paid ?? 0} / {summary.transactions?.failed ?? 0}",
)
ft2 = ft2.replace(
    "formatPrice(summary.platformCommission)",
    "formatPrice(summary.platformCommission ?? 0)",
)
ft2 = ft2.replace(
    "formatPrice(summary.professionalNet)",
    "formatPrice(summary.professionalNet ?? 0)",
)
fin.write_text(ft2)
print("frontend patched", ft != ft2)
