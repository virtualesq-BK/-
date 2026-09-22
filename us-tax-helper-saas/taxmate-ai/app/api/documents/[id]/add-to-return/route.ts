import { NextResponse } from 'next/server';
import { Prisma, TaxReturnStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { aggregateUserIncome } from '@/lib/ai/aggregateIncome';
import type { ExtractedTaxData } from '@/lib/documents/types';

type RouteContext = { params: { id: string } };

function getExistingDocuments(aiGeneratedData: unknown): Array<{
  documentId: string;
  data: unknown;
}> {
  if (
    aiGeneratedData &&
    typeof aiGeneratedData === 'object' &&
    'documents' in aiGeneratedData &&
    Array.isArray((aiGeneratedData as { documents: unknown }).documents)
  ) {
    return (aiGeneratedData as { documents: Array<{ documentId: string; data: unknown }> })
      .documents;
  }
  return [];
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = context.params;
  const body = await req.json().catch(() => ({}));
  const userId = auth.user.id;

  const document = await prisma.taxDocument.findFirst({
    where: { id, userId, deletedAt: null, status: 'COMPLETED' },
  });

  if (!document) {
    return NextResponse.json(
      { error: 'Document not found or not yet processed' },
      { status: 404 }
    );
  }

  const extracted = document.aiExtractedData as ExtractedTaxData | null;
  const taxYear = body.taxYear ?? document.taxYear ?? new Date().getFullYear() - 1;

  const existing = await prisma.taxReturn.findUnique({
    where: { userId_taxYear: { userId, taxYear } },
  });

  const documents = [
    ...getExistingDocuments(existing?.aiGeneratedData).filter(
      (d) => d.documentId !== document.id
    ),
    { documentId: document.id, data: extracted },
  ];

  const aiGeneratedData = { documents } as Prisma.InputJsonValue;

  const taxReturn = await prisma.taxReturn.upsert({
    where: { userId_taxYear: { userId, taxYear } },
    create: {
      userId,
      taxYear,
      status: TaxReturnStatus.DRAFT,
      aiGeneratedData,
    },
    update: {
      aiGeneratedData,
    },
  });

  const { incomeSummary, deductibleSummary } = await aggregateUserIncome(
    userId,
    taxYear
  );

  return NextResponse.json({
    success: true,
    taxReturn,
    incomeSummary,
    deductibleSummary,
  });
}
