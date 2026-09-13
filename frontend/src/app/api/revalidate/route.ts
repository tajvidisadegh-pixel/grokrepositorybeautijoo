import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * On-demand revalidation after CMS publish.
 * Auth: Bearer REVALIDATE_SECRET or query ?secret=
 */
export async function POST(req: NextRequest) {
  const secret =
    process.env.REVALIDATE_SECRET || process.env.NEXT_PUBLIC_REVALIDATE_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const body = await req.json().catch(() => ({} as { secret?: string; path?: string }));
  const provided =
    bearer || body.secret || req.nextUrl.searchParams.get('secret') || '';

  if (secret) {
    if (provided !== secret) {
      return NextResponse.json({ ok: false, message: 'Invalid secret' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, message: 'REVALIDATE_SECRET is not configured' },
      { status: 503 },
    );
  }

  try {
    revalidateTag('site-cms');
    revalidatePath('/');
    if (body.path && typeof body.path === 'string' && body.path.startsWith('/')) {
      revalidatePath(body.path);
    }
    return NextResponse.json({ ok: true, revalidated: true, now: Date.now() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'revalidate failed' },
      { status: 500 },
    );
  }
}
