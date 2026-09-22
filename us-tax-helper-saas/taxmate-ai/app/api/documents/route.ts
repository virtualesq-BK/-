import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { TaxDocumentType } from '@prisma/client';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id, deletedAt: null },
    include: {
      taxDocuments: {
        where: { deletedAt: null },
        orderBy: { uploadDate: 'desc' },
      },
    },
  });

  return NextResponse.json({ documents: user?.taxDocuments ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { fileName, fileUrl, documentType, fileSize, taxYear } = body;

  const document = await prisma.taxDocument.create({
    data: {
      userId: auth.user.id,
      fileName,
      fileUrl,
      documentType: (documentType as TaxDocumentType) ?? TaxDocumentType.Other,
      fileSize: fileSize ?? 0,
      taxYear: taxYear ?? new Date().getFullYear() - 1,
      status: 'PENDING',
    },
  });

  return NextResponse.json({ document }, { status: 201 });
}
