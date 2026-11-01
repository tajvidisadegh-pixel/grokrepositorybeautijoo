'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** #68: merged into /admin/service-categories — keep old URL working. */
export default function AdminCatalogTemplateRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/service-categories');
  }, [router]);
  return (
    <div className="px-4 py-10 text-center text-sm text-gray" dir="rtl">
      در حال انتقال به صفحهٔ «دسته‌ها و تخصص‌ها»…
    </div>
  );
}
