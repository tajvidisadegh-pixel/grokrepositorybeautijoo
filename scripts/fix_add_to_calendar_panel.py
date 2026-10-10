from pathlib import Path
p = Path('frontend/src/app/panel/bookings/page.tsx')
t = p.read_text(encoding='utf-8')
if '<AddToCalendarActions' in t:
    print('already')
else:
    old = ''') : null}
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-xs text-gray-muted hover:text-coral"
                          onClick={() => {
                            setReportFor(reportFor === b.id ? null : b.id);
                            setReportText('');
                          }}
                        >
                          گزارش مشکل'''
    new = ''') : null}
                      <div className="mt-2 w-full max-w-[240px]">
                        <AddToCalendarActions
                          booking={{
                            id: b.id,
                            startAt: b.startAt,
                            endAt: b.endAt,
                            totalPrice: b.totalPrice,
                            status: b.status,
                          }}
                          proName={
                            (b.professional as { user?: { profile?: { displayName?: string } }; title?: string } | undefined)
                              ?.user?.profile?.displayName ||
                            (b.professional as { title?: string } | undefined)?.title ||
                            'زیباگر'
                          }
                        />
                      </div>
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-xs text-gray-muted hover:text-coral"
                          onClick={() => {
                            setReportFor(reportFor === b.id ? null : b.id);
                            setReportText('');
                          }}
                        >
                          گزارش مشکل'''
    if old not in t:
        raise SystemExit('anchor not found')
    p.write_text(t.replace(old, new, 1), encoding='utf-8')
    print('ok')
