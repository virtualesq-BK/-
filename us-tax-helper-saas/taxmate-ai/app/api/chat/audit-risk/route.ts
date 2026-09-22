import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { calculateAuditRiskScore } from '@/lib/ai/auditRiskScore';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
