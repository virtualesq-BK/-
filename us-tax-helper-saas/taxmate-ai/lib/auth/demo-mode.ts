import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

/**
 * Demo mode: Google OAuth isn't configured yet (no GOOGLE_CLIENT_ID/SECRET
 * on this deployment), so real sign-in is impossible. Rather than block the
 * whole app behind a login screen nobody can complete, every visitor is
 * transparently treated as one shared demo user until real credentials are
 * added — at which point this flips off automatically and normal per-user
 * Google sign-in takes over.
 *
 * This is intentionally a single shared account, not per-visitor identity —
 * fine for trying out the product, not for multi-user real usage.
 */
export function isDemoModeEnabled(): boolean {
  return !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET;
}

const DEMO_USER_EMAIL = 'demo@taxmate.ai';

let demoUserPromise: ReturnType<typeof createOrGetDemoUser> | null = null;

async function createOrGetDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: 'Demo User',
      role: 'USER',
      // Skip the onboarding wizard so "Get Started" lands directly on the
      // real dashboard, matching what was asked: no sign-in/sign-up gate.
      onboardingCompletedAt: new Date(),
    },
  });
}

/** Cached per server instance — avoids re-upserting on every request. */
export async function getDemoUser() {
  if (!demoUserPromise) {
    demoUserPromise = createOrGetDemoUser();
  }
  return demoUserPromise;
}

/**
 * For Server Components/pages (not API routes — use requireAuth() there):
 * real session if signed in, otherwise the shared demo user when demo mode
 * is on, otherwise null (caller should redirect to /login).
 */
export async function getCurrentUserOrDemo() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, onboardingCompletedAt: true },
    });
  }
  if (isDemoModeEnabled()) {
    const demo = await getDemoUser();
    return { id: demo.id, role: demo.role, onboardingCompletedAt: demo.onboardingCompletedAt };
  }
  return null;
}
