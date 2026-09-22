import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/verify-cron';
import { logger } from '@/lib/monitoring/logger';
import { prisma } from '@/lib/db/prisma';
import { aggregateUserIncome } from '@/lib/ai/aggregateIncome';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  logger.info('cron.weekly_tax_update.start');

  const taxYear = new Date().getFullYear() - 1;
  const users = await prisma.user.findMany({
    where: { role: 'USER', deletedAt: null, onboardingCompletedAt: { not: null } },
    select: { id: true },
    take: 500,
  });

  let processed = 0;
  for (const user of users) {
    try {
      await aggregateUserIncome(user.id, taxYear);
      processed += 1;
    } catch (err) {
      logger.error('cron.weekly_tax_update.user_failed', { userId: user.id }, err as Error);
    }
  }

  logger.info('cron.weekly_tax_update.complete', { processed, total: users.length });

  return NextResponse.json({
    ok: true,
    job: 'weekly-tax-update',
    processed,
    total: users.length,
  });
}
