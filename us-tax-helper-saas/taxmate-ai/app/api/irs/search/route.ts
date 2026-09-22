import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { retrieveIrsContext } from '@/lib/ai/rag';

export const maxDuration = 30;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const { docs } = await retrieveIrsContext(query, 5);

  return NextResponse.json({
    results: docs.map((d) => ({
      sourceName: d.metadata.sourceName ?? d.metadata.source,
      sourceUrl: d.metadata.sourceUrl ?? null,
      formNumber: d.metadata.formNumber ?? null,
      summary: d.metadata.summary ?? null,
      excerpt: d.pageContent.replace(/^\[Document summary:[\s\S]*?\]\n\n/, '').slice(0, 500),
      score: d.metadata.score ?? null,
    })),
  });
}
