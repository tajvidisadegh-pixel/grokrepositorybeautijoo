'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  fetchMyServiceFilterCategories,
  requestMyServiceFilterCategory,
  type ServiceFilterCategory,
} from '@/lib/service-filter-api';

export function ServiceFilterCategoryPicker({ psId }: { psId: string }) {
  const [items, setItems] = useState<ServiceFilterCategory[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await fetchMyServiceFilterCategories(psId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت دسته‌بندی‌ها');
    }
  }
  useEffect(() => {
    void load();
  }, [psId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((x) => x.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  async function select(id: string) {
    setBusy(true);
    setError(null);
    try {
      await requestMyServiceFilterCategory(psId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت دسته‌بندی');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[#E7F1FF] pt-4">
      <p className="text-sm font-semibold text-[#0B2C4A]">دسته‌بندی فیلتر کاربر</p>
      <p className="mt-1 text-xs text-gray-500">
        فقط دسته‌بندی‌هایی که ادمین برای این تخصص تعریف کرده قابل انتخاب هستند.
      </p>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="جستجو و انتخاب دسته‌بندی..."
        className="mt-2"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy || item.status === 'approved' || item.status === 'pending'}
            onClick={() => void select(item.id)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              item.status === 'approved'
                ? 'border-[#2D6CDF] bg-[#E7F1FF] text-[#2D6CDF]'
                : item.status === 'rejected'
                  ? 'border-[#FFB6A6] bg-[#FFE6E2] text-[#FF6F61]'
                  : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {item.name}
            {item.status === 'pending'
              ? ' · در انتظار'
              : item.status === 'rejected'
                ? ' · رد شده'
                : item.status === 'approved'
                  ? ' · تأییدشده'
                  : ''}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400">دسته‌بندی مرتبطی برای این تخصص تعریف نشده است.</p>
        )}
      </div>
    </div>
  );
}
