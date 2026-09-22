import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { ExtractedTaxDataSchema } from '@/lib/documents/types';
import { Prisma, TaxDocumentType } from '@prisma/client';

type RouteContext = { params: { id: string } };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = context.params;

  const document = await prisma.taxDocument.findFirst({
    where: { id, userId: auth.user.id, deletedAt: null },
  });

  if (!document) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = context.params;
  const body = await req.json();

  const existing = await prisma.taxDocument.findFirst({
    where: { id, userId: auth.user.id, deletedAt: null },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let aiExtractedData: Prisma.InputJsonValue | undefined;
  if (body.aiExtractedData) {
    aiExtractedData = ExtractedTaxDataSchema.parse(
      body.aiExtractedData
    ) as Prisma.InputJsonValue;
  }

  const document = await prisma.taxDocument.update({
    where: { id },
    data: {
      ...(aiExtractedData !== undefined ? { aiExtractedData } : {}),
      documentType: body.documentType
        ? (body.documentType as TaxDocumentType)
        : undefined,
      taxYear: body.taxYear ? Number(body.taxYear) : undefined,
    },
  });

  return NextResponse.json({ document });
}
