'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchFavorites, removeFavorite, type FavoriteItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function PanelFavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchFavorites()); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function onRemove(professionalId: string) {
    setBusyId(professionalId);
    try {
      await removeFavorite(professionalId);
      setItems((prev) => prev.filter((f) => (f.professional?.id || f.professionalId) !== professionalId));
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBusyId(null); }
  }
  if (loading) return <PanelLoading grid cards={6} />;
  if (error) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">علاقه‌مندی‌ها</h1>
        <p className="mt-1 text-sm text-gray">زیباگرهای ذخیره‌شده شما</p></div>
      {items.length === 0 ? (
        <PanelEmpty title="هنوز کسی را ذخیره نکرده‌اید" description="زیباگرهای مورد علاقه را اینجا ذخیره کنید."
          action={<Link href="/search"><Button size="sm">جستجوی زیباگر</Button></Link>} />
      ) : (
        <ul className="space-y-3">{items.map((f) => {
          const pro = f.professional;
          const id = pro?.id || f.professionalId || '';
          const name = pro?.user?.profile?.displayName || pro?.title || 'زیباگر';
          return (
            <li key={id || f.id}><Card className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold">{name}</p>
                {pro?.title && <p className="text-sm text-gray">{pro.title}</p>}</div>
              <div className="flex gap-2">
                {pro?.slug && <Link href={`/professionals/${pro.slug}`}><Button size="sm" variant="outline">پروفایل</Button></Link>}
                {id && <Button size="sm" variant="secondary" loading={busyId === id} onClick={() => onRemove(id)}>حذف</Button>}
              </div>
            </Card></li>
          );
        })}</ul>
      )}
    </div>
  );
}
