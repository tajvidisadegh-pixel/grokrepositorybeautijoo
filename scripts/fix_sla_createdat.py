from pathlib import Path
p = Path('frontend/src/app/admin/professionals/page.tsx')
t = p.read_text(encoding='utf-8')
t = t.replace('p.updatedAt', 'p.createdAt')
# also fix optional chaining for type
t = t.replace(
    "p.status === 'pending_review' && p.createdAt && (Date.now() - new Date(p.createdAt).getTime() > 24 * 3600_000)",
    "p.status === 'pending_review' && !!(p as { createdAt?: string }).createdAt && (Date.now() - new Date(String((p as { createdAt?: string }).createdAt)).getTime() > 24 * 3600_000)",
)
p.write_text(t, encoding='utf-8')
print('ok')
