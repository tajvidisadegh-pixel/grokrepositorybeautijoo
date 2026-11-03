#!/usr/bin/env python3
from pathlib import Path

def main() -> None:
    path = Path('frontend/src/app/admin/service-categories/page.tsx')
    t = path.read_text()
    if 'ServicePricingPanel' in t:
        print('already patched')
        return

    old_imp = "import { apiClient } from '@/lib/api';"
    new_imp = "import { apiClient } from '@/lib/api';\nimport { ServicePricingPanel } from '@/components/admin/ServicePricingPanel';"
    if old_imp not in t:
        raise SystemExit('import anchor missing')
    t = t.replace(old_imp, new_imp, 1)

    old_state = '  const [editSvc, setEditSvc] = useState<Service | null>(null);'
    new_state = (
        '  const [editSvc, setEditSvc] = useState<Service | null>(null);\n'
        '  const [pricingSvc, setPricingSvc] = useState<{ id: string; name: string } | null>(null);'
    )
    if old_state not in t:
        raise SystemExit('state anchor missing')
    t = t.replace(old_state, new_state, 1)

    old_btn = '''                      <button
                        disabled={busy}
                        onClick={() =>
                          setEditSvc({
                            ...s,
                            categoryId: s.categoryId || s.category?.id,
                          })
                        }
                        className="text-xs text-[#2D6CDF]"
                      >
                        ویرایش
                      </button>'''
    new_btn = old_btn + '''
                      <button
                        disabled={busy}
                        onClick={() => setPricingSvc({ id: s.id, name: s.name })}
                        className="text-xs text-[#0B2C4A]"
                      >
                        قیمت‌گذاری
                      </button>'''
    if old_btn not in t:
        raise SystemExit('edit button anchor missing')
    t = t.replace(old_btn, new_btn, 1)

    marker = '    </div>\n  );\n}'
    panel = '''      {pricingSvc && (
        <ServicePricingPanel
          serviceId={pricingSvc.id}
          serviceName={pricingSvc.name}
          onClose={() => setPricingSvc(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}'''
    idx = t.rfind(marker)
    if idx < 0:
        raise SystemExit('page end anchor missing')
    t = t[:idx] + panel + t[idx + len(marker):]

    path.write_text(t)
    print('patched', path.stat().st_size)

if __name__ == '__main__':
    main()
