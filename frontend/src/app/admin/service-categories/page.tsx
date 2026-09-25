'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
  sortOrder?: number;
  description?: string | null;
  _count?: { services: number; children: number };
  parent?: { id: string; name: string } | null;
};


type CatalogAddOn = {
  id: string;
  name: string;
  description?: string | null;
  defaultPrice: number;
  defaultExtraDurationMin?: number;
  sortOrder?: number;
  isActive?: boolean;
};
type Service = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  categoryId?: string;
  category?: { id: string; name: string; slug: string } | null;
};

export default function AdminServiceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [catalogAddOns, setCatalogAddOns] = useState<CatalogAddOn[]>([]);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState(0);
  const [addonExtra, setAddonExtra] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const [cats, svcs, addons] = await Promise.all([
      apiClient.get<Category[]>('/admin/service-categories'),
      apiClient.get<Service[]>('/admin/catalog-services').catch(() =>
        apiClient.get<Service[]>('/services').catch(() => []),
      ),
      apiClient.get<CatalogAddOn[]>('/admin/catalog-addons').catch(() => []),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);
    setCatalogAddOns(Array.isArray(addons) ? addons : []);
  }, []);

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setCategories([]);
      setServices([]);
    });
  }, [load]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category?.name || '').toLowerCase().includes(q),
    );
  }, [services, query]);

  async function createCategory() {
    if (!name.trim()) return;
    setBusy(true);
    setMessage(null);
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
      setError(e instanceof Error ? e.message : 'خطا در ایجاد دسته‌بندی');
    } finally {
      setBusy(false);
    }
  }

  async function saveEditCategory() {
    if (!editCat) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.patch(`/admin/service-categories/${editCat.id}`, {
        name: editCat.name,
        parentId: editCat.parentId || null,
        isActive: editCat.isActive,
        sortOrder: editCat.sortOrder ?? 0,
      });
      setEditCat(null);
      setMessage('دسته‌بندی به‌روزرسانی شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ویرایش');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('این دسته‌بندی غیرفعال شود؟')) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/admin/service-categories/${id}`);
      setMessage('دسته‌بندی غیرفعال شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در حذف');
    } finally {
      setBusy(false);
    }
  }

  async function setCategoryActive(id: string, isActive: boolean) {
    setBusy(true);
    try {
      await apiClient.patch(`/admin/service-categories/${id}`, { isActive });
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
    setMessage(null);
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
      setError(e instanceof Error ? e.message : 'خطا در ایجاد تخصص');
    } finally {
      setBusy(false);
    }
  }

  async function saveEditService() {
    if (!editSvc) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.patch(`/admin/catalog-services/${editSvc.id}`, {
        name: editSvc.name,
        categoryId: editSvc.categoryId || editSvc.category?.id,
        isActive: editSvc.isActive,
      });
      setEditSvc(null);
      setMessage('تخصص به‌روزرسانی شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ویرایش تخصص');
    } finally {
      setBusy(false);
    }
  }

  async function deleteService(id: string) {
    if (!confirm('این تخصص غیرفعال شود؟')) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/admin/catalog-services/${id}`);
      setMessage('تخصص غیرفعال شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در حذف تخصص');
    } finally {
      setBusy(false);
    }
  }


  async function createCatalogAddOn() {
    if (!addonName.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.post('/admin/catalog-addons', {
        name: addonName.trim(),
        defaultPrice: addonPrice || 0,
        defaultExtraDurationMin: addonExtra || 0,
      });
      setAddonName('');
      setAddonPrice(0);
      setAddonExtra(0);
      setMessage('ویژگی کاتالوگ ثبت شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ایجاد ویژگی');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCatalogAddOn(id: string) {
    if (!confirm('این ویژگی غیرفعال شود؟')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/catalog-addons/${id}`);
      setMessage('ویژگی غیرفعال شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-[#0B2C4A]">تخصص‌ها و دسته‌بندی‌ها</h1>
        <p className="mt-1 text-sm text-gray-500">
          مدیریت کامل دسته‌بندی‌ها و تخصص‌های اصلی (افزودن، ویرایش، فعال/غیرفعال).
        </p>
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
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

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-[#0B2C4A]">دسته‌بندی‌های موجود</h2>
        <div className="mt-3 divide-y">
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">هنوز دسته‌بندی‌ای ساخته نشده است.</p>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                {editCat?.id === c.id ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <Input
                      value={editCat.name}
                      onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                      className="max-w-xs"
                    />
                    <select
                      value={editCat.parentId || ''}
                      onChange={(e) =>
                        setEditCat({ ...editCat, parentId: e.target.value || null })
                      }
                      className="h-10 rounded-xl border px-3 text-sm"
                    >
                      <option value="">بدون والد</option>
                      {categories
                        .filter((x) => x.id !== c.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={busy}
                      onClick={() => void saveEditCategory()}
                      className="rounded-lg bg-[#2D6CDF] px-3 py-1.5 text-xs text-white"
                    >
                      ذخیره
                    </button>
                    <button
                      onClick={() => setEditCat(null)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs"
                    >
                      انصراف
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium">
                        {c.name}{' '}
                        {!c.isActive && (
                          <span className="text-xs text-red-500">(غیرفعال)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {c.parent?.name ? `زیرمجموعهٔ ${c.parent.name}` : 'دسته اصلی'} ·{' '}
                        {c.slug}
                        {c._count ? ` · ${c._count.services} تخصص` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={busy}
                        onClick={() => setEditCat({ ...c })}
                        className="text-xs text-[#2D6CDF]"
                      >
                        ویرایش
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void setCategoryActive(c.id, !c.isActive)}
                        className="text-xs text-[#2D6CDF]"
                      >
                        {c.isActive ? 'غیرفعال' : 'فعال'}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void deleteCategory(c.id)}
                        className="text-xs text-[#FF6F61]"
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-[#0B2C4A]">تخصص‌ها</h2>
          <Input
            className="max-w-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی تخصص..."
          />
        </div>
        <div className="mt-3 divide-y">
          {filteredServices.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">تخصصی یافت نشد.</p>
          ) : (
            filteredServices.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                {editSvc?.id === s.id ? (
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <Input
                      value={editSvc.name}
                      onChange={(e) => setEditSvc({ ...editSvc, name: e.target.value })}
                      className="max-w-xs"
                    />
                    <select
                      value={editSvc.categoryId || editSvc.category?.id || ''}
                      onChange={(e) =>
                        setEditSvc({ ...editSvc, categoryId: e.target.value })
                      }
                      className="h-10 rounded-xl border px-3 text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={busy}
                      onClick={() => void saveEditService()}
                      className="rounded-lg bg-[#2D6CDF] px-3 py-1.5 text-xs text-white"
                    >
                      ذخیره
                    </button>
                    <button
                      onClick={() => setEditSvc(null)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs"
                    >
                      انصراف
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium">
                        {s.name}{' '}
                        {s.isActive === false && (
                          <span className="text-xs text-red-500">(غیرفعال)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.category?.name || 'بدون دسته'} · {s.slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
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
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void deleteService(s.id)}
                        className="text-xs text-[#FF6F61]"
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#FFE6E2] bg-white p-4">
        <h2 className="font-semibold text-[#0B2C4A]">ویژگی‌ها / اددآن‌های کاتالوگ</h2>
        <p className="mt-1 text-xs text-gray-500">زیباگر فقط از این لیست می‌تواند ویژگی به خدمت اضافه کند (قیمت/زمان قابل تنظیم است).</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input value={addonName} onChange={(e) => setAddonName(e.target.value)} placeholder="نام ویژگی (مثلاً اکستنشن)" />
          <Input inputMode="numeric" value={addonPrice || ''} onChange={(e) => setAddonPrice(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} placeholder="قیمت پیش‌فرض" />
          <Input type="number" min={0} value={addonExtra || ''} onChange={(e) => setAddonExtra(Number(e.target.value) || 0)} placeholder="زمان اضافه (دقیقه)" />
        </div>
        <button
          disabled={busy || !addonName.trim()}
          onClick={() => void createCatalogAddOn()}
          className="mt-3 rounded-xl bg-[#FF6F61] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          ثبت ویژگی کاتالوگ
        </button>
        <div className="mt-4 divide-y">
          {catalogAddOns.filter((a) => a.isActive !== false).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">هنوز ویژگی‌ای تعریف نشده.</p>
          ) : (
            catalogAddOns.filter((a) => a.isActive !== false).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-400">
                    {a.defaultPrice?.toLocaleString('fa-IR') || 0} تومان
                    {a.defaultExtraDurationMin ? ` · +${a.defaultExtraDurationMin}د` : ''}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => void deleteCatalogAddOn(a.id)}
                  className="text-xs text-[#FF6F61]"
                >
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
