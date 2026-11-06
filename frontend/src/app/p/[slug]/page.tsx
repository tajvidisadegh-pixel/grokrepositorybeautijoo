import { redirect } from 'next/navigation';

type Props = { params: Promise<{ slug: string }> };

/** Legacy short URLs /p/:slug → canonical /professionals/:slug */
export default async function LegacyProfessionalRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/professionals/${encodeURIComponent(slug)}`);
}
