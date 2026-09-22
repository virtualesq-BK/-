/**
 * BullMQ document processing worker
 *
 * Usage: npm run worker:documents
 * Requires: REDIS_URL, OPENAI_API_KEY, storage + DATABASE_URL
 */

import { Worker } from 'bullmq';
import { getRedisConnection } from '@/lib/queue/connection';
import { DOCUMENT_QUEUE_NAME } from '@/lib/queue/document-queue';
import { processDocumentJob } from './documentProcessor';
import type { DocumentProcessJob } from '@/lib/documents/types';

console.log('Starting document processing worker...');

const worker = new Worker<DocumentProcessJob>(
  DOCUMENT_QUEUE_NAME,
  async (job) => {
    console.log(`Processing job ${job.id} — document ${job.data.documentId}`);
    await processDocumentJob(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY ?? 2),
  }
);

worker.on('completed', (job) => {
  console.log(`✓ Completed ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`✗ Failed ${job?.id}:`, err.message);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
