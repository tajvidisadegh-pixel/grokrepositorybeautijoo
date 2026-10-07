from pathlib import Path
changed = []
p = Path('frontend/src/lib/panel-api.ts')
t = p.read_text(encoding='utf-8')
old = "export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {\n  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);\n}"
new = "export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete' | 'no-show', reason?: string) {\n  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);\n}"
if old in t:
    p.write_text(t.replace(old, new, 1), encoding='utf-8')
    changed.append('panel-api')
else:
    print('panel-api skip')
print('phase1', changed)
