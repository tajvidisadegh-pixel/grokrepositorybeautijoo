import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'About (EN)', description: 'Beautijoo — beauty booking platform' };

/** Minimal English stub (#61.45). Full i18n later. */
export default function AboutEnPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10" dir="ltr">
      <h1 className="text-2xl font-bold">About Beautijoo</h1>
      <p className="text-sm text-gray-700">
        Beautijoo connects customers with beauty professionals for online booking. The primary UI is Persian (fa).
      </p>
      <Link href="/about" className="text-sm text-blue underline">
        نسخه فارسی
      </Link>
    </div>
  );
}
