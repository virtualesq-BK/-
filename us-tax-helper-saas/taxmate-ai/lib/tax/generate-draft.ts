import OpenAI from 'openai';
import { prisma } from '@/lib/db/prisma';
import { aggregateUserIncome } from '@/lib/ai/aggregateIncome';
import {
  buildLineItem,
  TaxDraftSchema,
  type TaxDraft,
  type TaxLineItem,
} from '@/lib/tax/draft-types';
import { getIndustryDeductionRate } from '@/lib/tax/industry-rates';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateTaxDraft(
  userId: string,
  taxYear: number
): Promise<TaxDraft> {
  const [profile, documents, messages, income] = await Promise.all([
    prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.taxDocument.findMany({
      where: { userId, taxYear, status: 'COMPLETED', deletedAt: null },
    }),
    prisma.message.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    aggregateUserIncome(userId, taxYear),
  ]);

  const grossReceipts = income.incomeSummary.grossBusinessIncome;
  const docExpenses = income.incomeSummary.estimatedDeductibleExpenses;
  const industryRate = getIndustryDeductionRate(profile?.industry);
  const industryExpenseEstimate = Math.round(grossReceipts * industryRate);
  const totalExpenses = Math.max(docExpenses, industryExpenseEstimate);
  const netProfit = Math.max(0, grossReceipts - totalExpenses);

  const scheduleCLines: TaxLineItem[] = [
    buildLineItem({
      form: 'ScheduleC',
      line: '1',
      description: 'Gross receipts or sales',
      amount: grossReceipts,
      confidence: documents.length > 0 ? 95 : 75,
      source: documents.length > 0 ? 'document' : 'ai_estimate',
    }),
    buildLineItem({
      form: 'ScheduleC',
      line: '28',
      description: 'Total expenses',
      amount: totalExpenses,
      confidence: docExpenses > 0 ? 88 : 72,
      source: docExpenses > 0 ? 'document' : 'industry_standard',
    }),
    buildLineItem({
      form: 'ScheduleC',
      line: '31',
      description: 'Net profit or (loss)',
      amount: netProfit,
      confidence: 85,
      source: 'ai_estimate',
    }),
  ];

  const qbiDeduction = Math.round(netProfit * 0.2);
  const form8995Lines: TaxLineItem[] = [
    buildLineItem({
      form: 'Form8995',
      line: '15',
      description: 'Qualified business income deduction (20%)',
      amount: qbiDeduction,
      confidence: profile?.businessType === 'SCorp' ? 65 : 82,
      source: 'ai_estimate',
    }),
  ];

  const totalIncome = income.incomeSummary.totalW2Wages + netProfit;
  const agi = totalIncome - qbiDeduction;
  const estimatedTax = Math.round(agi * 0.22);

  const form1040Lines: TaxLineItem[] = [
    buildLineItem({
      form: 'Form1040',
      line: '9',
      description: 'Total income',
      amount: totalIncome,
      confidence: 90,
      source: 'document',
    }),
    buildLineItem({
      form: 'Form1040',
      line: '11',
      description: 'Adjusted gross income',
      amount: agi,
      confidence: 78,
      source: 'ai_estimate',
    }),
    buildLineItem({
      form: 'Form1040',
      line: '24',
      description: 'Estimated total tax',
      amount: estimatedTax,
      confidence: 68,
      source: 'ai_estimate',
    }),
  ];

  const allLines = [...scheduleCLines, ...form8995Lines, ...form1040Lines];

  let aiNotes = '';
  if (process.env.OPENAI_API_KEY && messages.length > 0) {
    const chatContext = messages
      .slice(0, 10)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a US tax preparer assistant. Suggest 1-2 additional Schedule C deductions based on chat. Reply JSON: { "suggestions": [{ "description": string, "amount": number, "confidence": number }] }',
        },
        {
          role: 'user',
          content: `Industry: ${profile?.industry ?? 'unknown'}\nGross: $${grossReceipts}\nChat:\n${chatContext}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    try {
      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as {
        suggestions?: Array<{ description: string; amount: number; confidence: number }>;
      };
      for (const s of parsed.suggestions ?? []) {
        scheduleCLines.push(
          buildLineItem({
            form: 'ScheduleC',
            line: '27a',
            description: s.description,
            amount: s.amount,
            confidence: s.confidence,
            source: 'chat',
          })
        );
      }
      aiNotes = `AI suggested ${parsed.suggestions?.length ?? 0} additional items from chat.`;
    } catch {
      // ignore parse errors
    }
  }

  const draft: TaxDraft = {
    taxYear,
    generatedAt: new Date().toISOString(),
    scheduleC: {
      grossReceipts,
      totalExpenses,
      netProfit,
      lineItems: scheduleCLines,
    },
    form8995: {
      qbiDeduction,
      taxableIncome: netProfit,
      lineItems: form8995Lines,
    },
    form1040Summary: {
      totalIncome,
      adjustedGrossIncome: agi,
      estimatedTax,
      lineItems: form1040Lines,
    },
    summary: {
      autoIncludedCount: allLines.filter((l) => l.confidence >= 90).length,
      userConfirmCount: allLines.filter(
        (l) => l.confidence >= 70 && l.confidence < 90
      ).length,
      cpaReviewCount: allLines.filter((l) => l.confidence < 70).length,
    },
  };

  void aiNotes;
  return TaxDraftSchema.parse(draft);
}
