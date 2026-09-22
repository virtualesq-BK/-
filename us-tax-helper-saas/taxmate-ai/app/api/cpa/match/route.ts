import { NextResponse } from 'next/server';
import { CpaMatchStatus, TaxReturnStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import {
  calculateComplexity,
  findMatchingCpas,
  notifyCpaMatch,
} from '@/lib/cpa/matching';
import type { TaxDraft } from '@/lib/tax/draft-types';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { taxReturnId, cpaId } = await req.json();
  if (!taxReturnId) {
    return NextResponse.json({ error: 'taxReturnId is required' }, { status: 400 });
  }

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: taxReturnId,
      userId: auth.user.id,
      deletedAt: null,
      status: { in: ['AI_REVIEW', 'DRAFT', 'CPA_REVIEW'] },
    },
    include: {
      user: { include: { businessProfiles: { where: { deletedAt: null }, take: 1 } } },
      auditRiskScores: { orderBy: { generatedAt: 'desc' }, take: 1 },
    },
  });

  if (!taxReturn) {
    return NextResponse.json({ error: 'Tax return not found' }, { status: 404 });
  }

  const profile = taxReturn.user.businessProfiles[0];
  const draft = taxReturn.aiGeneratedData as TaxDraft | null;
  const cpaReviewLineCount = draft?.summary?.cpaReviewCount ?? 0;

  const documentCount = await prisma.taxDocument.count({
    where: { userId: auth.user.id, taxYear: taxReturn.taxYear, deletedAt: null },
  });

  const complexity = calculateComplexity({
    documentCount,
    cpaReviewLineCount,
    auditRiskScore: taxReturn.auditRiskScores[0]?.overallScore,
  });

  const candidates = await findMatchingCpas({
    userState: profile?.state,
    industry: profile?.industry,
    complexity,
    limit: 5,
  });

  const selectedCpa = cpaId
    ? candidates.find((c) => c.cpa.id === cpaId) ?? candidates[0]
    : candidates[0];

  if (!selectedCpa) {
    return NextResponse.json({ error: 'No available CPA found' }, { status: 404 });
  }

  const matchRequest = await prisma.cpaMatchRequest.upsert({
    where: { taxReturnId },
    create: {
      taxReturnId,
      userId: auth.user.id,
      cpaId: selectedCpa.cpa.id,
      status: CpaMatchStatus.PENDING,
      matchScore: selectedCpa.matchScore,
      complexity,
      userState: profile?.state,
      industry: profile?.industry,
      notifiedAt: new Date(),
    },
    update: {
      cpaId: selectedCpa.cpa.id,
      status: CpaMatchStatus.PENDING,
      matchScore: selectedCpa.matchScore,
      notifiedAt: new Date(),
    },
  });

  await notifyCpaMatch(
    selectedCpa.cpa.id,
    taxReturnId,
    auth.user.name ?? auth.user.email ?? 'Taxpayer'
  );

  return NextResponse.json({
    matchRequest,
    candidates,
    selectedCpa,
    message: 'CPA notified. Awaiting acceptance.',
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { matchRequestId, action } = await req.json();

  const matchRequest = await prisma.cpaMatchRequest.findUnique({
    where: { id: matchRequestId },
    include: { taxReturn: true, cpa: true, user: true },
  });

  if (!matchRequest) {
    return NextResponse.json({ error: 'Match request not found' }, { status: 404 });
  }

  if (auth.user.role !== 'CPA' || matchRequest.cpaId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (action === 'accept') {
    const [updatedMatch, updatedReturn] = await prisma.$transaction([
      prisma.cpaMatchRequest.update({
        where: { id: matchRequestId },
        data: { status: CpaMatchStatus.ACCEPTED, acceptedAt: new Date() },
      }),
      prisma.taxReturn.update({
        where: { id: matchRequest.taxReturnId },
        data: {
          assignedCpaId: auth.user.id,
          status: TaxReturnStatus.CPA_REVIEW,
          reviewStartedAt: new Date(),
        },
      }),
    ]);

    const { notifyUserMatchAccepted } = await import('@/lib/cpa/matching');
    await notifyUserMatchAccepted(
      matchRequest.userId,
      matchRequest.taxReturnId,
      auth.user.name ?? 'Your CPA'
    );

    return NextResponse.json({
      matchRequest: updatedMatch,
      taxReturn: updatedReturn,
      reviewUrl: `/cpa/review/${matchRequest.taxReturnId}`,
    });
  }

  if (action === 'decline') {
    const updated = await prisma.cpaMatchRequest.update({
      where: { id: matchRequestId },
      data: { status: CpaMatchStatus.DECLINED, declinedAt: new Date() },
    });
    return NextResponse.json({ matchRequest: updated });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const taxReturnId = searchParams.get('taxReturnId');

  if (taxReturnId) {
    const match = await prisma.cpaMatchRequest.findUnique({
      where: { taxReturnId },
      include: {
        cpa: {
          select: {
            id: true,
            name: true,
            cpaFirmName: true,
            cpaRating: true,
            cpaAvgResponseMin: true,
            hourlyRate: true,
          },
        },
      },
    });
    return NextResponse.json({ matchRequest: match });
  }

  if (auth.user.role === 'CPA') {
    const pending = await prisma.cpaMatchRequest.findMany({
      where: { cpaId: auth.user.id, status: 'PENDING' },
      include: {
        taxReturn: { select: { id: true, taxYear: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ pending });
  }

  const profile = await prisma.businessProfile.findFirst({
    where: { userId: auth.user.id, deletedAt: null },
  });

  const candidates = await findMatchingCpas({
    userState: profile?.state,
    industry: profile?.industry,
    complexity: 'medium',
  });

  return NextResponse.json({ candidates });
}
