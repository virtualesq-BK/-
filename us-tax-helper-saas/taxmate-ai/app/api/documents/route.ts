import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { TaxDocumentType } from '@prisma/client';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email, deletedAt: null },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { fileName, fileUrl, documentType, fileSize, taxYear } = body;

  const user = await prisma.user.findFirst({
    where: { email: session.user.email, deletedAt: null },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const document = await prisma.taxDocument.create({
    data: {
      userId: user.id,
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
