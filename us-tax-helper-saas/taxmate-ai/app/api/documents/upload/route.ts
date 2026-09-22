import { NextResponse } from 'next/server';
import { TaxDocumentStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import { getFileStorage } from '@/lib/storage';
import { enqueueDocumentProcessing } from '@/lib/queue/document-queue';
import { isQueueConfigured } from '@/lib/queue/connection';
import { processDocumentJob } from '@/lib/workers/documentProcessor';
import { validateUploadFile } from '@/lib/documents/validate-upload';
import { inferDocumentTypeFromMime } from '@/lib/documents/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const taxYearRaw = formData.get('taxYear');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const validation = validateUploadFile(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const userId = auth.user.id;
  const taxYear = taxYearRaw
    ? parseInt(String(taxYearRaw), 10)
    : new Date().getFullYear() - 1;

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getFileStorage();
  const uploaded = await storage.upload(buffer, {
    fileName: file.name,
    mimeType: validation.mimeType,
    userId,
  });

  const document = await prisma.taxDocument.create({
    data: {
      userId,
      fileName: file.name,
      fileUrl: uploaded.url,
      fileSize: file.size,
      documentType: inferDocumentTypeFromMime(validation.mimeType),
      taxYear,
      status: TaxDocumentStatus.PENDING,
      aiExtractedData: {
        storageKey: uploaded.key,
        storageProvider: uploaded.provider,
        mimeType: validation.mimeType,
      },
    },
  });

  const jobPayload = {
    documentId: document.id,
    userId,
    fileUrl: uploaded.url,
    fileName: file.name,
    mimeType: validation.mimeType,
  };

  let jobId: string | null = null;
  let processingMode: 'queue' | 'inline' = 'queue';

  if (isQueueConfigured()) {
    jobId = await enqueueDocumentProcessing(jobPayload);
  }

  if (!jobId) {
    processingMode = 'inline';
    void processDocumentJob(jobPayload).catch((err) => {
      console.error('[upload] inline processing failed:', err);
    });
  }

  return NextResponse.json(
    {
      document,
      jobId,
      processingMode,
      message:
        processingMode === 'queue'
          ? 'Upload successful. Processing queued.'
          : 'Upload successful. Processing started.',
    },
    { status: 201 }
  );
}
