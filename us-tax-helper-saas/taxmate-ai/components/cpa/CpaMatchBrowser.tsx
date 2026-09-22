'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Candidate = {
  cpa: {
    id: string;
    name: string | null;
    cpaFirmName: string | null;
    cpaRating: number;
    cpaAvgResponseMin: number;
    hourlyRate: unknown;
  };
  matchScore: number;
  estimatedPrice: number;
};

export function CpaMatchBrowser({ taxReturnId }: { taxReturnId?: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cpa/match')
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []))
      .finally(() => setLoading(false));
  }, []);

  const requestMatch = async (cpaId: string) => {
    if (!taxReturnId) {
      setMessage('먼저 /review 페이지에서 AI 초안을 생성하세요.');
      return;
    }
    setMatching(true);
    const res = await fetch('/api/cpa/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxReturnId, cpaId }),
    });
    setMatching(false);
    const data = await res.json();
    setMessage(data.message ?? '매칭 요청 완료');
  };

  if (loading) return <p className="text-muted-foreground">CPA 검색 중...</p>;

  return (
    <div className="space-y-4">
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {candidates.map(({ cpa, matchScore, estimatedPrice }) => (
          <Card key={cpa.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                {cpa.name ?? 'CPA'} — {cpa.cpaFirmName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Rating: {cpa.cpaRating} · ~{cpa.cpaAvgResponseMin} min response</p>
              <p>Match score: {matchScore}%</p>
              <p className="font-semibold">Est. ${estimatedPrice} / review</p>
              <Button
                size="sm"
                disabled={matching}
                onClick={() => requestMatch(cpa.id)}
              >
                Request Match
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
