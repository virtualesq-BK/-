import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-role';
import { trackAiFeedback } from '@/lib/monitoring/logger';

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  helpful: z.boolean().optional(),
  comment: z.string().max(2000).optional(),
  context: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = FeedbackSchema.parse(await req.json());

  await trackAiFeedback({
    userId: auth.user.id,
    rating: body.rating,
    helpful: body.helpful,
    comment: body.comment,
    context: body.context,
  });

  return NextResponse.json({ success: true });
}
