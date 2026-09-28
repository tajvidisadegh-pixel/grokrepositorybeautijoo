#!/usr/bin/env python3
from pathlib import Path

METHODS = '''
  async getNavBadges() {
    const [
      professionals,
      bookings,
      reviews,
      support,
      media,
    ] = await Promise.all([
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.pending_review },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.pending },
      }),
      this.prisma.review.count({
        where: { isPublished: false },
      }),
      this.prisma.supportTicket.count({
        where: { status: 'open' },
      }),
      this.prisma.mediaAsset.count({
        where: { status: MediaStatus.draft },
      }),
    ]);

    return {
      professionals,
      bookings,
      reviews,
      support,
      media,
      notifications: 0,
    };
  }
'''

ENDPOINTS = '''
  @RequirePermissions('admin.dashboard.read')
  @Get('nav-badges')
  @ApiOperation({ summary: 'Counts for admin sidebar badges' })
  navBadges() {
    return this.service.getNavBadges();
  }
'''

def main() -> None:
    svc = Path('backend/src/admin/admin.service.ts')
    s = svc.read_text()
    if 'getNavBadges' not in s:
        idx = s.rfind('\n}')
        svc.write_text(s[:idx] + METHODS + s[idx:])
        print('service patched')
    else:
        print('service ok')

    # ensure enums imported in service if needed
    s2 = svc.read_text()
    if 'ProfessionalStatus' not in s2[:800]:
        # check imports block
        if 'from \'@prisma/client\'' in s2 or 'from "@prisma/client"' in s2:
            print('prisma import present')
        else:
            print('WARN: check prisma imports in service')

    ctrl = Path('backend/src/admin/admin.controller.ts')
    c = ctrl.read_text()
    if "nav-badges" not in c:
        idx = c.rfind('\n}')
        ctrl.write_text(c[:idx] + ENDPOINTS + c[idx:])
        print('controller patched')
    else:
        print('controller ok')


if __name__ == '__main__':
    main()
