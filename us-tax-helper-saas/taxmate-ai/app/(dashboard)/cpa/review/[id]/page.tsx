import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { ReviewWorkspace } from '@/components/cpa/ReviewWorkspace';

type PageProps = { params: { id: string } };

export default async function CpaReviewPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
  });

  if (!user || user.role !== 'CPA') {
    redirect('/dashboard');
  }

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: params.id,
      assignedCpaId: user.id,
      deletedAt: null,
    },
  });

  if (!taxReturn) {
    redirect('/cpa/dashboard');
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ReviewWorkspace taxReturnId={params.id} />
    </div>
  );
}
