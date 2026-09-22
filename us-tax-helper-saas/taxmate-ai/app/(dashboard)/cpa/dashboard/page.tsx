import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CpaMatchActions } from '@/components/cpa/CpaMatchActions';

export default async function CpaDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, role: 'CPA', deletedAt: null },
  });

  if (!user) redirect('/dashboard');

  const [pendingMatches, activeReviews, payouts] = await Promise.all([
    prisma.cpaMatchRequest.findMany({
      where: { cpaId: user.id, status: 'PENDING' },
      include: {
        user: { select: { name: true, email: true } },
        taxReturn: { select: { id: true, taxYear: true } },
      },
    }),
    prisma.taxReturn.findMany({
      where: { assignedCpaId: user.id, status: 'CPA_REVIEW', deletedAt: null },
      include: { user: { select: { name: true } } },
    }),
    prisma.paymentTransaction.findMany({
      where: { cpaId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">CPA Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome, {user.name ?? user.cpaFirmName ?? 'CPA'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingMatches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeReviews.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{user.cpaRating.toFixed(1)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Match Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            pendingMatches.map((match) => (
              <div
                key={match.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
              >
                <div>
                  <p className="font-medium">
                    {match.user.name ?? match.user.email} — {match.taxReturn.taxYear}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Match score: {match.matchScore?.toFixed(0)}% · {match.complexity}
                  </p>
                </div>
                <CpaMatchActions matchRequestId={match.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active reviews.</p>
          ) : (
            activeReviews.map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <span>
                  {tr.user.name ?? 'Client'} — {tr.taxYear}
                </span>
                <Button asChild size="sm">
                  <Link href={`/cpa/review/${tr.id}`}>Open Review</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {payouts.length === 0 ? (
              <li className="text-muted-foreground">No payouts yet.</li>
            ) : (
              payouts.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.status}</span>
                  <span>${Number(p.cpaShareAmount ?? 0).toFixed(2)}</span>
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
