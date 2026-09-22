import { NextResponse } from 'next/server';
import { EfileStatus, TaxReturnStatus } from '@prisma/client';
import { requireAuth } from '@/lib/auth/require-role';
import { prisma } from '@/lib/db/prisma';
import {
  buildEfilePayloadFromDraft,
  pollEfileStatus,
  submitToMeF,
} from '@/lib/irs/efile';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { taxReturnId } = await req.json();
  if (!taxReturnId) {
    return NextResponse.json({ error: 'taxReturnId required' }, { status: 400 });
  }

  const taxReturn = await prisma.taxReturn.findFirst({
    where: {
      id: taxReturnId,
      userId: auth.user.id,
      status: TaxReturnStatus.COMPLETED,
      deletedAt: null,
    },
  });

  if (!taxReturn) {
    return NextResponse.json(
      { error: 'Return must be CPA-approved (COMPLETED) before e-filing' },
      { status: 400 }
    );
  }

  const payload = buildEfilePayloadFromDraft(taxReturn.aiGeneratedData);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid draft data for e-file' }, { status: 400 });
  }

  const submission = await submitToMeF(
    auth.user.id,
    taxReturn.taxYear,
    payload
  );

  const updated = await prisma.taxReturn.update({
    where: { id: taxReturnId },
    data: {
      efileStatus: EfileStatus.PENDING,
      efileBatchId: submission.batchId,
      irsSubmissionId: submission.submissionId,
    },
  });

  const { notifyTaxReturnFiled } = await import('@/lib/notifications/notify');
  await notifyTaxReturnFiled(auth.user.id, submission.submissionId);

  return NextResponse.json({ taxReturn: updated, submission });
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const submissionId = new URL(req.url).searchParams.get('submissionId');
  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId required' }, { status: 400 });
  }

  const status = await pollEfileStatus(submissionId);
  if (!status) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  if (status.status === 'ACCEPTED') {
    const taxReturn = await prisma.taxReturn.findFirst({
      where: { irsSubmissionId: submissionId, userId: auth.user.id },
    });

    if (taxReturn) {
      await prisma.taxReturn.update({
        where: { id: taxReturn.id },
        data: {
          efileStatus: EfileStatus.ACCEPTED,
          status: TaxReturnStatus.FILED,
          filingDate: new Date(),
        },
      });

      await prisma.message.create({
        data: {
          userId: auth.user.id,
          role: 'AI',
          content: `IRS accepted your e-file! Acknowledgment: ${status.acknowledgment}`,
          taxReturnId: taxReturn.id,
          metadata: { type: 'EFILE_ACCEPTED', acknowledgment: status.acknowledgment },
        },
      });
    }
  }

  return NextResponse.json({ submission: status });
}
