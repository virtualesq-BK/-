import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { isRedisConfigured } from '@/lib/ai/chat-history';
import { isQueueConfigured } from '@/lib/queue/connection';
import OpenAI from 'openai';
import { openAIClientOptions } from '@/lib/ai/openai-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CheckResult = {
  status: 'ok' | 'degraded' | 'error';
  latencyMs?: number;
  message?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const { latencyMs } = await timed(() => prisma.$queryRaw`SELECT 1`);
    return { status: 'ok', latencyMs };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'DB unreachable',
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  if (!isRedisConfigured()) {
    return { status: 'degraded', message: 'Redis not configured (memory fallback)' };
  }
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const { latencyMs } = await timed(() => redis.ping());
    return { status: 'ok', latencyMs };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Redis unreachable',
    };
  }
}

async function checkS3(): Promise<CheckResult> {
  const provider = process.env.STORAGE_PROVIDER ?? (
    process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : process.env.AWS_S3_BUCKET ? 's3' : null
  );

  if (!provider) {
    return { status: 'error', message: 'No storage provider configured' };
  }

  if (provider === 'vercel-blob') {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { status: 'error', message: 'BLOB_READ_WRITE_TOKEN missing' };
    }
    return { status: 'ok', message: 'Vercel Blob configured' };
  }

  if (!process.env.AWS_S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID) {
    return { status: 'error', message: 'AWS S3 credentials missing' };
  }

  try {
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const { latencyMs } = await timed(() =>
      client.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET! }))
    );
    return { status: 'ok', latencyMs };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'S3 unreachable',
    };
  }
}

async function checkOpenAI(): Promise<CheckResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'error', message: 'OPENAI_API_KEY missing' };
  }
  try {
    const client = new OpenAI(openAIClientOptions());
    const { latencyMs } = await timed(async () => {
      for await (const _ of client.models.list()) break;
    });
    void latencyMs;
    return { status: 'ok', latencyMs };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'OpenAI unreachable',
    };
  }
}

export async function GET() {
  const started = Date.now();

  const [database, redis, storage, openai] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkS3().catch(() => ({
      status: 'degraded' as const,
      message: 'Storage check skipped',
    })),
    checkOpenAI(),
  ]);

  const checks = {
    database,
    redis,
    storage,
    openai,
    queue: {
      status: isQueueConfigured() ? 'ok' : ('degraded' as const),
      message: isQueueConfigured() ? 'BullMQ configured' : 'Inline processing only',
    },
  };

  const hasError = Object.values(checks).some((c) => c.status === 'error');
  const hasDegraded = Object.values(checks).some((c) => c.status === 'degraded');

  const overall = hasError ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  const body = {
    status: overall,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    checks,
    responseTimeMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: hasError ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
