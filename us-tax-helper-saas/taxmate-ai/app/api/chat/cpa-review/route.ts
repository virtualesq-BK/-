import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { MessageRole, TaxReturnStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { getOrCreateCurrentTaxReturn } from '@/lib/ai/auditRiskScore';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messageContent, taxReturnId, messageId } = await req.json();

  if (!messageContent?.trim()) {
    return NextResponse.json({ error: 'messageContent is required' }, { status: 400 });
  }

  const userId = session.user.id;

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
