'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname, notFound } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

type Props = {
  children: ReactNode;
  /** If set, user must have at least one of these roles */
  roles?: string[];
  /** Where to send unauthenticated users */
  loginHref?: string;
  /**
   * When true (default), missing role looks like a missing page
   * instead of revealing that a protected area exists.
   */
  hideWhenForbidden?: boolean;
};

const PRIVILEGED = new Set(['SUPER_ADMIN', 'admin']);

export function RequireAuth({
  children,
  roles,
  loginHref = '/login',
  hideWhenForbidden = true,
}: Props) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const hasRequiredRole = (() => {
    if (!roles?.length) return true;
    const userRoles = user?.roles || [];
    if (userRoles.some((r) => PRIVILEGED.has(r))) return true;
    return roles.some((r) => userRoles.includes(r));
  })();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`${loginHref}?next=${next}`);
      return;
    }
    if (roles?.length && !hasRequiredRole && !hideWhenForbidden) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, hasRequiredRole, roles, router, pathname, loginHref, hideWhenForbidden]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray">
        در حال بارگذاری...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (roles?.length && !hasRequiredRole) {
    if (hideWhenForbidden) {
      notFound();
    }
    return null;
  }

  return <>{children}</>;
}
