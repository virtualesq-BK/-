import { NextResponse } from 'next/server';
import { TaxReturnStatus, Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { ManualTaxInputsSchema, generateTaxDraftFromManualInputs } from '@/lib/tax/manual-inputs';

export const maxDuration = 30;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = ManualTaxInputsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값이 올바르지 않습니다', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const draft = generateTaxDraftFromManualInputs(parsed.data);
  const userId = auth.user.id;

  const taxReturn = await prisma.taxReturn.upsert({
    where: { userId_taxYear: { userId, taxYear: parsed.data.taxYear } },
    create: {
      userId,
      taxYear: parsed.data.taxYear,
      status: TaxReturnStatus.AI_REVIEW,
      aiGeneratedData: draft as unknown as Prisma.InputJsonValue,
    },
    update: {
      status: TaxReturnStatus.AI_REVIEW,
      aiGeneratedData: draft as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ taxReturn, draft });
}
