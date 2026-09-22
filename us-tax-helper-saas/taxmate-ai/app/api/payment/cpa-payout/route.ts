import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { processDuePayouts, scheduleCpaPayout, splitPayment } from '@/lib/payment/cpa-payout';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();

  if (body.action === 'process-due') {
    if (auth.user.role !== 'CPA' && process.env.ADMIN_EMAIL !== auth.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const results = await processDuePayouts();
    return NextResponse.json({ processed: results });
  }

  const { taxReturnId, totalAmount } = body;
  if (!taxReturnId || !totalAmount) {
    return NextResponse.json(
      { error: 'taxReturnId and totalAmount required' },
      { status: 400 }
    );
  }

  const taxReturn = await prisma.taxReturn.findFirst({
    where: { id: taxReturnId, deletedAt: null },
  });

  if (!taxReturn?.assignedCpaId) {
    return NextResponse.json({ error: 'No assigned CPA' }, { status: 400 });
  }

  const payment = await scheduleCpaPayout({
    taxReturnId,
    userId: taxReturn.userId,
    cpaId: taxReturn.assignedCpaId,
    totalAmount: Number(totalAmount),
  });

  const split = splitPayment(Number(totalAmount));

  return NextResponse.json({
    payment,
    split,
    message: 'Payout scheduled for 7 days after review completion.',
  });
}

export async function GET() {
  const auth = await requireRole('CPA');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payouts = await prisma.paymentTransaction.findMany({
    where: { cpaId: auth.user.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ payouts });
}
