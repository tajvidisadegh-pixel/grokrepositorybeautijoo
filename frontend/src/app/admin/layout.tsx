'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelShell, type PanelNavItem } from '@/components/panel/panel-shell';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

type NavBadges = {
  professionals?: number;
  bookings?: number;
  reviews?: number;
  support?: number;
  media?: number;
  notifications?: number;
};

type NavDef = PanelNavItem & {
  badgeKey?: keyof NavBadges;
  anyOf?: string[];
};

const BASE_ITEMS: NavDef[] = [
  { href: '/admin', label: '\u062f\u0627\u0634\u0628\u0648\u0631\u062f', anyOf: ['admin.dashboard.read'] },
  { href: '/admin/finance', label: '\u0645\u062f\u06cc\u0631\u06cc\u062a \u0645\u0627\u0644\u06cc', anyOf: ['admin.finance.read', 'admin.finance.write'] },
  { href: '/admin/users', label: '\u0645\u0634\u062a\u0631\u06cc\u0627\u0646', anyOf: ['admin.users.read', 'admin.users.write'] },
  { href: '/admin/notifications', label: '\u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627', badgeKey: 'notifications', anyOf: ['admin.notifications.send'] },
  { href: '/admin/professionals', label: '\u0632\u06cc\u0628\u0627\u06af\u0631\u0647\u0627', badgeKey: 'professionals', anyOf: ['admin.professionals.read', 'admin.professionals.write'] },
  { href: '/admin/service-categories', label: '\u062a\u062e\u0635\u0635\u200c\u0647\u0627 \u0648 \u062f\u0633\u062a\u0647\u200c\u0628\u0646\u062f\u06cc\u200c\u0647\u0627', anyOf: ['admin.catalog.manage'] },
  { href: '/admin/bookings', label: '\u0631\u0632\u0631\u0648\u0647\u0627', badgeKey: 'bookings', anyOf: ['admin.bookings.read', 'admin.bookings.write'] },
  { href: '/admin/reviews', label: '\u0646\u0638\u0631\u0627\u062a \u0648 \u0627\u0645\u062a\u06cc\u0627\u0632\u0647\u0627', badgeKey: 'reviews', anyOf: ['admin.reviews.moderate'] },
  { href: '/admin/media', label: '\u0631\u0633\u0627\u0646\u0647\u200c\u0647\u0627', badgeKey: 'media', anyOf: ['admin.media.moderate'] },
  { href: '/admin/site-builder', label: '\u0637\u0631\u0627\u062d\u06cc \u0633\u0627\u06cc\u062a', anyOf: ['admin.site_builder.manage'] },
  { href: '/admin/support', label: '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc', badgeKey: 'support', anyOf: ['admin.support.handle'] },
  { href: '/admin/settings', label: '\u062a\u0646\u0638\u06cc\u0645\u0627\u062a', anyOf: ['admin.settings.read', 'admin.settings.write'] },
  { href: '/admin/audit', label: '\u0644\u0627\u06af \u0641\u0639\u0627\u0644\u06cc\u062a\u200c\u0647\u0627', anyOf: ['admin.audit.read'] },
];

const PRIVILEGED = new Set(['SUPER_ADMIN']); // full nav only for super admin
const CHANNEL_ROLES = [
  'admin_customers',
  'admin_professionals',
  'admin_bookings',
  'admin_finance',
  'admin_content',
  'admin_support',
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [badges, setBadges] = useState<NavBadges>({});

  const isFullAdmin = useMemo(
    () => (user?.roles || []).some((r) => PRIVILEGED.has(r)),
    [user],
  );
  const userPerms = useMemo(() => new Set(user?.permissions || []), [user]);

  const canSee = useCallback(
    (anyOf?: string[]) => {
      if (isFullAdmin) return true;
      if (!anyOf?.length) return false;
      return anyOf.some((p) => userPerms.has(p));
    },
    [isFullAdmin, userPerms],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.get<NavBadges>('/admin/nav-badges');
      setBadges(data || {});
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const items = useMemo(
    () =>
      BASE_ITEMS.filter((it) => canSee(it.anyOf)).map(({ badgeKey, anyOf: _a, ...item }) => ({
        ...item,
        badge: badgeKey ? Number(badges[badgeKey] || 0) : undefined,
      })),
    [badges, canSee],
  );

  return (
    <PanelShell title="\u067e\u0646\u0644 \u0627\u062f\u0645\u06cc\u0646" items={items} roles={['admin', 'SUPER_ADMIN', ...CHANNEL_ROLES]}>
      {children}
    </PanelShell>
  );
}
