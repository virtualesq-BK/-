'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type SearchResult = {
  sourceName: string;
  sourceUrl: string | null;
  formNumber: string | null;
  summary: string | null;
  excerpt: string;
  score: number | null;
};

const EXAMPLE_QUERIES = [
  'Schedule C 재택근무 공제 (home office deduction)',
  'Form 8995 QBI 공제 계산법',
  '자영업세(Self-Employment Tax) 신고 방법',
];

export function IrsSourceSearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  const search = async (q?: string) => {
    const effectiveQuery = q ?? query;
    if (!effectiveQuery.trim()) return;
    setQuery(effectiveQuery);
    setLoading(true);
    setError(null);
    const res = await fetch('/api/irs/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: effectiveQuery }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? '검색에 실패했습니다. 벡터 스토어가 아직 비어 있을 수 있습니다.');
      setResults(null);
      return;
    }
    const data = await res.json();
    setResults(data.results ?? []);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>IRS 공식 자료 검색 (SAC-RAG)</CardTitle>
        <p className="text-sm text-muted-foreground">
          크롤링된 IRS 공식 페이지·서식·안내문(Form 1040, Schedule C, Pub 334/535 등)에서
          Summary-Augmented Chunking으로 관련 근거를 찾아줍니다. 답변이 아니라 원문
          출처를 보여드리므로, 문서 작성 전에 근거를 직접 확인하는 용도로 쓰세요.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="예: Schedule C 재택근무 공제"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <Button onClick={() => search()} disabled={loading || !query.trim()}>
            {loading ? '검색 중...' : '검색'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => search(q)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {q}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {results && results.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            관련 자료를 찾지 못했습니다. 벡터 스토어를 채우려면{' '}
            <code className="rounded bg-muted px-1">npm run ingest:irs:crawled</code>를
            먼저 실행하세요.
          </p>
        )}

        {results && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="rounded border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.sourceName}</span>
                  {r.formNumber && <Badge variant="secondary">{r.formNumber}</Badge>}
                  {r.score !== null && (
                    <Badge variant="outline">관련도 {(r.score * 100).toFixed(0)}%</Badge>
                  )}
                </div>
                {r.summary && (
                  <p className="mb-1 text-xs italic text-muted-foreground">{r.summary}</p>
                )}
                <p className="text-muted-foreground">{r.excerpt}…</p>
                {r.sourceUrl && (
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    IRS.gov 원문 보기 →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
