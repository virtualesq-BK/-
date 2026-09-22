'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { DashboardTask } from '@/lib/dashboard/get-dashboard-data';

type DashboardData = {
  taxYear: number;
  filingStatus: string;
  subscriptionTier: string;
  taxSummary: {
    estimatedTax: number;
    federalWithheld: number;
    refundOrOwed: number;
    isRefund: boolean;
    netScheduleCIncome: number;
  };
  auditRisk: {
    score: number;
    previousScore?: number;
    spike: boolean;
    mitigation: string[];
  };
  documentCount: number;
  tasks: DashboardTask[];
  quarterlyDeadlines: Array<{
    quarter: string;
    dueDate: string;
    daysUntil: number;
    estimatedAmount: number;
  }>;
  upcomingDue?: {
    quarter: string;
    dueDate: string;
    daysUntil: number;
    estimatedAmount: number;
  };
  cpa: { name: string | null; firm: string | null; matchStatus: string | null } | null;
  cpaInteractions: Array<{ id: string; content: string; createdAt: string; role: string }>;
  unreadNotifications: Array<{ id: string; title: string; body: string; type: string }>;
};

function AuditGauge({ score, spike }: { score: number; spike: boolean }) {
  const color =
    score >= 70 ? 'text-red-600' : score >= 40 ? 'text-amber-600' : 'text-green-600';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
      <Progress value={score} className="h-3" />
      {spike && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3 w-3" />
          위험 점수 급등 — CPA 상담 권장
        </p>
      )}
    </div>
  );
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.unreadNotifications?.length > 0) {
          d.unreadNotifications.slice(0, 2).forEach((n: { title: string; body: string }) => {
            toast(n.title, { icon: '🔔' });
          });
        }
        if (d.auditRisk?.spike) {
          toast.error('감사 위험 점수가 상승했습니다');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-muted-foreground">대시보드 로딩 중...</p>;
  }

  if (!data) {
    return <p className="text-destructive">데이터를 불러올 수 없습니다.</p>;
  }

  const { taxSummary } = data;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data.taxYear} tax year · {data.filingStatus.replace('_', ' ')}
          </p>
        </div>
        <Badge variant="secondary">{data.subscriptionTier}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">예상 환급 / 납부</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {taxSummary.isRefund ? (
                <ArrowDownRight className="h-8 w-8 text-green-600" />
              ) : (
                <ArrowUpRight className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p
                  className={`text-3xl font-bold ${
                    taxSummary.isRefund ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  ${Math.abs(taxSummary.refundOrOwed).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {taxSummary.isRefund ? '예상 환급' : '예상 추가 납부'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              추정 세금 ${taxSummary.estimatedTax.toLocaleString()} · 원천징수 $
              {taxSummary.federalWithheld.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">감사 위험 점수</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditGauge score={data.auditRisk.score} spike={data.auditRisk.spike} />
          </CardContent>
        </Card>
      </div>

      {data.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">미완료 작업</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.tasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mt-0.5">
                  {task.type === 'upload' && <FileText className="h-4 w-4" />}
                  {task.type === 'cpa' && <UserCheck className="h-4 w-4" />}
                  {task.type === 'confirm' && <AlertTriangle className="h-4 w-4" />}
                  {task.type === 'review' && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{task.title}</p>
                    <Badge
                      variant={task.priority === 'high' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              분기별 추정세 일정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.quarterlyDeadlines.map((q) => (
              <div
                key={q.quarter}
                className={`flex justify-between rounded border p-2 text-sm ${
                  q.daysUntil >= 0 && q.daysUntil <= 14 ? 'border-amber-300 bg-amber-50' : ''
                }`}
              >
                <span>
                  {q.quarter} — {q.dueDate}
                </span>
                <span className="font-medium">
                  ${q.estimatedAmount.toLocaleString()}
                  {q.daysUntil >= 0 && q.daysUntil <= 30 && (
                    <span className="ml-2 text-xs text-amber-600">D-{q.daysUntil}</span>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CPA 상호작용</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.cpa ? (
              <p className="text-sm">
                담당: <strong>{data.cpa.name}</strong>
                {data.cpa.firm && ` · ${data.cpa.firm}`}
                {data.cpa.matchStatus && (
                  <Badge className="ml-2" variant="outline">
                    {data.cpa.matchStatus}
                  </Badge>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">아직 CPA가 배정되지 않았습니다.</p>
            )}
            {data.cpaInteractions.length === 0 ? (
              <p className="text-xs text-muted-foreground">최근 CPA 메시지 없음</p>
            ) : (
              data.cpaInteractions.map((m) => (
                <div key={m.id} className="rounded border p-2 text-xs">
                  <p className="text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                  <p>{m.content}</p>
                </div>
              ))
            )}
            <Button asChild size="sm" variant="outline">
              <Link href="/cpa-match">CPA 찾기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
          <Link href="/documents">
            <FileText className="h-5 w-5" />
            <span className="text-xs">문서</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
          <Link href="/chat">
            <span className="text-lg">💬</span>
            <span className="text-xs">채팅</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
          <Link href="/review">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-xs">신고서</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-3 flex-col gap-1">
          <Link href="/settings">
            <span className="text-lg">⚙️</span>
            <span className="text-xs">설정</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
