import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { calculateAuditRiskScore } from '@/lib/ai/auditRiskScore';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userMessage, assistantMessage } = await req.json();
  if (!userMessage || !assistantMessage) {
    return NextResponse.json(
      { error: 'userMessage and assistantMessage are required' },
      { status: 400 }
    );
  }

  const result = calculateAuditRiskScore(userMessage, assistantMessage);
  return NextResponse.json(result);
}
