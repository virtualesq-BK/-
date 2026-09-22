import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { DashboardView } from '@/components/dashboard/DashboardView';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, onboardingCompletedAt: true },
  });

  if (user?.role === 'CPA') redirect('/cpa/dashboard');
  if (!user?.onboardingCompletedAt) redirect('/onboarding');

  return <DashboardView />;
}
