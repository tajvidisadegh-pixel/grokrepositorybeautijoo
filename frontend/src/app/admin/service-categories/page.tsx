'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';

type Category = { id: string; name: string; slug: string; parentId?: string | null; isActive: boolean; sortOrder?: number };
type Service = { id: string; name: string; slug: string; category?: { id: string; name: string; slug: string } | null };
type Request = { professionalServiceId: string; categoryId: string; status: string; categoryName: string; categorySlug: string; serviceName: string; professionalTitle: string };

export default function AdminServiceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [cats, svcs, reqs] = await Promise.all([
      apiClient.get<Category[]>('/admin/service-categories'),
      apiClient.get<Service[]>('/services'),
      apiClient.get<Request[]>('/admin/service-category-requests?status=pending'),
    ]);
    setCategories(cats || []);
    setServices(svcs || []);
    setRequests(reqs || []);
  }

  useEffect(() => {
    void load().catch((e) => {
      setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود');
      setCategories([]);
      setServices([]);
      setRequests([]);
    });
  }, []);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, query]);

  async function createCategory() {
    if (!name.trim()) return;
    setBusy(true); setMessage(null); setError(null);
    try {
      await apiClient.post('/admin/service-categories', { name: name.trim(), parentId: parentId || null });
      setName(''); setParentId(''); setMessage('دسته‌بندی ایجاد شد'); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'خطا در ایجاد دسته‌بندی'); }
    finally { setBusy(false); }
  }

  async function assign() {
    if (!serviceId || !categoryId) return;
    setBusy(true); setMessage(null);
    try {
      await apiClient.post(`/admin/services/${serviceId}/filter-categories`, { categoryId });
      setMessage('دسته‌بندی برای تخصص فعال شد');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'خطا در اختصاص دسته‌بندی'); }
    finally { setBusy(false); }
  }

  async function setCategoryActive(id: string, isActive: boolean) {
    setBusy(true);
    try { await apiClient.patch(`/admin/service-categories/${id}`, { isActive }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'خطا'); }
    finally { setBusy(false); }
  }

  async function review(r: Request, status: 'approved' | 'rejected') {
    setBusy(true); setMessage(null);
    try {
      await apiClient.patch(`/admin/service-category-requests/${r.professionalServiceId}/${r.categoryId}`, { status });
      setMessage(status === 'approved' ? 'تأیید شد' : 'رد شد؛ انتخاب زیباگر حفظ می‌شود');
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'خطا در بررسی'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-[#0B2C4A]">دسته‌بندی تخصص‌ها</h1>
        <p className="mt-1 text-sm text-gray-500">دسته‌بندی‌ها را ادمین می‌سازد و برای هر تخصص مشخص می‌کند کدام گزینه‌ها مجاز هستند.</p>
      </div>
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <h2 className="font-semibold text-[#0B2C4A]">+ افزودن دسته‌بندی</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام دسته‌بندی" />
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 rounded-xl border px-3 text-sm">
              <option value="">بدون والد</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button disabled={busy || !name.trim()} onClick={() => void createCategory()} className="mt-3 rounded-xl bg-[#2D6CDF] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">ثبت دسته‌بندی</button>
        </div>

        <div className="rounded-2xl border border-[#FFE6E2] bg-white p-4">
          <h2 className="font-semibold text-[#0B2C4A]">اختصاص به تخصص</h2>
          <Input className="mt-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی تخصص..." />
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="mt-2 h-10 w-full rounded-xl border px-3 text-sm">
            <option value="">انتخاب تخصص</option>
            {filteredServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-2 h-10 w-full rounded-xl border px-3 text-sm">
            <option value="">انتخاب دسته‌بندی</option>
            {categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={busy || !serviceId || !categoryId} onClick={() => void assign()} className="mt-3 rounded-xl bg-[#FF6F61] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">اختصاص</button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-[#0B2C4A]">دسته‌بندی‌های موجود</h2>
        <div className="mt-3 divide-y">
          {categories.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">هنوز دسته‌بندی‌ای ساخته نشده است.</p> : categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-gray-400">{c.parentId ? 'زیرمجموعه' : 'دسته اصلی'} · {c.slug}</p></div>
              <button disabled={busy} onClick={() => void setCategoryActive(c.id, !c.isActive)} className="text-xs text-[#2D6CDF]">{c.isActive ? 'غیرفعال کردن' : 'فعال کردن'}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#FFE6E2] bg-white p-4">
        <h2 className="font-semibold text-[#0B2C4A]">درخواست‌های زیباگرها</h2>
        {requests.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">درخواست در انتظار بررسی وجود ندارد.</p> : (
          <div className="mt-3 space-y-2">
            {requests.map((r) => (
              <div key={`${r.professionalServiceId}:${r.categoryId}`} className="rounded-xl bg-[#F9FAFB] p-3">
                <div className="text-sm"><b>{r.professionalTitle}</b> · {r.serviceName} → {r.categoryName}</div>
                <div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => void review(r, 'approved')} className="rounded-lg bg-[#2D6CDF] px-3 py-1.5 text-xs text-white">تأیید</button><button disabled={busy} onClick={() => void review(r, 'rejected')} className="rounded-lg bg-[#FFE6E2] px-3 py-1.5 text-xs text-[#FF6F61]">رد</button></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
