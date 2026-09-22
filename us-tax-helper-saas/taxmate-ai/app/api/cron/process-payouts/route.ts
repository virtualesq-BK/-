import { NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/verify-cron';
import { logger } from '@/lib/monitoring/logger';
import { processDuePayouts } from '@/lib/payment/cpa-payout';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const unauthorized = verifyCronRequest(req);
  if (unauthorized) return unauthorized;

  logger.info('cron.process_payouts.start');
  const results = await processDuePayouts();
  logger.info('cron.process_payouts.complete', { count: results.length });

  return NextResponse.json({ ok: true, job: 'process-payouts', processed: results });
}
