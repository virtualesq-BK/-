import { prisma } from '@/lib/db/prisma';
import type { User } from '@prisma/client';

export type CpaMatchCandidate = {
  cpa: Pick<
    User,
    | 'id'
    | 'name'
    | 'cpaFirmName'
    | 'cpaBio'
    | 'hourlyRate'
    | 'cpaRating'
    | 'cpaReviewCount'
    | 'cpaAvgResponseMin'
    | 'cpaState'
    | 'cpaSpecialties'
  >;
  matchScore: number;
  estimatedPrice: number;
};

export function calculateComplexity(params: {
  documentCount: number;
  cpaReviewLineCount: number;
  auditRiskScore?: number;
}): 'low' | 'medium' | 'high' {
  let score = 0;
  if (params.documentCount > 10) score += 2;
  else if (params.documentCount > 5) score += 1;
  if (params.cpaReviewLineCount > 5) score += 2;
  else if (params.cpaReviewLineCount > 2) score += 1;
  if ((params.auditRiskScore ?? 0) >= 70) score += 2;
  else if ((params.auditRiskScore ?? 0) >= 50) score += 1;

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

export function scoreCpa(
  cpa: User,
  params: {
    userState?: string | null;
    industry?: string | null;
    complexity: 'low' | 'medium' | 'high';
  }
): number {
  let score = cpa.cpaRating * 20;

  if (params.userState && cpa.cpaState === params.userState) {
    score += 25;
  }

  if (
    params.industry &&
    cpa.cpaSpecialties.some(
      (s) => s.toLowerCase() === params.industry!.toLowerCase()
    )
  ) {
    score += 20;
  }

  score += Math.max(0, 30 - cpa.cpaAvgResponseMin);

  const hourly = Number(cpa.hourlyRate ?? 150);
  const complexityMultiplier =
    params.complexity === 'high' ? 1.5 : params.complexity === 'medium' ? 1.2 : 1;
  const pricePenalty = Math.max(0, 20 - hourly / 10);
  score += pricePenalty;

  void complexityMultiplier;
  return Math.min(100, Math.round(score));
}

export async function findMatchingCpas(params: {
  userState?: string | null;
  industry?: string | null;
  complexity: 'low' | 'medium' | 'high';
  limit?: number;
}): Promise<CpaMatchCandidate[]> {
  const cpas = await prisma.user.findMany({
    where: {
      role: 'CPA',
      isVerified: true,
      deletedAt: null,
    },
  });

  const ranked = cpas
    .map((cpa) => {
      const matchScore = scoreCpa(cpa, params);
      const hourly = Number(cpa.hourlyRate ?? 150);
      const minutes =
        params.complexity === 'high' ? 20 : params.complexity === 'medium' ? 12 : 8;
      const estimatedPrice = Math.round((hourly / 60) * minutes);

      return {
        cpa: {
          id: cpa.id,
          name: cpa.name,
          cpaFirmName: cpa.cpaFirmName,
          cpaBio: cpa.cpaBio,
          hourlyRate: cpa.hourlyRate,
          cpaRating: cpa.cpaRating,
          cpaReviewCount: cpa.cpaReviewCount,
          cpaAvgResponseMin: cpa.cpaAvgResponseMin,
          cpaState: cpa.cpaState,
          cpaSpecialties: cpa.cpaSpecialties,
        },
        matchScore,
        estimatedPrice,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return ranked.slice(0, params.limit ?? 5);
}

export async function notifyCpaMatch(cpaId: string, taxReturnId: string, userName: string) {
  await prisma.message.create({
    data: {
      userId: cpaId,
      role: 'CPA',
      content: `New review request from ${userName}. Please respond within 10 minutes.`,
      taxReturnId,
      metadata: {
        type: 'CPA_MATCH_NOTIFICATION',
        taxReturnId,
        notifiedAt: new Date().toISOString(),
      },
    },
  });

  if (process.env.RESEND_API_KEY) {
    const cpa = await prisma.user.findUnique({ where: { id: cpaId } });
    if (cpa?.email) {
      console.log(`[email] CPA match notification → ${cpa.email} for return ${taxReturnId}`);
    }
  }
}

export async function notifyUserMatchAccepted(
  userId: string,
  taxReturnId: string,
  cpaName: string
) {
  const { notifyCpaAccepted } = await import('@/lib/notifications/notify');
  await notifyCpaAccepted(userId, cpaName);
  await prisma.message.create({
    data: {
      userId,
      role: 'USER',
      content: `${cpaName} accepted your return for review. Status: CPA Review.`,
      taxReturnId,
      metadata: {
        type: 'CPA_MATCH_ACCEPTED',
        acceptedAt: new Date().toISOString(),
      },
    },
  });
}
