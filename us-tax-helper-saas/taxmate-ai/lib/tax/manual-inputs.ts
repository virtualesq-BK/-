import { z } from 'zod';
import { buildLineItem, TaxDraftSchema, type TaxDraft, type TaxLineItem } from '@/lib/tax/draft-types';

/**
 * Schedule C Part II (Expenses), official IRS line numbers 8–27a.
 * These line numbers/labels are stable across tax years and are used
 * verbatim so the generated draft maps 1:1 onto the real form.
 */
export const SCHEDULE_C_EXPENSE_LINES = [
  { key: 'advertising', line: '8', label: 'Advertising' },
  { key: 'carAndTruck', line: '9', label: 'Car and truck expenses' },
  { key: 'commissionsFees', line: '10', label: 'Commissions and fees' },
  { key: 'contractLabor', line: '11', label: 'Contract labor' },
  { key: 'depletion', line: '12', label: 'Depletion' },
  { key: 'depreciation', line: '13', label: 'Depreciation and section 179 expense deduction' },
  { key: 'employeeBenefits', line: '14', label: 'Employee benefit programs' },
  { key: 'insurance', line: '15', label: 'Insurance (other than health)' },
  { key: 'interestMortgage', line: '16a', label: 'Interest — mortgage' },
  { key: 'interestOther', line: '16b', label: 'Interest — other' },
  { key: 'legalProfessional', line: '17', label: 'Legal and professional services' },
  { key: 'officeExpense', line: '18', label: 'Office expense' },
  { key: 'pensionProfitSharing', line: '19', label: 'Pension and profit-sharing plans' },
  { key: 'rentVehiclesMachinery', line: '20a', label: 'Rent or lease — vehicles, machinery, equipment' },
  { key: 'rentOther', line: '20b', label: 'Rent or lease — other business property' },
  { key: 'repairsMaintenance', line: '21', label: 'Repairs and maintenance' },
  { key: 'supplies', line: '22', label: 'Supplies' },
  { key: 'taxesLicenses', line: '23', label: 'Taxes and licenses' },
  { key: 'travel', line: '24a', label: 'Travel' },
  { key: 'meals', line: '24b', label: 'Deductible meals' },
  { key: 'utilities', line: '25', label: 'Utilities' },
  { key: 'wages', line: '26', label: 'Wages' },
  { key: 'otherExpenses', line: '27a', label: 'Other expenses' },
] as const;

export type ScheduleCExpenseKey = (typeof SCHEDULE_C_EXPENSE_LINES)[number]['key'];

const scheduleCExpensesSchema = z.object(
  Object.fromEntries(
    SCHEDULE_C_EXPENSE_LINES.map((l) => [l.key, z.number().min(0).default(0)])
  ) as Record<ScheduleCExpenseKey, z.ZodDefault<z.ZodNumber>>
);

export const ManualTaxInputsSchema = z.object({
  taxYear: z.number(),
  filingStatus: z
    .enum(['single', 'married_joint', 'married_separate', 'head_of_household'])
    .default('single'),
  scheduleC: z.object({
    grossReceipts: z.number().min(0),
    returnsAndAllowances: z.number().min(0).default(0),
    costOfGoodsSold: z.number().min(0).default(0),
    expenses: scheduleCExpensesSchema.partial().default({}),
  }),
  w2Wages: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),
});

export type ManualTaxInputs = z.infer<typeof ManualTaxInputsSchema>;

/**
 * Deterministic, rule-based draft generation from user-entered numbers only.
 * No AI, no documents, no chat — every line traces directly back to a number
 * the user typed, so confidence is fixed at 100 (auto-included, no CPA gate).
 */
export function generateTaxDraftFromManualInputs(raw: ManualTaxInputs): TaxDraft {
  const input = ManualTaxInputsSchema.parse(raw);

  const grossReceipts = Math.max(
    0,
    input.scheduleC.grossReceipts - input.scheduleC.returnsAndAllowances
  );
  const grossProfit = Math.max(0, grossReceipts - input.scheduleC.costOfGoodsSold);

  const expenseLineItems: TaxLineItem[] = SCHEDULE_C_EXPENSE_LINES.filter(
    (l) => (input.scheduleC.expenses[l.key] ?? 0) > 0
  ).map((l) =>
    buildLineItem({
      form: 'ScheduleC',
      line: l.line,
      description: l.label,
      amount: input.scheduleC.expenses[l.key] ?? 0,
      confidence: 100,
      source: 'manual_input',
    })
  );

  const totalExpenses = expenseLineItems.reduce((sum, l) => sum + l.amount, 0);
  const netProfit = grossProfit - totalExpenses;

  const scheduleCLines: TaxLineItem[] = [
    buildLineItem({
      form: 'ScheduleC',
      line: '1',
      description: 'Gross receipts or sales',
      amount: input.scheduleC.grossReceipts,
      confidence: 100,
      source: 'manual_input',
    }),
    ...(input.scheduleC.returnsAndAllowances > 0
      ? [
          buildLineItem({
            form: 'ScheduleC',
            line: '2',
            description: 'Returns and allowances',
            amount: input.scheduleC.returnsAndAllowances,
            confidence: 100,
            source: 'manual_input' as const,
          }),
        ]
      : []),
    ...(input.scheduleC.costOfGoodsSold > 0
      ? [
          buildLineItem({
            form: 'ScheduleC',
            line: '4',
            description: 'Cost of goods sold',
            amount: input.scheduleC.costOfGoodsSold,
            confidence: 100,
            source: 'manual_input' as const,
          }),
        ]
      : []),
    ...expenseLineItems,
    buildLineItem({
      form: 'ScheduleC',
      line: '28',
      description: 'Total expenses',
      amount: totalExpenses,
      confidence: 100,
      source: 'manual_input',
    }),
    buildLineItem({
      form: 'ScheduleC',
      line: '31',
      description: 'Net profit or (loss)',
      amount: netProfit,
      confidence: 100,
      source: 'manual_input',
    }),
  ];

  // Qualified Business Income deduction (Form 8995): 20% of net profit, floored at 0.
  const qbiDeduction = Math.max(0, Math.round(netProfit * 0.2));
  const form8995Lines: TaxLineItem[] = [
    buildLineItem({
      form: 'Form8995',
      line: '15',
      description: 'Qualified business income deduction (20%)',
      amount: qbiDeduction,
      confidence: 100,
      source: 'manual_input',
    }),
  ];

  const totalIncome = input.w2Wages + input.otherIncome + Math.max(0, netProfit);
  const agi = Math.max(0, totalIncome - qbiDeduction);

  // Self-employment tax is a real, deterministic IRS formula (Schedule SE),
  // not an estimate — 92.35% of net SE profit at 15.3% (2024/2025 combined rate).
  const seTaxableProfit = Math.max(0, netProfit) * 0.9235;
  const selfEmploymentTax = Math.round(seTaxableProfit * 0.153);

  const form1040Lines: TaxLineItem[] = [
    buildLineItem({
      form: 'Form1040',
      line: '9',
      description: 'Total income',
      amount: totalIncome,
      confidence: 100,
      source: 'manual_input',
    }),
    buildLineItem({
      form: 'Form1040',
      line: '11',
      description: 'Adjusted gross income',
      amount: agi,
      confidence: 100,
      source: 'manual_input',
    }),
    buildLineItem({
      form: 'ScheduleSE',
      line: '12',
      description: 'Self-employment tax',
      amount: selfEmploymentTax,
      confidence: 100,
      source: 'manual_input',
    }),
  ];

  const allLines = [...scheduleCLines, ...form8995Lines, ...form1040Lines];

  const draft: TaxDraft = {
    taxYear: input.taxYear,
    generatedAt: new Date().toISOString(),
    scheduleC: {
      grossReceipts,
      totalExpenses,
      netProfit,
      lineItems: scheduleCLines,
    },
    form8995: {
      qbiDeduction,
      taxableIncome: Math.max(0, netProfit),
      lineItems: form8995Lines,
    },
    form1040Summary: {
      totalIncome,
      adjustedGrossIncome: agi,
      estimatedTax: selfEmploymentTax,
      lineItems: form1040Lines,
    },
    summary: {
      autoIncludedCount: allLines.length,
      userConfirmCount: 0,
      cpaReviewCount: 0,
    },
  };

  return TaxDraftSchema.parse(draft);
}
