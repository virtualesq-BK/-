import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const cpas = await prisma.user.findMany({
    where: {
      role: 'CPA',
      isVerified: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      cpaFirmName: true,
      cpaBio: true,
      hourlyRate: true,
      isVerified: true,
    },
  });

  return NextResponse.json({ cpas });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cpaId, taxReturnId } = await req.json();

  const taxReturn = await prisma.taxReturn.update({
    where: { id: taxReturnId },
    data: {
      assignedCpaId: cpaId,
      status: 'CPA_REVIEW',
    },
  });

  return NextResponse.json({ taxReturn });
}
