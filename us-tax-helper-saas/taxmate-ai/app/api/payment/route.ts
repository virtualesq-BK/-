import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { stripe } from '@/lib/utils/stripe';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { priceId } = await req.json();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=cancelled`,
    customer_email: auth.user.email,
    metadata: { userId: auth.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
