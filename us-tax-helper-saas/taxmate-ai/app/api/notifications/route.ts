import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { ids, markAllRead } = await req.json();

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: auth.user.id, read: false },
      data: { read: true },
    });
  } else if (Array.isArray(ids)) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: auth.user.id },
      data: { read: true },
    });
  }

  return NextResponse.json({ success: true });
}
