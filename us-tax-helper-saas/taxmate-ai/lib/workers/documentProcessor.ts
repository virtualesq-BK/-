import { TaxDocumentStatus, TaxDocumentType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getFileStorage } from '@/lib/storage';
import { extractTaxDocumentData } from '@/lib/ai/document-extraction';
import type { DocumentProcessJob } from '@/lib/documents/types';
import type { ExtractedTaxData } from '@/lib/documents/types';
import { aggregateUserIncome } from '@/lib/ai/aggregateIncome';
import { notifyDocumentProcessed } from '@/lib/notifications/notify';

function mapExtractedType(type: ExtractedTaxData['documentType']): TaxDocumentType {
  const map: Record<ExtractedTaxData['documentType'], TaxDocumentType> = {
    W2: 'W2',
    NEC1099: 'NEC1099',
    K1099: 'K1099',
    Receipt: 'Receipt',
    Other: 'Other',
  };
  return map[type] ?? 'Other';
}

export async function processDocumentJob(job: DocumentProcessJob): Promise<void> {
  const { documentId, userId, fileUrl, fileName, mimeType } = job;

  await prisma.taxDocument.update({
    where: { id: documentId },
    data: { status: TaxDocumentStatus.PROCESSING },
  });

  try {
    const storage = getFileStorage();
    const buffer = await storage.download(fileUrl);

    const extracted = await extractTaxDocumentData(buffer, mimeType);

    await prisma.taxDocument.update({
      where: { id: documentId },
      data: {
        status: TaxDocumentStatus.COMPLETED,
        documentType: mapExtractedType(extracted.documentType),
        taxYear: extracted.taxYear,
        aiExtractedData: extracted,
        fileName,
      },
    });

    await aggregateUserIncome(userId, extracted.taxYear);
    await notifyDocumentProcessed(userId, fileName);
  } catch (error) {
    console.error(`[documentProcessor] Failed ${documentId}:`, error);
    await prisma.taxDocument.update({
      where: { id: documentId },
      data: {
        status: TaxDocumentStatus.FAILED,
        aiExtractedData: {
          error: error instanceof Error ? error.message : 'Processing failed',
        },
      },
    });
    throw error;
  }
}
