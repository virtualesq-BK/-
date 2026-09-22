import { z } from 'zod';

export const TaxLineItemSchema = z.object({
  form: z.enum(['ScheduleC', 'Form8995', 'Form1040', 'ScheduleSE']),
  line: z.string(),
  description: z.string(),
  amount: z.number(),
  confidence: z.number().min(0).max(100),
  source: z.enum(['document', 'chat', 'industry_standard', 'ai_estimate', 'manual_input']),
  requiresUserConfirmation: z.boolean(),
  requiresCpaReview: z.boolean(),
});

export const TaxDraftSchema = z.object({
  taxYear: z.number(),
  generatedAt: z.string(),
  scheduleC: z.object({
    grossReceipts: z.number(),
    totalExpenses: z.number(),
    netProfit: z.number(),
    lineItems: z.array(TaxLineItemSchema),
  }),
  form8995: z.object({
    qbiDeduction: z.number(),
    taxableIncome: z.number(),
    lineItems: z.array(TaxLineItemSchema),
  }),
  form1040Summary: z.object({
    totalIncome: z.number(),
    adjustedGrossIncome: z.number(),
    estimatedTax: z.number(),
    lineItems: z.array(TaxLineItemSchema),
  }),
  summary: z.object({
    autoIncludedCount: z.number(),
    userConfirmCount: z.number(),
    cpaReviewCount: z.number(),
  }),
});

export type TaxLineItem = z.infer<typeof TaxLineItemSchema>;
export type TaxDraft = z.infer<typeof TaxDraftSchema>;

export function classifyConfidence(confidence: number): {
  requiresUserConfirmation: boolean;
  requiresCpaReview: boolean;
} {
  if (confidence >= 90) {
    return { requiresUserConfirmation: false, requiresCpaReview: false };
  }
  if (confidence >= 70) {
    return { requiresUserConfirmation: true, requiresCpaReview: false };
  }
  return { requiresUserConfirmation: true, requiresCpaReview: true };
}

export function buildLineItem(
  partial: Omit<TaxLineItem, 'requiresUserConfirmation' | 'requiresCpaReview'> & {
    confidence: number;
  }
): TaxLineItem {
  const flags = classifyConfidence(partial.confidence);
  return { ...partial, ...flags };
}
