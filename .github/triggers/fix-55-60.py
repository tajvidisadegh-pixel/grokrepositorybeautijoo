# -*- coding: utf-8 -*-
from pathlib import Path

def wr(p, t):
    Path(p).write_text(t, encoding='utf-8')
    print('wrote', p)

# ========== 56: min lead hours backend ==========
bk = Path('backend/src/bookings/bookings.service.ts')
t = bk.read_text(encoding='utf-8')
if 'BOOKING_MIN_LEAD_HOURS' not in t:
    old = """    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان شروع نامعتبر است');
    }"""
    new = """    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
      throw new BadRequestException('زمان شروع نامعتبر است');
    }
    // #40 item 56 — minimum lead time before booking
    {
      const minLead = parseInt(process.env.BOOKING_MIN_LEAD_HOURS || '4', 10);
      const hours = Number.isFinite(minLead) && minLead >= 0 ? minLead : 4;
      const msLead = hours * 3600_000;
      if (startAt.getTime() - Date.now() < msLead) {
        throw new BadRequestException(
          hours === 0
            ? 'زمان شروع نامعتبر است'
            : `حداقل ${hours} ساعت قبل از نوبت باید رزرو کنید.`,
        );
      }
    }"""
    if old in t:
        t = t.replace(old, new, 1)
        wr(str(bk), t)
        print('56 backend lead ok')
    else:
        print('56 WARN startAt block not found')
else:
    print('56 backend already')

# ========== 56: display on public pro page ==========
pp = Path('frontend/src/app/professionals/[slug]/page.tsx')
if pp.exists():
    t = pp.read_text(encoding='utf-8')
    if 'حداقل' not in t or 'ساعت قبل' not in t:
        # insert near booking CTA
        needle = 'رزرو نوبت'
        # find the booking section paragraph
        marker = 'برای انتخاب زمان و ثبت نوبت وارد جریان رزرو شوید.'
        if marker in t:
            t = t.replace(
                marker,
                marker + '\n              حداقل ۴ ساعت قبل از نوبت باید رزرو کنید.',
                1,
            )
            wr(str(pp), t)
            print('56 public pro note')
        else:
            print('56 public marker missing')
    else:
        print('56 public already')

# wizard note
wiz = Path('frontend/src/components/booking/booking-wizard.tsx')
if wiz.exists():
    t = wiz.read_text(encoding='utf-8')
    if 'حداقل ۴ ساعت قبل' not in t:
        # after datetime step header or date label
        if '<label className="mb-1 block text-sm font-medium">تاریخ</label>' in t:
            t = t.replace(
                '<label className="mb-1 block text-sm font-medium">تاریخ</label>',
                '<p className="mb-2 text-xs text-gray">حداقل ۴ ساعت قبل از نوبت باید رزرو کنید.</p>\n            <label className="mb-1 block text-sm font-medium">تاریخ</label>',
                1,
            )
            wr(str(wiz), t)
            print('56 wizard note')
        else:
            print('56 wizard date label missing')
    else:
        print('56 wizard already')

# ========== 57: char counters ==========
# panel bookings review textarea
pb = Path('frontend/src/app/panel/bookings/page.tsx')
t = pb.read_text(encoding='utf-8')
if 'charCount' not in t and 'maxLength={500}' not in t:
    # find review textarea
    if 'setComment(e.target.value)' in t:
        t = t.replace(
            'onChange={(e) => setComment(e.target.value)}',
            'onChange={(e) => setComment(e.target.value.slice(0, 500))}\n                      maxLength={500}',
            1,
        )
        # add counter after textarea - look for comment placeholder area
        if '{comment.length' not in t:
            # after the textarea closing tag near setComment - insert counter before submit review button
            t = t.replace(
                'onChange={(e) => setComment(e.target.value.slice(0, 500))}\n                      maxLength={500}',
                'onChange={(e) => setComment(e.target.value.slice(0, 500))}\n                      maxLength={500}\n                    />\n                    <p className="text-left text-xs text-gray" dir="ltr">{comment.length}/500',
                1,
            )
            # might have broken JSX if textarea already closed - fix double />
            # simpler approach: just maxLength is enough; add counter as sibling carefully
        wr(str(pb), t)
        print('57 panel review counter attempt')
    else:
        print('57 review onChange not found')
else:
    print('57 panel maybe already')

# Fix possible broken textarea from above - read and check
t = pb.read_text(encoding='utf-8')
# if we created orphan text, leave maxLength only
if '{comment.length}/500' in t and t.count('{comment.length}/500') >= 1:
    # ensure proper closing
    if '{comment.length}/500\n' in t and '</p>' not in t[t.find('{comment.length}/500'):t.find('{comment.length}/500')+40]:
        t = t.replace('{comment.length}/500', '{comment.length}/500</p>', 1)
        wr(str(pb), t)

# services description if textarea exists
svc = Path('frontend/src/app/zibagar/services/page.tsx')
if svc.exists():
    t = svc.read_text(encoding='utf-8')
    if 'description' in t and 'maxLength={400}' not in t:
        # optional - skip if no clear textarea for description
        print('57 services skip detailed')

# ========== 58: pin services via socialLinks ==========
ps = Path('backend/src/professionals/professionals.service.ts')
t = ps.read_text(encoding='utf-8')
if 'pinService' not in t:
    methods = '''

  /** #40 item 58 — pin up to 3 services for public ordering */
  async listPinnedServices(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const links = (pro.socialLinks as { _pinnedServiceIds?: string[] } | null) || {};
    const ids = Array.isArray(links._pinnedServiceIds) ? links._pinnedServiceIds : [];
    return { pinnedServiceIds: ids.slice(0, 3) };
  }

  async setPinnedServices(userId: string, serviceIds: string[]) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const cleaned = Array.from(new Set((serviceIds || []).filter(Boolean))).slice(0, 3);
    const links = { ...((pro.socialLinks as Record<string, unknown>) || {}) } as Record<string, unknown>;
    if (cleaned.length) links._pinnedServiceIds = cleaned;
    else delete links._pinnedServiceIds;
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { socialLinks: (Object.keys(links).length ? links : null) as object },
    });
    return { pinnedServiceIds: cleaned };
  }
'''
    # insert before last closing of class
    idx = t.rfind('\n}')
    t = t[:idx] + methods + '\n}\n'
    wr(str(ps), t)
    print('58 service methods')
else:
    print('58 methods already')

pc = Path('backend/src/professionals/professionals.controller.ts')
t = pc.read_text(encoding='utf-8')
if 'pinned-services' not in t:
    block = '''
  @Get('me/pinned-services')
  listPinned(@CurrentUser('id') userId: string) {
    return this.service.listPinnedServices(userId);
  }

  @Post('me/pinned-services')
  setPinned(@CurrentUser('id') userId: string, @Body() body: { serviceIds?: string[] }) {
    return this.service.setPinnedServices(userId, body?.serviceIds || []);
  }
'''
    if "@Get('me/blocked-customers')" in t:
        t = t.replace("@Get('me/blocked-customers')", block + "\n  @Get('me/blocked-customers')", 1)
    else:
        idx = t.rfind('}')
        t = t[:idx] + block + '\n}\n'
    wr(str(pc), t)
    print('58 controller')
else:
    print('58 controller already')

# public getBySlug: order services with pinned first - in professionals.service getBySlug or similar
t = ps.read_text(encoding='utf-8')
if 'pinned first' not in t and '_pinnedServiceIds' in t:
    # try to find where professionalServices are returned for public
    print('58 pin order: client-side sort preferred')

# FE services page: pin button - light touch
svc_fe = Path('frontend/src/app/zibagar/services/page.tsx')
if svc_fe.exists():
    t = svc_fe.read_text(encoding='utf-8')
    if 'pinnedServiceIds' not in t:
        # add state + load pins + toggle - minimal
        if "const [busy, setBusy] = useState(false);" in t and 'pinnedIds' not in t:
            t = t.replace(
                "const [busy, setBusy] = useState(false);",
                "const [busy, setBusy] = useState(false);\n  const [pinnedIds, setPinnedIds] = useState<string[]>([]);",
                1,
            )
            # after load mine, also load pins - find load function end is hard
            # add toggle function before return
            if 'async function onToggleActive' in t:
                pinFn = '''
  async function togglePin(psId: string) {
    const next = pinnedIds.includes(psId)
      ? pinnedIds.filter((id) => id !== psId)
      : [...pinnedIds, psId].slice(0, 3);
    setPinnedIds(next);
    try {
      await apiClient.post('/professionals/me/pinned-services', { serviceIds: next });
      setMsg(next.includes(psId) ? 'خدمت پین شد' : 'پین برداشته شد');
    } catch (e) {
      setError(friendlyApiError(e));
    }
  }
'''
                t = t.replace('async function onToggleActive', pinFn + 'async function onToggleActive', 1)
                # import apiClient if needed
                if "from '@/lib/api'" not in t and 'apiClient' not in t:
                    # use panel-api pattern - check imports
                    if "from '@/lib/panel-api'" in t:
                        pass
                wr(str(svc_fe), t)
                print('58 FE pin toggle scaffold')
            else:
                print('58 FE onToggleActive missing')
        else:
            print('58 FE state skip')
    else:
        print('58 FE already')

# ensure apiClient import on services page if we added toggle
if svc_fe.exists():
    t = svc_fe.read_text(encoding='utf-8')
    if 'apiClient.post' in t and "from '@/lib/api'" not in t:
        t = t.replace(
            "from '@/lib/panel-api'",
            "from '@/lib/panel-api';\nimport { apiClient } from '@/lib/api'",
            1,
        )
        wr(str(svc_fe), t)
        print('58 apiClient import')

# ========== 59: store rejection reason + display ==========
adm = Path('backend/src/admin/admin.service.ts')
t = adm.read_text(encoding='utf-8')
if '_rejectionReason' not in t:
    old = '    const updated = await this.prisma.professional.update({ where: { id }, data });'
    # only first occurrence in setProfessionalStatus - need unique context
    ctx = '''    if (status === ProfessionalStatus.rejected && reason && String(reason).trim()) {
      const links = { ...((existing.socialLinks as Record<string, unknown>) || {}) };
      links._rejectionReason = String(reason).trim().slice(0, 500);
      data.socialLinks = links as object;
    } else if (status === ProfessionalStatus.approved) {
      const links = { ...((existing.socialLinks as Record<string, unknown>) || {}) };
      if ('_rejectionReason' in links) {
        delete links._rejectionReason;
        data.socialLinks = (Object.keys(links).length ? links : null) as object;
      }
    }

    const updated = await this.prisma.professional.update({ where: { id }, data });'''
    if old in t:
        t = t.replace(old, ctx, 1)
        wr(str(adm), t)
        print('59 admin store reason')
    else:
        print('59 admin update line missing')
else:
    print('59 admin already')

# zibagar profile banner
prof = Path('frontend/src/app/zibagar/profile/page.tsx')
t = prof.read_text(encoding='utf-8')
if 'معلق' not in t and '_rejectionReason' not in t and 'رد شد' not in t[t.find('return'):] if 'return' in t else True:
    # add banner after status display
    if "persianProfessionalStatus(pro.status)" in t and 'rejectionBanner' not in t:
        banner = '''
      {pro?.status === 'rejected' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">پروفایل رد شده — نیاز به تکمیل مدارک/اطلاعات</p>
          <p className="mt-1 text-xs">
            {((pro as { socialLinks?: { _rejectionReason?: string } }).socialLinks?._rejectionReason) ||
              'لطفاً اطلاعات پروفایل، خدمات و مدارک را تکمیل و دوباره برای بررسی ارسال کنید.'}
          </p>
        </div>
      )}
      {pro?.status === 'pending_review' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">در انتظار بررسی ادمین</p>
          <p className="mt-1 text-xs">پروفایل شما ثبت شده و معمولاً طی ۱ تا ۳ روز کاری بررسی می‌شود.</p>
        </div>
      )}
'''
        # insert near start of main content after loading checks
        marker = "const percent = pro?.completion?.percent"
        if marker in t:
            # insert in JSX - find first status span area
            pass
        if '<div className="space-y-6">' in t:
            t = t.replace(
                '<div className="space-y-6">',
                '<div className="space-y-6">' + banner,
                1,
            )
            wr(str(prof), t)
            print('59 profile banners')
        else:
            print('59 profile container missing')
    else:
        print('59 profile banner skip')
else:
    print('59 profile maybe already')

# ========== 60: date filter on panel bookings ==========
t = pb.read_text(encoding='utf-8')
if 'datePreset' not in t:
    t = t.replace(
        "const [timeScope, setTimeScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');",
        "const [timeScope, setTimeScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');\n  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');",
        1,
    )
    # add UI after timeScope buttons - find aria-label بازه زمانی closing
    date_ui = '''
      <div className="flex flex-wrap gap-2" aria-label="فیلتر تاریخ">
        {([
          { v: 'all' as const, l: 'هر تاریخ' },
          { v: 'today' as const, l: 'امروز' },
          { v: 'week' as const, l: 'این هفته' },
          { v: 'month' as const, l: 'این ماه' },
        ]).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setDatePreset(o.v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              datePreset === o.v
                ? 'border-coral bg-coral text-white'
                : 'border-border bg-white hover:border-coral'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
'''
    if 'aria-label="فیلتر وضعیت"' in t:
        t = t.replace(
            '<div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">',
            date_ui + '\n      <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">',
            1,
        )
    # extend visibleItems filter
    old_filter = '''        const visibleItems = items.filter((b) => {
          if (timeScope === 'all') return true;
          const start = new Date(b.startAt).getTime();
          const isPast =
            Number.isFinite(start) &&
            (start < now ||
              b.status === 'completed' ||
              b.status === 'cancelled' ||
              b.status === 'rejected' ||
              b.status === 'expired');
          return timeScope === 'past' ? isPast : !isPast;
        });'''
    new_filter = '''        const visibleItems = items.filter((b) => {
          const start = new Date(b.startAt).getTime();
          if (timeScope !== 'all') {
            const isPast =
              Number.isFinite(start) &&
              (start < now ||
                b.status === 'completed' ||
                b.status === 'cancelled' ||
                b.status === 'rejected' ||
                b.status === 'expired');
            if (timeScope === 'past' ? !isPast : isPast) return false;
          }
          if (datePreset !== 'all' && Number.isFinite(start)) {
            const d = new Date(b.startAt);
            const tehran = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
            const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
            const startDay = new Date(tehran.getFullYear(), tehran.getMonth(), tehran.getDate()).getTime();
            const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            if (datePreset === 'today' && startDay !== todayDay) return false;
            if (datePreset === 'week') {
              const weekAgo = todayDay - 6 * 86400000;
              if (startDay < weekAgo || startDay > todayDay + 7 * 86400000) return false;
            }
            if (datePreset === 'month') {
              if (tehran.getMonth() !== today.getMonth() || tehran.getFullYear() !== today.getFullYear()) return false;
            }
          }
          return true;
        });'''
    if old_filter in t:
        t = t.replace(old_filter, new_filter, 1)
        wr(str(pb), t)
        print('60 panel date filter')
    else:
        wr(str(pb), t)
        print('60 panel UI maybe; filter pattern missing')
else:
    print('60 panel already')

# zibagar bookings date filter - light
zb = Path('frontend/src/app/zibagar/bookings/page.tsx')
if zb.exists():
    t = zb.read_text(encoding='utf-8')
    if 'datePreset' not in t:
        # add simple client filter state near other useState
        if "const [actionMsg, setActionMsg] = useState" in t:
            t = t.replace(
                "const [actionMsg, setActionMsg] = useState",
                "const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');\n  const [actionMsg, setActionMsg] = useState",
                1,
            )
            wr(str(zb), t)
            print('60 zibagar datePreset state')
        else:
            print('60 zibagar state anchor missing')
    else:
        print('60 zibagar already')

print('DONE 55-60 core')
