'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { CATALOG_TEMPLATE } from '@/lib/catalog-template';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
  icon?: string | null;
  sortOrder?: number;
};

type Service = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  isActive?: boolean;
};

export default function AdminCatalogTemplatePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newRoot, setNewRoot] = useState('');
  const [newChildParent, setNewChildParent] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [newSvcCat, setNewSvcCat] = useState('');
  const [newSvcName, setNewSvcName] = useState('');

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [cats, svcs] = await Promise.all([
        apiClient.get<Category[]>('/admin/service-categories'),
        apiClient.get<Service[]>('/admin/catalog-services').catch(() => [] as Service[]),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setServices(Array.isArray(svcs) ? svcs : []);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roots = useMemo(
    () => categories.filter((c) => !c.parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories],
  );

  const childrenOf = useCallback(
    (id: string) => categories.filter((c) => c.parentId === id),
    [categories],
  );

  const servicesOf = useCallback(
    (catId: string) => services.filter((s) => s.categoryId === catId),
    [services],
  );

  async function seedTemplate() {
    if (!window.confirm('قالب استاندارد تخصص‌ها و خانواده‌ها و خدمات در کاتالوگ ایجاد/تکمیل شود؟')) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      let created = 0;
      const refreshCats = async () => {
        const cats = await apiClient.get<Category[]>('/admin/service-categories');
        return Array.isArray(cats) ? cats : [];
      };
      const refreshSvcs = async () => {
        const svcs = await apiClient.get<Service[]>('/admin/catalog-services').catch(() => [] as Service[]);
        return Array.isArray(svcs) ? svcs : [];
      };
      let liveCats = await refreshCats();
      let liveSvcs = await refreshSvcs();
      for (let i = 0; i < CATALOG_TEMPLATE.length; i++) {
        const sp = CATALOG_TEMPLATE[i];
        let root = liveCats.find((c) => c.slug === sp.slug || c.name === sp.name);
        if (!root) {
          root = await apiClient.post<Category>('/admin/service-categories', {
            name: sp.name,
            slug: sp.slug,
            sortOrder: i + 1,
          });
          created++;
          liveCats = await refreshCats();
          root = liveCats.find((c) => c.slug === sp.slug || c.name === sp.name) || root;
        }
        for (let j = 0; j < sp.families.length; j++) {
          const fam = sp.families[j];
          const famSlug = `${sp.slug}-f${j}`;
          let famCat = liveCats.find((c) => c.parentId === root!.id && c.name === fam.name);
          if (!famCat) {
            famCat = await apiClient.post<Category>('/admin/service-categories', {
              name: fam.name,
              parentId: root!.id,
              slug: famSlug,
              sortOrder: j + 1,
              description: fam.dims.length
                ? `DIMS:${fam.dims.map((d) => d.key + '=' + d.options.join('|')).join(';')}`
                : undefined,
            });
            created++;
            liveCats = await refreshCats();
            famCat = liveCats.find((c) => c.parentId === root!.id && c.name === fam.name) || famCat;
          }
          for (let k = 0; k < fam.variants.length; k++) {
            const v = fam.variants[k];
            const exists = liveSvcs.some((s) => s.categoryId === famCat!.id && s.name === v.name);
            if (!exists) {
              await apiClient
                .post('/admin/catalog-services', {
                  name: v.name,
                  categoryId: famCat!.id,
                })
                .catch(async () => null);
              created++;
            }
          }
          liveSvcs = await refreshSvcs();
        }
      }
      setMsg(`قالب اعمال شد (حدود ${created.toLocaleString('fa-IR')} مورد جدید/بررسی‌شده). کاتالوگ را یک‌بار رفرش کنید.`);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function togglePopular(cat: Category) {
    setBusy(true);
    try {
      const popular = cat.icon === 'popular';
      await apiClient.patch(`/admin/service-categories/${cat.id}`, {
        icon: popular ? null : 'popular',
      });
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected.size) return;
    if (!window.confirm(`حذف ${selected.size} مورد انتخاب‌شده؟`)) return;
    setBusy(true);
    try {
      for (const id of selected) {
        await apiClient.delete(`/admin/service-categories/${id}`).catch(() =>
          apiClient.patch(`/admin/service-categories/${id}`, { isActive: false }),
        );
      }
      setSelected(new Set());
      await load();
      setMsg('حذف/غیرفعال‌سازی انجام شد.');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addRoot() {
    if (!newRoot.trim()) return;
    setBusy(true);
    try {
      await apiClient.post('/admin/service-categories', { name: newRoot.trim() });
      setNewRoot('');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addChild() {
    if (!newChildParent || !newChildName.trim()) return;
    setBusy(true);
    try {
      await apiClient.post('/admin/service-categories', {
        name: newChildName.trim(),
        parentId: newChildParent,
      });
      setNewChildName('');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addService() {
    if (!newSvcCat || !newSvcName.trim()) return;
    setBusy(true);
    try {
      await apiClient.post('/admin/catalog-services', {
        name: newSvcName.trim(),
        categoryId: newSvcCat,
      }).catch(() =>
        apiClient.post('/admin/services', {
          name: newSvcName.trim(),
          categoryId: newSvcCat,
        }),
      );
      setNewSvcName('');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !categories.length) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B2C4A]">کاتالوگ قالب خدمات</h1>
          <p className="mt-1 text-sm text-gray">
            تخصص → خانواده خدمت → گونه. علامت محبوب فقط اینجا. زیباگر فقط قیمت می‌گذارد.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} onClick={() => void seedTemplate()}>
            بارگذاری / تکمیل قالب استاندارد
          </Button>
          <Button variant="outline" disabled={!selected.size} loading={busy} onClick={() => void removeSelected()}>
            حذف دسته‌ای ({selected.size})
          </Button>
        </div>
      </div>

      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Card className="space-y-3 p-4">
        <p className="text-sm font-medium">افزودن دستی</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="تخصص جدید" value={newRoot} onChange={(e) => setNewRoot(e.target.value)} className="max-w-xs" />
          <Button size="sm" loading={busy} onClick={() => void addRoot()}>افزودن تخصص</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={newChildParent}
            onChange={(e) => setNewChildParent(e.target.value)}
          >
            <option value="">والد (تخصص/خانواده)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Input placeholder="نام زیر‌شاخه" value={newChildName} onChange={(e) => setNewChildName(e.target.value)} className="max-w-xs" />
          <Button size="sm" loading={busy} onClick={() => void addChild()}>افزودن شاخه</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border px-3 py-2 text-sm"
            value={newSvcCat}
            onChange={(e) => setNewSvcCat(e.target.value)}
          >
            <option value="">دسته خدمت</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Input placeholder="نام خدمت/گونه" value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)} className="max-w-xs" />
          <Button size="sm" loading={busy} onClick={() => void addService()}>افزودن خدمت</Button>
        </div>
      </Card>

      <div className="space-y-4">
        {roots.map((root) => (
          <Card key={root.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(root.id)}
                onChange={() => {
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (n.has(root.id)) n.delete(root.id);
                    else n.add(root.id);
                    return n;
                  });
                }}
              />
              <h2 className="text-lg font-bold text-[#0B2C4A]">{root.name}</h2>
              <button
                type="button"
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  root.icon === 'popular' ? 'border-coral bg-coral text-white' : 'border-border'
                }`}
                onClick={() => void togglePopular(root)}
              >
                {root.icon === 'popular' ? 'محبوب ✓' : 'محبوب'}
              </button>
            </div>
            {childrenOf(root.id).map((fam) => (
              <div key={fam.id} className="mr-4 space-y-1 border-r-2 border-coral/30 pr-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(fam.id)}
                    onChange={() => {
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(fam.id)) n.delete(fam.id);
                        else n.add(fam.id);
                        return n;
                      });
                    }}
                  />
                  <span className="font-medium">{fam.name}</span>
                  <span className="text-xs text-gray">{servicesOf(fam.id).length} خدمت</span>
                </div>
                <ul className="mr-6 list-disc text-sm text-gray-700">
                  {servicesOf(fam.id).map((s) => (
                    <li key={s.id}>{s.name}</li>
                  ))}
                  {!servicesOf(fam.id).length && <li className="text-gray-400">بدون خدمت</li>}
                </ul>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
