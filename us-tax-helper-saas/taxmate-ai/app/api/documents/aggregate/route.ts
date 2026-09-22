import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { aggregateUserIncome } from '@/lib/ai/aggregateIncome';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const taxYear = body.taxYear ?? new Date().getFullYear() - 1;

  const result = await aggregateUserIncome(session.user.id, taxYear);

  return NextResponse.json(result);
}
