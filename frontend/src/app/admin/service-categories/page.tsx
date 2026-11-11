'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { ServicePricingPanel } from '@/components/admin/ServicePricingPanel';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
  sortOrder?: number;
  icon?: string | null;
  _count?: { services: number; children: number };
};

type Service = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  categoryId?: string;
  category?: { id: string; name: string } | null;
  allowFixed?: boolean;
  allowVariable?: boolean;
  allowDeposit?: boolean;
};

type PricingFilter = 'all' | 'fixed' | 'variable' | 'deposit';

export default function AdminServiceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pricingSvc, setPricingSvc] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [cats, svcs] = await Promise.all([
      apiClient.get<Category[]>('/admin/service-categories'),
      apiClient.get<Service[]>('/admin/catalog-services').catch(() => []),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
    });
  }, [load]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    for (const c of categories) {
      const key = c.parentId ?? null;
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'fa'),
      );
    }
    return map;
  }, [categories]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (selectedCategoryId) {
        const cid = s.categoryId || s.category?.id;
        if (cid !== selectedCategoryId) return false;
      }
      if (pricingFilter === 'fixed' && (s.allowVariable || s.allowDeposit)) return false;
      if (pricingFilter === 'variable' && !s.allowVariable) return false;
      if (pricingFilter === 'deposit' && !s.allowDeposit) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.category?.name || '').toLowerCase().includes(q);
    });
  }, [services, query, pricingFilter, selectedCategoryId]);

  async function createCategory() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/admin/service-categories', {
        name: name.trim(),
        parentId: parentId || null,
      });
      setName('');
      setParentId('');
      setMessage('دسته‌بندی ایجاد شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  async function createService() {
    if (!serviceName.trim() || !serviceCategoryId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/admin/catalog-services', {
        name: serviceName.trim(),
        categoryId: serviceCategoryId,
      });
      setServiceName('');
      setServiceCategoryId('');
      setMessage('تخصص ایجاد شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  function onPricingFilterChange(value: string) {
    if (value === 'all' || value === 'fixed' || value === 'variable' || value === 'deposit') {
      setPricingFilter(value);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-[#0B2C4A]">تخصص‌ها و دسته‌بندی‌ها</h1>
        <p className="mt-1 text-sm text-gray-500">
          مدیریت درخت دسته‌ها، تخصص‌های کاتالوگ و حالت‌های قیمت. از دکمه «قیمت‌گذاری» روی هر تخصص
          استفاده کنید. برای فهم بهتر قیمت متغیر، داخل پنل قیمت‌گذاری دکمه «اعمال نمونه قیمت متغیر» را
          بزنید تا گروه‌های نمونه (مثل طول مو و نوع کار) ساخته شوند.
        </p>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <h2 className="font-semibold text-[#0B2C4A]">+ افزودن دسته‌بندی</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام دسته‌بندی"
            />
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-10 rounded-xl border px-3 text-sm"
            >
              <option value="">بدون والد</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={busy || !name.trim()}
            onClick={() => void createCategory()}
            className="mt-3 rounded-xl bg-[#2D6CDF] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            ثبت دسته‌بندی
          </button>
        </div>
        <div className="rounded-2xl border border-[#FFE6E2] bg-white p-4">
          <h2 className="font-semibold text-[#0B2C4A]">+ افزودن تخصص</h2>
          <div className="mt-3 grid gap-2">
            <Input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="نام تخصص"
            />
            <select
              value={serviceCategoryId}
              onChange={(e) => setServiceCategoryId(e.target.value)}
              className="h-10 w-full rounded-xl border px-3 text-sm"
            >
              <option value="">انتخاب دسته‌بندی</option>
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <button
            disabled={busy || !serviceName.trim() || !serviceCategoryId}
            onClick={() => void createService()}
            className="mt-3 rounded-xl bg-[#FF6F61] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            ثبت تخصص
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <h2 className="font-semibold text-[#0B2C4A]">دسته‌بندی‌ها</h2>
          <div className="mt-3 space-y-2">
            {(childrenByParent.get(null) || []).map((cat) => (
              <div key={cat.id} className="rounded-xl border border-[#E7F1FF] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#0B2C4A]">{cat.name}</p>
                    <p className="text-[11px] text-gray-500">{cat._count?.services ?? 0} تخصص</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className="text-xs text-[#0B2C4A]"
                  >
                    فیلتر تخصص
                  </button>
                </div>
              </div>
            ))}
            {(childrenByParent.get(null) || []).length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">هنوز دسته‌بندی‌ای ساخته نشده است.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[#0B2C4A]">تخصص‌ها</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-xs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی تخصص..."
              />
              <select
                value={pricingFilter}
                onChange={(e) => onPricingFilterChange(e.target.value)}
                className="h-10 rounded-xl border px-3 text-sm"
              >
                <option value="all">همه</option>
                <option value="fixed">ثابت</option>
                <option value="variable">متغیر</option>
                <option value="deposit">بیعانه</option>
              </select>
            </div>
          </div>
          <div className="mt-3 divide-y">
            {filteredServices.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">موردی یافت نشد.</p>
            ) : (
              filteredServices.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium text-[#0B2C4A]">{s.name}</p>
                    <p className="text-[11px] text-gray-500">{s.category?.name || '—'}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.allowVariable && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                          متغیر
                        </span>
                      )}
                      {s.allowDeposit && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          بیعانه
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPricingSvc({ id: s.id, name: s.name })}
                    className="rounded-lg bg-[#0B2C4A] px-2 py-1 text-xs text-white"
                  >
                    قیمت‌گذاری
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {pricingSvc && (
        <ServicePricingPanel
          serviceId={pricingSvc.id}
          serviceName={pricingSvc.name}
          onClose={() => setPricingSvc(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
