'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ZibagarMenuRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/zibagar/services');
  }, [router]);
  return (
    <p className="p-6 text-center text-sm text-gray" dir="rtl">
      در حال انتقال به منوی خدمات…
    </p>
  );
}
