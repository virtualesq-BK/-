import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/lib/notifications/types';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      image: true,
      subscriptionTier: true,
      stripeCustomerId: true,
      notificationSettings: true,
      businessProfiles: { where: { deletedAt: null }, take: 1 },
    },
  });

  return NextResponse.json({
    user,
    notificationSettings: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(user?.notificationSettings as NotificationSettings | null),
    },
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();

  const data: Prisma.UserUpdateInput = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.notificationSettings) {
    data.notificationSettings = body.notificationSettings as Prisma.InputJsonValue;
  }

  if (body.profile) {
    const profile = await prisma.businessProfile.findFirst({
      where: { userId: auth.user.id, deletedAt: null },
    });
    if (profile) {
      await prisma.businessProfile.update({
        where: { id: profile.id },
        data: body.profile,
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data,
  });

  return NextResponse.json({ user });
}
