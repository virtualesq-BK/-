import { z } from 'zod';
import type { TaxDocumentType } from '@prisma/client';

export const ExtractedTaxDataSchema = z.object({
  documentType: z.enum(['W2', 'NEC1099', 'K1099', 'Receipt', 'Other']),
  taxYear: z.number().int().min(2000).max(2100),
  payerName: z.string().optional(),
  payerTin: z.string().optional(),
  recipientName: z.string().optional(),
  recipientTin: z.string().optional(),
  // W-2
  wages: z.number().optional(),
  federalTaxWithheld: z.number().optional(),
  socialSecurityWages: z.number().optional(),
  // 1099-NEC
  nonemployeeCompensation: z.number().optional(),
  // 1099-K
  grossAmount: z.number().optional(),
  // Receipt
  merchantName: z.string().optional(),
  expenseAmount: z.number().optional(),
  expenseCategory: z.string().optional(),
  expenseDate: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  rawTextPreview: z.string().optional(),
});

export type ExtractedTaxData = z.infer<typeof ExtractedTaxDataSchema>;

export type DocumentProcessJob = {
  documentId: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
};

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export function inferDocumentTypeFromMime(mime: string): TaxDocumentType {
  if (mime === 'application/pdf') return 'Other';
  return 'Receipt';
}
