import { getServerSession } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: 'Unauthorized' as const, status: 401 as const };
  }

  const user = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
  });

  if (!user) {
    return { error: 'User not found' as const, status: 404 as const };
  }

  return { user, session };
}

export async function requireRole(role: UserRole) {
  const result = await requireAuth();
  if ('error' in result) return result;

  if (result.user.role !== role) {
    return { error: 'Forbidden' as const, status: 403 as const };
  }

  return result;
}
