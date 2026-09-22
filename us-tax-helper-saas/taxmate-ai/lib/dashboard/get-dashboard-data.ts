import { prisma } from '@/lib/db/prisma';
import type { TaxDraft } from '@/lib/tax/draft-types';
import type { IncomeSummary } from '@/lib/ai/aggregateIncome';

export type QuarterlyDeadline = {
  quarter: string;
  dueDate: string;
  daysUntil: number;
  estimatedAmount: number;
};

export type DashboardTask = {
  id: string;
  type: 'upload' | 'confirm' | 'review' | 'cpa';
  title: string;
  description: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
};

function getQuarterlyDeadlines(taxYear: number, estimatedAnnualTax: number): QuarterlyDeadline[] {
  const deadlines = [
    { quarter: 'Q1', month: 3, day: 15 },
    { quarter: 'Q2', month: 5, day: 15 },
    { quarter: 'Q3', month: 8, day: 15 },
    { quarter: 'Q4', month: 0, day: 15, nextYear: true },
  ];

  const quarterlyAmount = Math.round(estimatedAnnualTax / 4);
  const now = new Date();

  return deadlines.map((d) => {
    const year = d.nextYear ? taxYear + 1 : taxYear;
    const due = new Date(year, d.month, d.day);
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      quarter: d.quarter,
      dueDate: due.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      daysUntil,
      estimatedAmount: quarterlyAmount,
    };
  });
}

export async function getDashboardData(userId: string) {
  const taxYear = new Date().getFullYear() - 1;

  const [user, profile, taxReturn, documents, auditScores, messages, notifications] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          subscriptionTier: true,
          onboardingCompletedAt: true,
        },
      }),
      prisma.businessProfile.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.taxReturn.findUnique({
        where: { userId_taxYear: { userId, taxYear } },
        include: {
          assignedCpa: { select: { name: true, cpaFirmName: true } },
          cpaMatchRequest: true,
        },
      }),
      prisma.taxDocument.findMany({
        where: { userId, deletedAt: null },
        orderBy: { uploadDate: 'desc' },
        take: 20,
      }),
      prisma.auditRiskScore.findMany({
        where: { userId, deletedAt: null },
        orderBy: { generatedAt: 'desc' },
        take: 2,
      }),
      prisma.message.findMany({
        where: { userId, deletedAt: null, role: 'CPA' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

  const draft = taxReturn?.aiGeneratedData as TaxDraft | null;
  const incomeSummary = profile?.incomeSummary as IncomeSummary | null;

  const estimatedTax = draft?.form1040Summary?.estimatedTax ?? 0;
  const federalWithheld = incomeSummary?.totalFederalWithheld ?? 0;
  const refundOrOwed = federalWithheld - estimatedTax;

  const latestAudit = auditScores[0];
  const previousAudit = auditScores[1];
  const auditSpike =
    latestAudit &&
    previousAudit &&
    latestAudit.overallScore - previousAudit.overallScore >= 15;

  const tasks: DashboardTask[] = [];

  const pendingDocs = documents.filter((d) => d.status === 'PENDING' || d.status === 'PROCESSING');
  if (pendingDocs.length > 0) {
    tasks.push({
      id: 'docs-processing',
      type: 'upload',
      title: `${pendingDocs.length} document(s) processing`,
      description: 'Wait for AI extraction to complete',
      href: '/documents',
      priority: 'medium',
    });
  }

  if (documents.length < 2) {
    tasks.push({
      id: 'upload-docs',
      type: 'upload',
      title: 'Upload tax documents',
      description: 'W-2, 1099, or prior year returns recommended',
      href: '/documents',
      priority: 'high',
    });
  }

  draft?.scheduleC.lineItems
    .filter((l) => l.requiresUserConfirmation)
    .slice(0, 3)
    .forEach((line, i) => {
      tasks.push({
        id: `confirm-${i}`,
        type: 'confirm',
        title: `Confirm: ${line.description}`,
        description: `Confidence ${line.confidence}% — review before filing`,
        href: '/review',
        priority: 'high',
      });
    });

  if (!taxReturn || taxReturn.status === 'DRAFT') {
    tasks.push({
      id: 'generate-draft',
      type: 'review',
      title: 'Generate AI tax draft',
      description: 'Create Schedule C and estimated return',
      href: '/review',
      priority: 'high',
    });
  }

  if (taxReturn?.status === 'AI_REVIEW' && !taxReturn.cpaMatchRequest) {
    tasks.push({
      id: 'cpa-match',
      type: 'cpa',
      title: 'Match with a CPA',
      description: 'Get your return verified in ~10 minutes',
      href: '/cpa-match',
      priority: 'medium',
    });
  }

  const quarterlyDeadlines = getQuarterlyDeadlines(taxYear + 1, estimatedTax);
  const upcomingDue = quarterlyDeadlines.find((d) => d.daysUntil >= 0 && d.daysUntil <= 30);

  const cpaInteractions = messages.map((m) => ({
    id: m.id,
    content: m.content.slice(0, 120),
    createdAt: m.createdAt.toISOString(),
    role: m.role,
  }));

  return {
    taxYear,
    filingStatus: taxReturn?.status ?? 'DRAFT',
    subscriptionTier: user?.subscriptionTier ?? 'FREE',
    taxSummary: {
      estimatedTax,
      federalWithheld,
      refundOrOwed,
      isRefund: refundOrOwed > 0,
      netScheduleCIncome: draft?.scheduleC?.netProfit ?? incomeSummary?.netScheduleCIncome ?? 0,
    },
    auditRisk: {
      score: latestAudit?.overallScore ?? 0,
      previousScore: previousAudit?.overallScore,
      spike: auditSpike,
      mitigation: (latestAudit?.mitigationSuggestions as string[]) ?? [],
    },
    documentCount: documents.length,
    tasks,
    quarterlyDeadlines,
    upcomingDue,
    cpa: taxReturn?.assignedCpa
      ? {
          name: taxReturn.assignedCpa.name,
          firm: taxReturn.assignedCpa.cpaFirmName,
          matchStatus: taxReturn.cpaMatchRequest?.status,
        }
      : null,
    cpaInteractions,
    unreadNotifications: notifications,
  };
}
