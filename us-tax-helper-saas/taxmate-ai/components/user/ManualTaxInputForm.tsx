'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SCHEDULE_C_EXPENSE_LINES, type ScheduleCExpenseKey } from '@/lib/tax/manual-inputs';
import type { TaxDraft } from '@/lib/tax/draft-types';

type ExpenseState = Partial<Record<ScheduleCExpenseKey, string>>;

const FILING_STATUSES = [
  { value: 'single', label: '싱글 (Single)' },
  { value: 'married_joint', label: '부부합산 (Married filing jointly)' },
  { value: 'married_separate', label: '부부개별 (Married filing separately)' },
  { value: 'head_of_household', label: '세대주 (Head of household)' },
] as const;

function toNumber(v: string): number {
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function ManualTaxInputForm({ onDraft }: { onDraft?: (draft: TaxDraft) => void }) {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(String(currentYear - 1));
  const [filingStatus, setFilingStatus] =
    useState<(typeof FILING_STATUSES)[number]['value']>('single');
  const [grossReceipts, setGrossReceipts] = useState('');
  const [returnsAndAllowances, setReturnsAndAllowances] = useState('');
  const [costOfGoodsSold, setCostOfGoodsSold] = useState('');
  const [w2Wages, setW2Wages] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [expenses, setExpenses] = useState<ExpenseState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaxDraft | null>(null);

  const totalExpensesPreview = useMemo(
    () =>
      SCHEDULE_C_EXPENSE_LINES.reduce(
        (sum, l) => sum + toNumber(expenses[l.key] ?? '0'),
        0
      ),
    [expenses]
  );

  const netProfitPreview =
    toNumber(grossReceipts) -
    toNumber(returnsAndAllowances) -
    toNumber(costOfGoodsSold) -
    totalExpensesPreview;

  const setExpense = (key: ScheduleCExpenseKey, value: string) => {
    setExpenses((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    const payload = {
      taxYear: Number(taxYear),
      filingStatus,
      w2Wages: toNumber(w2Wages),
      otherIncome: toNumber(otherIncome),
      scheduleC: {
        grossReceipts: toNumber(grossReceipts),
        returnsAndAllowances: toNumber(returnsAndAllowances),
        costOfGoodsSold: toNumber(costOfGoodsSold),
        expenses: Object.fromEntries(
          Object.entries(expenses).map(([k, v]) => [k, toNumber(v ?? '0')])
        ),
      },
    };

    const res = await fetch('/api/tax/manual-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '문서 생성에 실패했습니다.');
      return;
    }

    const data = await res.json();
    setDraft(data.draft);
    onDraft?.(data.draft);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>숫자만 입력하면 자동 작성 — Form 1040 / Schedule C</CardTitle>
          <p className="text-sm text-muted-foreground">
            IRS 공식 서식(Schedule C, Form 8995, Form 1040) 라인 번호에 맞춰 입력값이
            그대로 매핑됩니다. AI 추정이 아닌 사용자가 입력한 숫자로만 계산되므로
            신뢰도 100%로 처리되며 CPA 검토 없이 바로 자동 포함됩니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="taxYear">과세연도</Label>
              <Input
                id="taxYear"
                type="number"
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="filingStatus">신고 유형</Label>
              <select
                id="filingStatus"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filingStatus}
                onChange={(e) =>
                  setFilingStatus(e.target.value as (typeof FILING_STATUSES)[number]['value'])
                }
              >
                {FILING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="w2Wages">W-2 급여소득</Label>
              <Input
                id="w2Wages"
                inputMode="decimal"
                placeholder="0"
                value={w2Wages}
                onChange={(e) => setW2Wages(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otherIncome">기타 소득</Label>
              <Input
                id="otherIncome"
                inputMode="decimal"
                placeholder="0"
                value={otherIncome}
                onChange={(e) => setOtherIncome(e.target.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Schedule C — Part I (수입)</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="grossReceipts">Line 1. 총매출 (Gross receipts)</Label>
                <Input
                  id="grossReceipts"
                  inputMode="decimal"
                  placeholder="0"
                  value={grossReceipts}
                  onChange={(e) => setGrossReceipts(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="returnsAndAllowances">Line 2. 반품·에누리</Label>
                <Input
                  id="returnsAndAllowances"
                  inputMode="decimal"
                  placeholder="0"
                  value={returnsAndAllowances}
                  onChange={(e) => setReturnsAndAllowances(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="costOfGoodsSold">Line 4. 매출원가 (COGS)</Label>
                <Input
                  id="costOfGoodsSold"
                  inputMode="decimal"
                  placeholder="0"
                  value={costOfGoodsSold}
                  onChange={(e) => setCostOfGoodsSold(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Schedule C — Part II (경비, Line 8–27a)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SCHEDULE_C_EXPENSE_LINES.map((l) => (
                <div key={l.key} className="space-y-1.5">
                  <Label htmlFor={l.key}>
                    Line {l.line}. {l.label}
                  </Label>
                  <Input
                    id={l.key}
                    inputMode="decimal"
                    placeholder="0"
                    value={expenses[l.key] ?? ''}
                    onChange={(e) => setExpense(l.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border bg-muted/40 p-3 text-sm">
            <p>
              예상 순이익 (Line 31): <strong>${netProfitPreview.toLocaleString()}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              총경비 (Line 28): ${totalExpensesPreview.toLocaleString()}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={submit} disabled={loading || !grossReceipts}>
            {loading ? '문서 작성 중...' : '문서 자동 작성'}
          </Button>
        </CardContent>
      </Card>

      {draft && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>작성 완료</CardTitle>
            <Badge variant="success">신뢰도 100% · 수동 입력</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <p>
                Schedule C 순이익 (Line 31):{' '}
                <strong>${draft.scheduleC.netProfit.toLocaleString()}</strong>
              </p>
              <p>
                QBI 공제 (Form 8995 Line 15): $
                {draft.form8995.qbiDeduction.toLocaleString()}
              </p>
              <p>
                자영업세 (Schedule SE Line 12): $
                {draft.form1040Summary.estimatedTax.toLocaleString()}
              </p>
              <p>
                조정총소득 (Form 1040 Line 11): $
                {draft.form1040Summary.adjustedGrossIncome.toLocaleString()}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="success">자동 포함 {draft.summary.autoIncludedCount}</Badge>
              <Badge variant="warning">사용자 확인 {draft.summary.userConfirmCount}</Badge>
              <Badge variant="destructive">CPA 검토 {draft.summary.cpaReviewCount}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
