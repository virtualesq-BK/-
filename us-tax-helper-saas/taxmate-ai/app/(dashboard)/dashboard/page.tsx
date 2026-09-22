import { redirect } from 'next/navigation';
import { getCurrentUserOrDemo } from '@/lib/auth/demo-mode';
import { DashboardView } from '@/components/dashboard/DashboardView';

export default async function DashboardPage() {
  const user = await getCurrentUserOrDemo();
  if (!user) redirect('/login');

  if (user.role === 'CPA') redirect('/cpa/dashboard');
  if (!user.onboardingCompletedAt) redirect('/onboarding');

  return <DashboardView />;
}
