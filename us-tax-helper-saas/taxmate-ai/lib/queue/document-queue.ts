import { Queue } from 'bullmq';
import { getRedisConnection, isQueueConfigured } from './connection';
import type { DocumentProcessJob } from '@/lib/documents/types';

export const DOCUMENT_QUEUE_NAME = 'tax-document-processing';

let documentQueue: Queue<DocumentProcessJob> | null = null;

export function getDocumentQueue(): Queue<DocumentProcessJob> {
  if (!documentQueue) {
    documentQueue = new Queue<DocumentProcessJob>(DOCUMENT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return documentQueue;
}

export async function enqueueDocumentProcessing(
  job: DocumentProcessJob
): Promise<string | null> {
  if (!isQueueConfigured()) {
    return null;
  }
  const queue = getDocumentQueue();
  const added = await queue.add('process-document', job, {
    jobId: `doc-${job.documentId}`,
  });
  return added.id ?? null;
}
