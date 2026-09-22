import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { email: session.user.email, deletedAt: null },
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { taxYear, aiGeneratedData } = await req.json();

  const user = await prisma.user.findFirst({
    where: { email: session.user.email, deletedAt: null },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const taxReturn = await prisma.taxReturn.upsert({
    where: {
      userId_taxYear: { userId: user.id, taxYear },
    },
    create: {
      userId: user.id,
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
