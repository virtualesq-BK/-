import { z } from 'zod';
import { TaxLineItemSchema } from '@/lib/tax/draft-types';

export const CpaModificationSchema = z.object({
  lineItems: z.array(TaxLineItemSchema),
  cpaNotes: z.string().optional(),
  approvedAt: z.string().optional(),
  reviewDurationMinutes: z.number().optional(),
});

export type CpaModification = z.infer<typeof CpaModificationSchema>;

export const Form8879Schema = z.object({
  taxpayerName: z.string(),
  taxpayerPin: z.string().length(5),
  cpaName: z.string(),
  cpaPtin: z.string(),
  taxYear: z.number(),
  agi: z.number(),
  totalTax: z.number(),
  refundAmount: z.number().optional(),
  amountOwed: z.number().optional(),
  signedAt: z.string(),
  efileConsent: z.literal(true),
});

export type Form8879 = z.infer<typeof Form8879Schema>;

export function calculateCpaCompensation(
  hourlyRate: number,
  durationMinutes: number,
  targetMinutes = 10
): number {
  const billableMinutes = Math.max(durationMinutes, targetMinutes * 0.5);
  return Math.round((hourlyRate / 60) * billableMinutes * 100) / 100;
}

export function generateForm8879(params: {
  taxpayerName: string;
  cpaName: string;
  cpaPtin: string;
  taxYear: number;
  agi: number;
  totalTax: number;
  pin?: string;
}): Form8879 {
  return Form8879Schema.parse({
    taxpayerName: params.taxpayerName,
    taxpayerPin: params.pin ?? String(Math.floor(10000 + Math.random() * 90000)),
    cpaName: params.cpaName,
    cpaPtin: params.cpaPtin,
    taxYear: params.taxYear,
    agi: params.agi,
    totalTax: params.totalTax,
    signedAt: new Date().toISOString(),
    efileConsent: true,
  });
}
