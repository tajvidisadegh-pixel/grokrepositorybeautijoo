from pathlib import Path

# patch backend for issue 83 remaining items
p = Path("backend/src/bookings/bookings.service.ts")
t = p.read_text()
bad = "throw new BadRequestException('استرداد پرداخت ناموفق بود. رزرو لغو نشد؛ لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید.');"
good = "return this.prisma.booking.update({ where: { id }, data: { status: BookingStatus.cancelled, cancelReason: reason ?? null, cancelledAt: new Date() } });"
if bad in t:
    t = t.replace(bad, good, 1)
    print("soft-refund")

if "supportTicket.create" not in t and "async reportIssue" in t:
    old = "    try {\n      await this.prisma.auditLog.create({\n        data: {\n          actorId: userId,\n          action: 'booking.report_issue',"
    new = """    try {
      const subject = ('report booking #' + id.slice(0, 8)).slice(0, 120);
      const body = (message?.trim() || 'empty') + '\\n\\nbookingId=' + id;
      await this.prisma.supportTicket.create({
        data: {
          userId,
          subject,
          status: 'open',
          messages: { create: { body: body.slice(0, 2000), isStaff: false, senderId: userId } },
        },
      });
    } catch (err) {
      this.logger.warn(`reportIssue supportTicket failed booking=${id}: ${(err as Error)?.message || err}`);
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'booking.report_issue',"""
    if old in t:
        t = t.replace(old, new, 1)
        print("ticket")
    else:
        print("ticket needle missing")
p.write_text(t)

c = Path("backend/src/professionals/professionals.controller.ts")
ct = c.read_text()
if "@Query('maxDuration') maxDuration" not in ct:
    ct = ct.replace(
        "@Query('minDuration') minDuration?: string,\n    @Query('sort') sort?: string,",
        "@Query('minDuration') minDuration?: string,\n    @Query('maxDuration') maxDuration?: string,\n    @Query('availableToday') availableToday?: string,\n    @Query('availableTomorrow') availableTomorrow?: string,\n    @Query('sort') sort?: string,",
    )
    ct = ct.replace(
        "minDuration: minDuration != null && minDuration !== '' ? parseInt(minDuration, 10) : undefined,\n      sort,",
        "minDuration: minDuration != null && minDuration !== '' ? parseInt(minDuration, 10) : undefined,\n      maxDuration: maxDuration != null && maxDuration !== '' ? parseInt(maxDuration, 10) : undefined,\n      availableToday: availableToday === '1' || availableToday === 'true',\n      availableTomorrow: availableTomorrow === '1' || availableTomorrow === 'true',\n      sort,",
    )
    c.write_text(ct)
    print("controller")

s = Path("backend/src/professionals/professionals.service.ts")
st = s.read_text()
if "availableToday?:" not in st:
    st = st.replace(
        "availableDate?: string;\n    ids?: string[];",
        "availableDate?: string;\n    availableToday?: boolean;\n    availableTomorrow?: boolean;\n    ids?: string[];",
    )
    marker = "const skip = (page - 1) * limit;"
    inject = marker + """
    if (!params.availableDate && (params.availableToday || params.availableTomorrow)) {
      const now = new Date();
      const tehranMs = now.getTime() + 3.5 * 3600_000;
      const base = new Date(tehranMs);
      if (params.availableTomorrow) base.setUTCDate(base.getUTCDate() + 1);
      const y = base.getUTCFullYear();
      const m = String(base.getUTCMonth() + 1).padStart(2, '0');
      const d = String(base.getUTCDate()).padStart(2, '0');
      params.availableDate = y + '-' + m + '-' + d;
    }"""
    if marker in st:
        st = st.replace(marker, inject, 1)
        print("availableToday map")
    s.write_text(st)
print("done backend")
