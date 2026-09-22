import { NextResponse } from 'next/server';
import { TaxReturnStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { generateTaxDraft } from '@/lib/tax/generate-draft';
import { Prisma } from '@prisma/client';

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const taxYear = body.taxYear ?? new Date().getFullYear() - 1;
  const userId = auth.user.id;

  const draft = await generateTaxDraft(userId, taxYear);

  const taxReturn = await prisma.taxReturn.upsert({
    where: { userId_taxYear: { userId, taxYear } },
    create: {
      userId,
      taxYear,
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

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const taxYear = Number(searchParams.get('taxYear') ?? new Date().getFullYear() - 1);

  const taxReturn = await prisma.taxReturn.findUnique({
    where: { userId_taxYear: { userId: auth.user.id, taxYear } },
  });

  return NextResponse.json({ taxReturn });
}
