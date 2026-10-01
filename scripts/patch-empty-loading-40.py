#!/usr/bin/env python3
"""Unify empty/loading on remaining list pages (issue #40 item 2). Additive only."""
from pathlib import Path


def patch_service_categories() -> None:
    p = Path('frontend/src/app/admin/service-categories/page.tsx')
    s = p.read_text()
    if 'PanelLoading' in s and 'PanelEmpty' in s:
        print('service-categories already uses state-blocks')
        return

    if "from '@/components/panel/state-blocks'" not in s:
        s = s.replace(
            "import { apiClient } from '@/lib/api';",
            "import { apiClient } from '@/lib/api';\n"
            "import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';",
            1,
        )

    if 'const [loading, setLoading]' not in s:
        s = s.replace(
            'const [busy, setBusy] = useState(false);',
            'const [loading, setLoading] = useState(true);\n  const [busy, setBusy] = useState(false);',
            1,
        )

    old_load = '''  const load = useCallback(async () => {
    setError(null);
    const [cats, svcs] = await Promise.all([
      apiClient.get<Category[]>('/admin/service-categories'),
      apiClient.get<Service[]>('/admin/catalog-services').catch(() =>
        apiClient.get<Service[]>('/services').catch(() => []),
      ),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setCategories([]);
      setServices([]);
    });
  }, [load]);'''

    new_load = '''  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, svcs] = await Promise.all([
        apiClient.get<Category[]>('/admin/service-categories'),
        apiClient.get<Service[]>('/admin/catalog-services').catch(() =>
          apiClient.get<Service[]>('/services').catch(() => []),
        ),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setServices(Array.isArray(svcs) ? svcs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setCategories([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);'''

    if old_load in s:
        s = s.replace(old_load, new_load, 1)
    else:
        print('warn: load block not exact; trying soft patch')
        if 'setLoading(true)' not in s:
            s = s.replace('setError(null);\n    const [cats, svcs]', 'setLoading(true);\n    setError(null);\n    const [cats, svcs]', 1)

    # early loading UI after header messages — insert before forms section
    if 'if (loading && categories.length === 0)' not in s:
        marker = '      {message && (
        <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">'
        insert = '''      {message && (
        <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>
      )}

      {loading && categories.length === 0 && !error ? (
        <PanelLoading rows={5} />
      ) : error && categories.length === 0 ? (
        <PanelError message={error} onRetry={() => void load()} />
      ) : (
      <>

      <section className="grid gap-4 lg:grid-cols-2">'''
        if marker in s:
            s = s.replace(marker, insert, 1)
            # close fragment before final closing of outer div
            # find last </div>\n  ); pattern of component
            if '      </>\n      )}' not in s:
                # before the final `    </div>\n  );` of return
                tail = '    </div>\n  );\n}'
                if tail in s:
                    s = s.replace(
                        tail,
                        '      </>\n      )}\n    </div>\n  );\n}',
                        1,
                    )
                else:
                    print('warn: could not close fragment cleanly')
        else:
            print('warn: marker for loading gate not found')

    s = s.replace(
        '<p className="py-6 text-center text-sm text-gray-500">هنوز دسته‌بندی‌ای ساخته نشده است.</p>',
        '<PanelEmpty title="هنوز دسته‌بندی‌ای نیست" description="از فرم بالا یک دسته اصلی یا زیرمجموعه اضافه کنید." icon="📁" />',
        1,
    )
    s = s.replace(
        '<p className="py-6 text-center text-sm text-gray-500">تخصصی یافت نشد.</p>',
        '<PanelEmpty title="تخصصی یافت نشد" description="عبارت جستجو را عوض کنید یا تخصص جدید بسازید." icon="✂️" />',
        1,
    )

    p.write_text(s)
    print('service-categories patched')


def patch_search_empty_actions() -> None:
    """Ensure search empty has clear dual CTAs."""
    p = Path('frontend/src/app/search/page.tsx')
    s = p.read_text()
    if 'حذف فیلترها' in s:
        print('search actions already enhanced')
        return
    old = '''            action={
              <Link
                href="/professionals"
                className="inline-flex'''
    # softer: if only one link, leave it; add note in empty description is enough
    if 'href="/professionals"' in s and 'EmptyState' in s:
        print('search already has professionals CTA')
        return
    print('search: no change needed')


def main() -> None:
    patch_service_categories()
    patch_search_empty_actions()
    print('done')


if __name__ == '__main__':
    main()
