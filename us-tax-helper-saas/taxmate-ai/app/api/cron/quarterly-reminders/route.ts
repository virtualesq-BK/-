import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/verify-cron';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { notifyPaymentDue } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  logger.info('cron.quarterly_reminders.start');

  const users = await prisma.user.findMany({
    where: { role: 'USER', deletedAt: null, onboardingCompletedAt: { not: null } },
    include: {
      businessProfiles: { where: { deletedAt: null }, take: 1 },
      taxReturns: { where: { deletedAt: null }, orderBy: { taxYear: 'desc' }, take: 1 },
    },
    take: 500,
  });

  const now = new Date();
  const quarterLabels = ['Q1 (Apr 15)', 'Q2 (Jun 15)', 'Q3 (Sep 15)', 'Q4 (Jan 15)'];
  const qIndex = Math.floor(now.getMonth() / 3);
  const dueLabel = quarterLabels[qIndex] ?? 'Quarterly estimated tax';

  let sent = 0;
  for (const user of users) {
    const income = user.businessProfiles[0]?.incomeSummary as { estimatedTax?: number } | null;
    const draft = user.taxReturns[0]?.aiGeneratedData as {
      form1040Summary?: { estimatedTax?: number };
    } | null;
    const estimated = draft?.form1040Summary?.estimatedTax ?? income?.estimatedTax ?? 0;
    const amount = Math.round(estimated / 4);

    if (amount <= 0) continue;

    try {
      await notifyPaymentDue(user.id, dueLabel, amount);
      sent += 1;
    } catch (err) {
      logger.error('cron.quarterly_reminders.user_failed', { userId: user.id }, err as Error);
    }
  }

  logger.info('cron.quarterly_reminders.complete', { sent });

  return NextResponse.json({ ok: true, job: 'quarterly-reminders', notificationsSent: sent });
}
