#!/usr/bin/env python3
"""Additive empty/loading for admin service-categories (#40 item 2)."""
from pathlib import Path


def main() -> None:
    p = Path('frontend/src/app/admin/service-categories/page.tsx')
    s = p.read_text()
    if 'PanelEmpty' in s and 'setLoading' in s:
        print('already patched')
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

    if 'setLoading(true)' not in s:
        s = s.replace(
            '''  const load = useCallback(async () => {
    setError(null);
    const [cats, svcs] = await Promise.all([''',
            '''  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
    const [cats, svcs] = await Promise.all(['',
            1,
        )
        s = s.replace(
            '''    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);
  }, []);''',
            '''    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setCategories([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);''',
            1,
        )

    s = s.replace(
        '''  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setCategories([]);
      setServices([]);
    });
  }, [load]);''',
        '''  useEffect(() => {
    void load();
  }, [load]);''',
        1,
    )

    if 'loading && categories.length === 0' not in s:
        s = s.replace(
            '''      {message && (
        <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">''',
            '''      {message && (
        <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>
      )}

      {loading && categories.length === 0 && (
        <PanelLoading rows={5} />
      )}
      {error && categories.length === 0 && !loading && (
        <PanelError message={error} onRetry={() => void load()} />
      )}

      <section className="grid gap-4 lg:grid-cols-2">''',
            1,
        )

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
    print('patched ok')


if __name__ == '__main__':
    main()
