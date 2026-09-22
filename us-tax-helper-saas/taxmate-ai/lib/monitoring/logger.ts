import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

const CPA_REVIEW_BUCKETS = [5, 10, 15, 20, 30, 45, 60];

function formatMessage(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'taxmate-ai',
    env: process.env.NODE_ENV,
    ...context,
  };
  return JSON.stringify(payload);
}

async function captureSentry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    if (error) {
      Sentry.captureException(error, { extra: context, tags: { level } });
    } else if (level === 'error' || level === 'warn') {
      Sentry.captureMessage(message, {
        level: level === 'error' ? 'error' : 'warning',
        extra: context,
      });
    }
  } catch {
    // Sentry optional
  }
}

export function log(level: LogLevel, message: string, context?: LogContext) {
  const line = formatMessage(level, message, context);

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  if (level === 'error' || level === 'warn') {
    void captureSentry(level, message, context);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext, err?: Error) => {
    log('error', msg, { ...ctx, error: err?.message, stack: err?.stack });
    void captureSentry('error', msg, ctx, err);
  },
};

/**
 * AI 응답 품질 — 사용자 피드백 저장
 */
export async function trackAiFeedback(params: {
  userId: string;
  rating: number;
  helpful?: boolean;
  comment?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}) {
  logger.info('ai.feedback', {
    userId: params.userId,
    rating: params.rating,
    helpful: params.helpful,
  });

  try {
    await prisma.aiFeedback.create({
      data: {
        userId: params.userId,
        rating: Math.min(5, Math.max(1, params.rating)),
        helpful: params.helpful,
        comment: params.comment,
        context: params.context,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    logger.error('ai.feedback.persist_failed', { userId: params.userId }, err as Error);
  }

  void captureSentry('info', 'AI feedback received', {
    rating: params.rating,
    helpful: params.helpful,
  });
}

/**
 * CPA 검증 시간 히스토그램 (버킷별 카운트)
 */
export async function trackCpaReviewDuration(params: {
  cpaId: string;
  taxReturnId: string;
  durationMinutes: number;
  targetMinutes?: number;
}) {
  const bucket =
    CPA_REVIEW_BUCKETS.find((b) => params.durationMinutes <= b) ??
    CPA_REVIEW_BUCKETS[CPA_REVIEW_BUCKETS.length - 1];

  const onTrack = params.durationMinutes <= (params.targetMinutes ?? 10);

  logger.info('cpa.review.duration', {
    cpaId: params.cpaId,
    taxReturnId: params.taxReturnId,
    durationMinutes: params.durationMinutes,
    bucket: `le_${bucket}m`,
    onTrack,
  });

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.metrics?.distribution?.('cpa.review.duration_minutes', params.durationMinutes, {
      unit: 'minute',
      tags: { on_track: String(onTrack) },
    });
  } catch {
    // metrics API may be unavailable
  }

  void captureSentry('info', 'CPA review completed', {
    durationMinutes: params.durationMinutes,
    bucket,
    onTrack,
  });
}

export async function getCpaReviewHistogram(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const returns = await prisma.taxReturn.findMany({
    where: {
      reviewCompletedAt: { gte: since },
      reviewStartedAt: { not: null },
      deletedAt: null,
    },
    select: { reviewStartedAt: true, reviewCompletedAt: true },
  });

  const histogram: Record<string, number> = {};
  for (const b of CPA_REVIEW_BUCKETS) {
    histogram[`le_${b}m`] = 0;
  }
  histogram['gt_60m'] = 0;

  for (const r of returns) {
    if (!r.reviewStartedAt || !r.reviewCompletedAt) continue;
    const mins = Math.round(
      (r.reviewCompletedAt.getTime() - r.reviewStartedAt.getTime()) / 60000
    );
    const bucket = CPA_REVIEW_BUCKETS.find((b) => mins <= b);
    if (bucket) histogram[`le_${bucket}m`] += 1;
    else histogram['gt_60m'] += 1;
  }

  return { total: returns.length, histogram };
}
