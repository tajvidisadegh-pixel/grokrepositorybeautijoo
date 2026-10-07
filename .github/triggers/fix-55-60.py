# -*- coding: utf-8 -*-
from pathlib import Path

svc = Path('frontend/src/app/zibagar/services/page.tsx')
t = svc.read_text(encoding='utf-8')

# Load pins in load()
if 'pinned-services' not in t:
    old = '''      setMine(services || []);
      const ids = (pro?.selectedCategoryIds as string[] | null) || [];'''
    new = '''      setMine(services || []);
      try {
        const pinned = await apiClient.get<{ pinnedServiceIds?: string[] }>('/professionals/me/pinned-services');
        setPinnedIds(Array.isArray(pinned?.pinnedServiceIds) ? pinned.pinnedServiceIds : []);
      } catch {
        /* ignore */
      }
      const ids = (pro?.selectedCategoryIds as string[] | null) || [];'''
    if old in t:
        t = t.replace(old, new, 1)
        print('load pins ok')
    else:
        print('load pins anchor missing')

# Pin button next to rename
if 'togglePin(ps.id)' not in t:
    needle = '''<button type="button" className="text-[10px] text-gray-400 hover:text-[#2D6CDF]" onClick={() => { setEditingNamePsId(ps.id); setEditNameValue(serviceLabel(ps)); setEditingSubKey(null); }}>ویرایش نام</button>'''
    insert = '''<button type="button" className="text-[10px] text-gray-400 hover:text-[#2D6CDF]" onClick={() => { setEditingNamePsId(ps.id); setEditNameValue(serviceLabel(ps)); setEditingSubKey(null); }}>ویرایش نام</button>
                                <button type="button" className={`text-[10px] ${pinnedIds.includes(ps.id) ? 'font-semibold text-coral' : 'text-gray-400 hover:text-coral'}`} onClick={() => void togglePin(ps.id)} title="پین در صفحه عمومی (حداکثر ۳)">{pinnedIds.includes(ps.id) ? 'پین شده' : 'پین'}</button>'''
    if needle in t:
        t = t.replace(needle, insert, 1)
        print('pin button ok')
    else:
        print('pin button needle missing')

svc.write_text(t, encoding='utf-8')

# zibagar bookings: add date preset UI if state exists but no UI
zb = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = zb.read_text(encoding='utf-8')
if "datePreset" in t and 'aria-label="فیلتر تاریخ"' not in t:
    # insert after status filters if any, or after h1
    if 'aria-label="فیلتر وضعیت"' in t:
        ui = '''
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
        t = t.replace(
            '<div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">',
            ui + '\n      <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">',
            1,
        )
        zb.write_text(t, encoding='utf-8')
        print('zibagar date UI')
    else:
        print('zibagar status filter missing')
else:
    print('zibagar date already or no state')

print('done wire')
