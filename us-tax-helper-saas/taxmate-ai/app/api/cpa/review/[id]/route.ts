import { NextResponse } from 'next/server';
import { TaxReturnStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { requireRole } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import {
  CpaModificationSchema,
  calculateCpaCompensation,
  generateForm8879,
} from '@/lib/cpa/review';
import { scheduleCpaPayout } from '@/lib/payment/cpa-payout';
import type { TaxDraft } from '@/lib/tax/draft-types';

type RouteContext = { params: { id: string } };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireRole('CPA');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: context.params.id,
      assignedCpaId: auth.user.id,
      deletedAt: null,
    },
    include: {
      user: {
        include: {
          businessProfiles: { where: { deletedAt: null }, take: 1 },
        },
      },
      cpaMatchRequest: true,
    },
  });

  if (!taxReturn) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const documents = await prisma.taxDocument.findMany({
    where: {
      userId: taxReturn.userId,
      taxYear: taxReturn.taxYear,
      deletedAt: null,
    },
  });

  const reviewStartedAt = taxReturn.reviewStartedAt ?? new Date();
  const elapsedMinutes = Math.round(
    (Date.now() - reviewStartedAt.getTime()) / 60000
  );

  return NextResponse.json({
    taxReturn,
    documents,
    draft: taxReturn.aiGeneratedData as TaxDraft | null,
    cpaModifications: taxReturn.cpaModifications,
    form8879: taxReturn.form8879,
    review: {
      startedAt: reviewStartedAt,
      elapsedMinutes,
      targetMinutes: 10,
      onTrack: elapsedMinutes <= 10,
    },
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await requireRole('CPA');
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: context.params.id,
      assignedCpaId: auth.user.id,
      deletedAt: null,
    },
    include: { user: true },
  });

  if (!taxReturn) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (body.action === 'save') {
    const modifications = CpaModificationSchema.parse(body.cpaModifications);
    const updated = await prisma.taxReturn.update({
      where: { id: taxReturn.id },
      data: {
        cpaModifications: modifications as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ taxReturn: updated });
  }

  if (body.action === 'approve') {
    const modifications = CpaModificationSchema.parse(
      body.cpaModifications ?? taxReturn.cpaModifications ?? { lineItems: [] }
    );

    const reviewStartedAt = taxReturn.reviewStartedAt ?? new Date();
    const reviewCompletedAt = new Date();
    const durationMinutes = Math.round(
      (reviewCompletedAt.getTime() - reviewStartedAt.getTime()) / 60000
    );

    modifications.reviewDurationMinutes = durationMinutes;
    modifications.approvedAt = reviewCompletedAt.toISOString();

    const draft = taxReturn.aiGeneratedData as TaxDraft | null;
    const agi = draft?.form1040Summary?.adjustedGrossIncome ?? 0;
    const totalTax = draft?.form1040Summary?.estimatedTax ?? 0;

    const form8879 = generateForm8879({
      taxpayerName: taxReturn.user.name ?? taxReturn.user.email ?? 'Taxpayer',
      cpaName: auth.user.name ?? 'CPA',
      cpaPtin: auth.user.cpaLicenseNumber ?? 'P00000000',
      taxYear: taxReturn.taxYear,
      agi,
      totalTax,
      pin: body.taxpayerPin,
    });

    const hourlyRate = Number(auth.user.hourlyRate ?? 150);
    const compensation = calculateCpaCompensation(hourlyRate, durationMinutes);

    const updated = await prisma.taxReturn.update({
      where: { id: taxReturn.id },
      data: {
        status: TaxReturnStatus.COMPLETED,
        cpaModifications: modifications as unknown as Prisma.InputJsonValue,
        form8879: form8879 as unknown as Prisma.InputJsonValue,
        reviewCompletedAt,
        cpaCompensation: compensation,
      },
    });

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        cpaReviewCount: { increment: 1 },
        cpaAvgResponseMin: Math.round(
          (auth.user.cpaAvgResponseMin + durationMinutes) / 2
        ),
      },
    });

    const { trackCpaReviewDuration } = await import('@/lib/monitoring/logger');
    await trackCpaReviewDuration({
      cpaId: auth.user.id,
      taxReturnId: taxReturn.id,
      durationMinutes,
      targetMinutes: 10,
    });

    const reviewFee = Number(body.reviewFee ?? 99);
    await scheduleCpaPayout({
      taxReturnId: taxReturn.id,
      userId: taxReturn.userId,
      cpaId: auth.user.id,
      totalAmount: reviewFee,
      description: `CPA review — ${durationMinutes} min`,
    });

    return NextResponse.json({
      taxReturn: updated,
      form8879,
      compensation,
      durationMinutes,
      message: 'Return approved and Form 8879 generated.',
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
