import { prisma } from '@/lib/db/prisma';
import type { ExtractedTaxData } from '@/lib/documents/types';
import { Prisma } from '@prisma/client';

export type IncomeSummary = {
  taxYear: number;
  totalW2Wages: number;
  totalFederalWithheld: number;
  total1099Nec: number;
  total1099K: number;
  totalReceiptExpenses: number;
  grossBusinessIncome: number;
  estimatedDeductibleExpenses: number;
  netScheduleCIncome: number;
  documentCount: number;
  lastUpdated: string;
};

export type DeductibleSummary = {
  taxYear: number;
  categories: Record<string, number>;
  totalDeductible: number;
  suggestedScheduleCLines: string[];
};

function asNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  return 0;
}

function parseExtracted(data: unknown): Partial<ExtractedTaxData> | null {
  if (!data || typeof data !== 'object') return null;
  return data as Partial<ExtractedTaxData>;
}

export function computeIncomeFromDocuments(
  documents: Array<{ aiExtractedData: unknown }>,
  taxYear: number
): { incomeSummary: IncomeSummary; deductibleSummary: DeductibleSummary } {
  let totalW2Wages = 0;
  let totalFederalWithheld = 0;
  let total1099Nec = 0;
  let total1099K = 0;
  let totalReceiptExpenses = 0;
  const categories: Record<string, number> = {};

  for (const doc of documents) {
    const extracted = parseExtracted(doc.aiExtractedData);
    if (!extracted || extracted.taxYear !== taxYear) continue;

    totalW2Wages += asNumber(extracted.wages);
    totalFederalWithheld += asNumber(extracted.federalTaxWithheld);
    total1099Nec += asNumber(extracted.nonemployeeCompensation);
    total1099K += asNumber(extracted.grossAmount);

    const expense = asNumber(extracted.expenseAmount);
    if (expense > 0) {
      totalReceiptExpenses += expense;
      const cat = extracted.expenseCategory ?? 'Uncategorized';
      categories[cat] = (categories[cat] ?? 0) + expense;
    }
  }

  const grossBusinessIncome = total1099Nec + total1099K;
  const estimatedDeductibleExpenses = totalReceiptExpenses;
  const netScheduleCIncome = Math.max(
    0,
    grossBusinessIncome - estimatedDeductibleExpenses
  );

  const incomeSummary: IncomeSummary = {
    taxYear,
    totalW2Wages,
    totalFederalWithheld,
    total1099Nec,
    total1099K,
    totalReceiptExpenses,
    grossBusinessIncome,
    estimatedDeductibleExpenses,
    netScheduleCIncome,
    documentCount: documents.length,
    lastUpdated: new Date().toISOString(),
  };

  const deductibleSummary: DeductibleSummary = {
    taxYear,
    categories,
    totalDeductible: estimatedDeductibleExpenses,
    suggestedScheduleCLines: Object.keys(categories).map(
      (cat) => `Line 27a — ${cat}`
    ),
  };

  return { incomeSummary, deductibleSummary };
}

export async function aggregateUserIncome(
  userId: string,
  taxYear?: number
): Promise<{ incomeSummary: IncomeSummary; deductibleSummary: DeductibleSummary }> {
  const year = taxYear ?? new Date().getFullYear() - 1;

  const documents = await prisma.taxDocument.findMany({
    where: {
      userId,
      taxYear: year,
      status: 'COMPLETED',
      deletedAt: null,
    },
  });

  const { incomeSummary, deductibleSummary } = computeIncomeFromDocuments(
    documents,
    year
  );

  const profile = await prisma.businessProfile.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });

  if (profile) {
    await prisma.businessProfile.update({
      where: { id: profile.id },
      data: {
        incomeSummary: incomeSummary as unknown as Prisma.InputJsonValue,
        deductibleSummary: deductibleSummary as unknown as Prisma.InputJsonValue,
        annualRevenue: incomeSummary.grossBusinessIncome,
      },
    });
  }

  const taxReturn = await prisma.taxReturn.findUnique({
    where: { userId_taxYear: { userId, taxYear: year } },
  });

  if (taxReturn) {
    await prisma.taxReturn.update({
      where: { id: taxReturn.id },
      data: {
        aiGeneratedData: {
          ...(typeof taxReturn.aiGeneratedData === 'object' &&
          taxReturn.aiGeneratedData !== null
            ? taxReturn.aiGeneratedData
            : {}),
          incomeSummary,
          deductibleSummary,
        },
      },
    });
  }

  return { incomeSummary, deductibleSummary };
}
