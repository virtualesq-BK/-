import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import {
  OnboardingStep1Schema,
  OnboardingStep3Schema,
  type OnboardingProgress,
  ONBOARDING_STEPS,
} from '@/lib/onboarding/types';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { onboardingProgress: true, onboardingCompletedAt: true },
  });

  return NextResponse.json({
    progress: user?.onboardingProgress as OnboardingProgress | null,
    completed: Boolean(user?.onboardingCompletedAt),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { step, data, complete } = body as {
    step: number;
    data: unknown;
    complete?: boolean;
  };

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { onboardingProgress: true },
  });

  const existing = (user?.onboardingProgress as OnboardingProgress | null) ?? {
    currentStep: 1,
    completedSteps: [],
    data: {},
  };

  const progress: OnboardingProgress = {
    ...existing,
    currentStep: step,
    completedSteps: Array.from(new Set([...existing.completedSteps, step])),
    data: { ...existing.data },
  };

  if (step === 1) {
    const step1 = OnboardingStep1Schema.parse(data);
    const profile = await prisma.businessProfile.findFirst({
      where: { userId: auth.user.id, deletedAt: null },
    });
    if (profile) {
      await prisma.businessProfile.update({
        where: { id: profile.id },
        data: {
          businessName: step1.businessName,
          businessType: step1.businessType,
          industry: step1.industry,
          employeeCount: step1.employeeCount,
          state: step1.state,
        },
      });
    } else {
      await prisma.businessProfile.create({
        data: {
          userId: auth.user.id,
          businessName: step1.businessName,
          businessType: step1.businessType,
          industry: step1.industry,
          employeeCount: step1.employeeCount,
          state: step1.state,
        },
      });
    }
    progress.data.step1 = step1;
  }

  if (step === 2) {
    progress.data.step2 = data as OnboardingProgress['data']['step2'];
  }

  if (step === 3) {
    progress.data.step3 = OnboardingStep3Schema.parse(data);
  }

  if (step === 4) {
    progress.data.step4 = data as OnboardingProgress['data']['step4'];
  }

  const updateData: Prisma.UserUpdateInput = {
    onboardingProgress: progress as unknown as Prisma.InputJsonValue,
  };

  if (complete || progress.completedSteps.length >= ONBOARDING_STEPS) {
    updateData.onboardingCompletedAt = new Date();
    progress.currentStep = ONBOARDING_STEPS;
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: updateData,
  });

  return NextResponse.json({ progress, completed: Boolean(updateData.onboardingCompletedAt) });
}
