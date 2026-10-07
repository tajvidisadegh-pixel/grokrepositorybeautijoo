from pathlib import Path
p = Path('backend/src/reminders/reminders.service.ts')
t = p.read_text()
if 'this.notifications.create({' in t:
    t = t.replace('this.notifications.create({', 'this.notifications.notify({')
    p.write_text(t)
    print('notify fix OK')
else:
    print('no create calls or already fixed')
