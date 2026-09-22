'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TaxDraft } from '@/lib/tax/draft-types';

export function TaxDraftPanel() {
  const [draft, setDraft] = useState<TaxDraft | null>(null);
  const [taxReturnId, setTaxReturnId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [efiling, setEfiling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const generateDraft = async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch('/api/tax/draft', { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      setMessage('초안 생성 실패');
      return;
    }
    const data = await res.json();
    setDraft(data.draft);
    setTaxReturnId(data.taxReturn.id);
    setMessage('AI 초안이 생성되었습니다. 상태: AI_REVIEW');
  };

  const requestCpaMatch = async () => {
    if (!taxReturnId) return;
    setMatching(true);
    const res = await fetch('/api/cpa/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxReturnId }),
    });
    setMatching(false);
    const data = await res.json();
    setMessage(data.message ?? 'CPA 매칭 요청 완료');
  };

  const submitEfile = async () => {
    if (!taxReturnId) return;
    setEfiling(true);
    const res = await fetch('/api/tax/efile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxReturnId }),
    });
    setEfiling(false);
    if (!res.ok) {
      setMessage('e-file 제출 실패 — CPA 승인 후 시도하세요');
      return;
    }
    const data = await res.json();
    setMessage(`IRS MeF 제출됨 (데모). ID: ${data.submission.submissionId}`);

    setTimeout(async () => {
      await fetch(`/api/tax/efile?submissionId=${data.submission.submissionId}`);
      setMessage('IRS가 신고서를 수락했습니다 (데모).');
    }, 4000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 세금 신고 초안</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateDraft} disabled={loading}>
            {loading ? '생성 중...' : 'AI 초안 생성'}
          </Button>
          <Button
            variant="outline"
            onClick={requestCpaMatch}
            disabled={!taxReturnId || matching}
          >
            {matching ? '매칭 중...' : 'CPA 매칭 요청'}
          </Button>
          <Button
            variant="secondary"
            onClick={submitEfile}
            disabled={!taxReturnId || efiling}
          >
            {efiling ? '제출 중...' : 'IRS e-file (데모)'}
          </Button>
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {draft && (
          <div className="rounded border p-4 text-sm">
            <p>
              Schedule C 순이익:{' '}
              <strong>${draft.scheduleC.netProfit.toLocaleString()}</strong>
            </p>
            <p>QBI 공제 (Form 8995): ${draft.form8995.qbiDeduction.toLocaleString()}</p>
            <p>추정 세금: ${draft.form1040Summary.estimatedTax.toLocaleString()}</p>
            <div className="mt-2 flex gap-4 text-xs">
              <span className="text-green-600">자동 포함: {draft.summary.autoIncludedCount}</span>
              <span className="text-amber-600">사용자 확인: {draft.summary.userConfirmCount}</span>
              <span className="text-red-600">CPA 검토: {draft.summary.cpaReviewCount}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
