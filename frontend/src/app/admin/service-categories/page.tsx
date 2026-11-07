'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  description?: string | null;
  icon?: string | null;
  _count?: { services: number; children: number };
  parent?: { id: string; name: string } | null;
};

type Service = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  categoryId?: string;
  category?: { id: string; name: string; slug: string } | null;
  allowFixed?: boolean;
  allowVariable?: boolean;
  allowDeposit?: boolean;
  defaultPricingMode?: string;
};

export default function AdminServiceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'fixed' | 'variable' | 'deposit'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [pricingSvc, setPricingSvc] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childParentId, setChildParentId] = useState<string | null>(null);

  const load = useCallback(async () => {
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
  }, [load]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Category[]>();
    for (const c of categories) {
      const key = c.parentId ?? null;
      const list = map.get(key) || [];
      list.push(c);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'fa'));
    return map;
  }, [categories]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category?.name || '').toLowerCase().includes(q)
      );
    });
  }, [services, query, pricingFilter, selectedCategoryId]);

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
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
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

  async function togglePopular(cat: Category) {
    setBusy(true);
    setError(null);
    try {
      const popular = cat.icon === 'popular';
      await apiClient.patch(`/admin/service-categories/${cat.id}`, {
        icon: popular ? null : 'popular',
      });
      setMessage(popular ? 'علامت محبوب برداشته شد' : 'به‌عنوان محبوب علامت خورد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در علامت محبوب');
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-[#0B2C4A]">تخصص‌ها و دسته‌بندی‌ها</h1>
        <p className="mt-1 text-sm text-gray-500">
          مدیریت درخت دسته‌ها، تخصص‌های کاتالوگ و حالت‌های قیمت (ثابت / گزینه‌ها / بیعانه). از دکمه «قیمت‌گذاری» روی هر تخصص استفاده کنید.
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[#0B2C4A]">+ {childParentId ? 'افزودن زیرمجموعه' : 'افزودن دسته‌بندی'}</h2>
            {childParentId && <button type="button" className="text-xs text-gray-500 underline" onClick={() => { setChildParentId(null); setParentId(''); }}>لغو حالت زیرمجموعه</button>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={childParentId ? 'نام زیرمجموعه' : 'نام دسته‌بندی'} />
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 rounded-xl border px-3 text-sm">
              <option value="">بدون والد</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button disabled={busy || !name.trim()} onClick={() => void createCategory()} className="mt-3 rounded-xl bg-[#2D6CDF] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">ثبت دسته‌بندی</button>
        </div>

        <div className="rounded-2xl border border-[#FFE6E2] bg-white p-4">
          <h2 className="font-semibold text-[#0B2C4A]">+ افزودن تخصص</h2>
          <div className="mt-3 grid gap-2">
            <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="نام تخصص" />
            <select value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm">
              <option value="">انتخاب دسته‌بندی</option>
              {categories.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button disabled={busy || !serviceName.trim() || !serviceCategoryId} onClick={() => void createService()} className="mt-3 rounded-xl bg-[#FF6F61] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">ثبت تخصص</button>
        </div>
      </section>

      {editCat && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-4 shadow-xl" dir="rtl">
            <h3 className="font-bold text-[#0B2C4A]">ویرایش دسته</h3>
            <Input value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} />
            <select value={editCat.parentId || ''} onChange={(e) => setEditCat({ ...editCat, parentId: e.target.value || null })} className="h-10 w-full rounded-xl border px-3 text-sm">
              <option value="">بدون والد</option>
              {categories.filter((c) => c.id !== editCat.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editCat.isActive} onChange={(e) => setEditCat({ ...editCat, isActive: e.target.checked })} />فعال</label>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void saveEditCategory()} className="rounded-xl bg-[#2D6CDF] px-4 py-2 text-sm text-white">ذخیره</button>
              <button type="button" onClick={() => setEditCat(null)} className="rounded-xl border px-4 py-2 text-sm">انصراف</button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#0B2C4A]">دسته‌بندی‌ها</h2>
            {selectedCategoryId && (
              <button type="button" className="text-xs text-[#FF6F61] underline" onClick={() => setSelectedCategoryId(null)}>حذف فیلتر دسته</button>
            )}
          </div>
          <div className="space-y-2">
            {(childrenByParent.get(null) || []).map(function renderRoot(root: Category): ReactNode {
              const renderNode = (cat: Category, depth: number): ReactNode => {
                const children = childrenByParent.get(cat.id) || [];
                const isOpen = expanded.has(cat.id);
                return (
                  <div key={cat.id} className={depth > 0 ? 'mr-3 border-r border-[#E7F1FF] pr-2' : ''}>
                    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${selectedCategoryId === cat.id ? 'border-[#FF6F61] bg-[#FFF5F3]' : 'border-[#E7F1FF] bg-white'}`}>
                      {children.length > 0 ? (
                        <button type="button" className="text-xs" onClick={() => toggleExpanded(cat.id)}>{isOpen ? '▼' : '▶'}</button>
                      ) : <span className="w-3" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#0B2C4A]">{cat.name}{cat.icon === 'popular' ? ' ★' : ''}</p>
                        <p className="text-[11px] text-gray-500">{cat._count?.services ?? 0} تخصص{!cat.isActive ? ' · غیرفعال' : ''}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" disabled={busy} onClick={() => setSelectedCategoryId(cat.id)} className="text-xs text-[#0B2C4A]">فیلتر تخصص</button>
                        <button type="button" disabled={busy} onClick={() => { setChildParentId(cat.id); setParentId(cat.id); setExpanded((p) => new Set(p).add(cat.id)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs text-gray-600">+ زیرمجموعه</button>
                        <button type="button" disabled={busy} onClick={() => setEditCat({ ...cat })} className="text-xs text-[#2D6CDF]">ویرایش</button>
                        <button type="button" disabled={busy} onClick={() => void setCategoryActive(cat.id, !cat.isActive)} className="text-xs text-[#2D6CDF]">{cat.isActive ? 'غیرفعال' : 'فعال'}</button>
                        <button type="button" disabled={busy} onClick={() => void togglePopular(cat)} className="text-xs text-amber-700">{cat.icon === 'popular' ? 'حذف محبوب' : 'محبوب'}</button>
                        <button type="button" disabled={busy} onClick={() => void deleteCategory(cat.id)} className="text-xs text-[#FF6F61]">حذف</button>
                      </div>
                    </div>
                    {isOpen && children.length > 0 && (
                      <div className="mt-1 space-y-1">{children.map((ch) => renderNode(ch, depth + 1))}</div>
                    )}
                  </div>
                );
              };
              return renderNode(root, 0);
            })}
            {(childrenByParent.get(null) || []).length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">هنوز دسته‌بندی‌ای ساخته نشده است.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[#0B2C4A]">تخصص‌ها</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی تخصص..." />
              <select value={pricingFilter} onChange={(e) => setPricingFilter(e.target.value as 'all' | 'fixed' | 'variable' | 'deposit')} className="h-10 rounded-xl border px-3 text-sm">
                <option value="all">همه حالت‌ها</option>
                <option value="fixed">فقط ثابت</option>
                <option value="variable">دارای متغیر</option>
                <option value="deposit">دارای بیعانه</option>
              </select>
            </div>
          </div>
          <div className="mt-3 divide-y">
            {filteredServices.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">موردی یافت نشد.</p>
            ) : (
              filteredServices.map((s) => (
                <div key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  {editSvc?.id === s.id ? (
                    <div className="w-full space-y-2">
                      <Input value={editSvc.name} onChange={(e) => setEditSvc({ ...editSvc, name: e.target.value })} />
                      <select value={editSvc.categoryId || editSvc.category?.id || ''} onChange={(e) => setEditSvc({ ...editSvc, categoryId: e.target.value })} className="h-10 w-full rounded-xl border px-3 text-sm">
                        {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                      </select>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editSvc.isActive !== false} onChange={(e) => setEditSvc({ ...editSvc, isActive: e.target.checked })} />فعال</label>
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => void saveEditService()} className="rounded-lg bg-[#2D6CDF] px-3 py-1 text-xs text-white">ذخیره</button>
                        <button type="button" onClick={() => setEditSvc(null)} className="rounded-lg border px-3 py-1 text-xs">انصراف</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[#0B2C4A]">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.category?.name || 'بدون دسته'} · {s.slug}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.allowVariable && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">متغیر</span>}
                          {s.allowDeposit && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">بیعانه</span>}
                          {(s.allowVariable || s.allowDeposit) && (s.allowFixed !== false) && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">+ثابت</span>}
                          {!s.allowVariable && !s.allowDeposit && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">ثابت</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busy} onClick={() => setEditSvc({ ...s, categoryId: s.categoryId || s.category?.id })} className="text-xs text-[#2D6CDF]">ویرایش</button>
                        <button disabled={busy} onClick={() => setPricingSvc({ id: s.id, name: s.name })} className="rounded-lg bg-[#0B2C4A] px-2 py-1 text-xs text-white">قیمت‌گذاری</button>
                        <button disabled={busy} onClick={() => void deleteService(s.id)} className="text-xs text-[#FF6F61]">حذف</button>
                      </div>
                    </>
                  )}
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
