import { NextResponse } from 'next/server';
import { MessageRole, TaxReturnStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { getOrCreateCurrentTaxReturn } from '@/lib/ai/auditRiskScore';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { messageContent, taxReturnId, messageId } = await req.json();

  if (!messageContent?.trim()) {
    return NextResponse.json({ error: 'messageContent is required' }, { status: 400 });
  }

  const userId = auth.user.id;

  const taxReturn =
    taxReturnId != null
      ? await prisma.taxReturn.findFirst({
          where: { id: taxReturnId, userId, deletedAt: null },
        })
      : await getOrCreateCurrentTaxReturn(userId);

  if (!taxReturn) {
    return NextResponse.json({ error: 'Tax return not found' }, { status: 404 });
  }

  const cpaMessage = await prisma.message.create({
    data: {
      userId,
      taxReturnId: taxReturn.id,
      role: MessageRole.USER,
      content: messageContent,
      metadata: {
        type: 'CPA_REVIEW_REQUEST',
        originalMessageId: messageId ?? null,
        requestedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.taxReturn.update({
    where: { id: taxReturn.id },
    data: { status: TaxReturnStatus.CPA_REVIEW },
  });

  return NextResponse.json({
    success: true,
    message: cpaMessage,
    taxReturnStatus: TaxReturnStatus.CPA_REVIEW,
  });
}
