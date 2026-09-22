import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import type { UserRole } from '@prisma/client';
import { DashboardNav } from '@/components/shared/dashboard-nav';
import { AuthSessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { isDemoModeEnabled, getDemoUser } from '@/lib/auth/demo-mode';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  let user: { role: UserRole; onboardingCompletedAt: Date | null } | null = null;

  if (session?.user?.id) {
    user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true, onboardingCompletedAt: true },
    });
  } else if (isDemoModeEnabled()) {
    // Google OAuth isn't configured on this deployment yet — fall back to a
    // shared demo account so the product is actually reachable. See
    // lib/auth/demo-mode.ts.
    const demo = await getDemoUser();
    user = { role: demo.role, onboardingCompletedAt: demo.onboardingCompletedAt };
  } else {
    redirect('/login');
  }

  return (
    <AuthSessionProvider>
      <ToastProvider />
      <div className="flex min-h-screen flex-col lg:flex-row">
        <DashboardNav role={user?.role ?? 'USER'} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
