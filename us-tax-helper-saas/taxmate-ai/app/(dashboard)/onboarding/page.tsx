import { redirect } from 'next/navigation';
import { getCurrentUserOrDemo } from '@/lib/auth/demo-mode';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default async function OnboardingPage() {
  const user = await getCurrentUserOrDemo();
  if (!user) redirect('/login');

  if (user.role === 'CPA') redirect('/cpa/dashboard');
  if (user.onboardingCompletedAt) redirect('/dashboard');

  return <OnboardingWizard />;
}
