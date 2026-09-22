import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { DashboardNav } from '@/components/shared/dashboard-nav';
import { AuthSessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true, onboardingCompletedAt: true },
  });

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
