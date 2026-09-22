import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user.id;

  const [user, profiles, documents, taxReturns, messages, notifications, payments] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          subscriptionTier: true,
          createdAt: true,
          onboardingProgress: true,
          notificationSettings: true,
        },
      }),
      prisma.businessProfile.findMany({ where: { userId } }),
      prisma.taxDocument.findMany({ where: { userId } }),
      prisma.taxReturn.findMany({ where: { userId } }),
      prisma.message.findMany({ where: { userId } }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.paymentTransaction.findMany({ where: { userId } }),
    ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    disclaimer: 'GDPR/CCPA data export — TaxMate AI',
    user,
    businessProfiles: profiles,
    taxDocuments: documents.map((d) => ({
      ...d,
      fileUrl: '[redacted — download from app]',
    })),
    taxReturns,
    messages,
    notifications,
    payments,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="taxmate-export-${userId}.json"`,
    },
  });
}
