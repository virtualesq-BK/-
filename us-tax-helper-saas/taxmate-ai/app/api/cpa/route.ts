import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
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
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
