import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { aggregateUserIncome } from '@/lib/ai/aggregateIncome';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const taxYear = body.taxYear ?? new Date().getFullYear() - 1;

  const result = await aggregateUserIncome(auth.user.id, taxYear);

  return NextResponse.json(result);
}
