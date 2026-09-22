import { z } from 'zod';

export const OnboardingStep1Schema = z.object({
  businessName: z.string().min(1),
  businessType: z.enum(['LLC', 'SoleProp', 'SCorp', 'Partnership']),
  industry: z.string().min(1),
  employeeCount: z.number().int().min(0),
  state: z.string().optional(),
});

export const OnboardingStep3Schema = z.object({
  cpaPreference: z.enum(['auto', 'manual']),
});

export type OnboardingProgress = {
  currentStep: number;
  completedSteps: number[];
  data: {
    step1?: z.infer<typeof OnboardingStep1Schema>;
    step2?: { documentsUploaded: number; skipped?: boolean };
    step3?: z.infer<typeof OnboardingStep3Schema>;
    step4?: { subscriptionComplete?: boolean; priceId?: string };
  };
};

export const ONBOARDING_STEPS = 4;

export function getOnboardingPercent(progress: OnboardingProgress | null): number {
  if (!progress) return 0;
  return Math.round((progress.completedSteps.length / ONBOARDING_STEPS) * 100);
}
