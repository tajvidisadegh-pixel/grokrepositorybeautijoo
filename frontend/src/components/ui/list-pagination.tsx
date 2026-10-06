import Link from 'next/link';

/** Simple prev/next pagination for list pages (issue #40 item 22). */
export function ListPagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-center gap-3"
      aria-label="صفحه‌بندی"
    >
      {page > 1 ? (
        <Link
          href={hrefForPage(page - 1)}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:border-coral"
        >
          قبلی
        </Link>
      ) : (
        <span className="rounded-xl border border-transparent px-4 py-2 text-sm text-gray">قبلی</span>
      )}
      <span className="text-sm text-gray">
        صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
      </span>
      {page < totalPages ? (
        <Link
          href={hrefForPage(page + 1)}
          className="rounded-xl border border-border px-4 py-2 text-sm hover:border-coral"
        >
          بعدی
        </Link>
      ) : (
        <span className="rounded-xl border border-transparent px-4 py-2 text-sm text-gray">بعدی</span>
      )}
    </nav>
  );
}
