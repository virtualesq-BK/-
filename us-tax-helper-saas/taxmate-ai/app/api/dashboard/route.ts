import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await getDashboardData(auth.user.id);
  return NextResponse.json(data);
}
