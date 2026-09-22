import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await prisma.user.findFirst({
    where: { id: auth.user.id, deletedAt: null },
    include: {
      taxReturns: {
        where: { deletedAt: null },
        orderBy: { taxYear: 'desc' },
      },
    },
  });

  return NextResponse.json({ taxReturns: user?.taxReturns ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { taxYear, aiGeneratedData } = await req.json();

  const taxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: { userId: auth.user.id, taxYear },
    },
    create: {
      userId: auth.user.id,
      taxYear,
      aiGeneratedData,
      status: 'DRAFT',
    },
    update: {
      aiGeneratedData,
      status: 'DRAFT',
    },
  });

  return NextResponse.json({ taxReturn });
}
