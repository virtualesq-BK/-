import { prisma } from '@/lib/db/prisma';
import { stripe } from '@/lib/utils/stripe';

const CPA_SHARE = 0.7;
const PLATFORM_SHARE = 0.3;
const PAYOUT_DELAY_DAYS = 7;

export function splitPayment(totalAmount: number) {
  const cpaShare = Math.round(totalAmount * CPA_SHARE * 100) / 100;
  const platformShare = Math.round(totalAmount * PLATFORM_SHARE * 100) / 100;
  return { cpaShare, platformShare };
}

export async function scheduleCpaPayout(params: {
  taxReturnId: string;
  userId: string;
  cpaId: string;
  totalAmount: number;
  description?: string;
}) {
  const { cpaShare, platformShare } = splitPayment(params.totalAmount);
  const payoutScheduledAt = new Date();
  payoutScheduledAt.setDate(payoutScheduledAt.getDate() + PAYOUT_DELAY_DAYS);

  const payment = await prisma.paymentTransaction.create({
    data: {
      userId: params.userId,
      cpaId: params.cpaId,
      taxReturnId: params.taxReturnId,
      amount: params.totalAmount,
      cpaShareAmount: cpaShare,
      platformShareAmount: platformShare,
      status: 'SCHEDULED',
      description:
        params.description ??
        `CPA review payout — ${PAYOUT_DELAY_DAYS}-day hold`,
      payoutScheduledAt,
    },
  });

  return payment;
}

export async function processDuePayouts() {
  const due = await prisma.paymentTransaction.findMany({
    where: {
      status: 'SCHEDULED',
      payoutScheduledAt: { lte: new Date() },
      deletedAt: null,
    },
    include: {
      cpa: true,
    },
  });

  const results = [];

  for (const payment of due) {
    if (!payment.cpa?.stripeConnectAccountId) {
      console.warn(`[payout] CPA ${payment.cpaId} missing Stripe Connect account`);
      continue;
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(payment.cpaShareAmount) * 100),
        currency: 'usd',
        destination: payment.cpa.stripeConnectAccountId,
        description: `TaxMate CPA payout — ${payment.id}`,
        metadata: {
          taxReturnId: payment.taxReturnId ?? '',
          paymentId: payment.id,
        },
      });

      await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          stripeTransferId: transfer.id,
          payoutCompletedAt: new Date(),
        },
      });

      results.push({ paymentId: payment.id, transferId: transfer.id });
    } catch (err) {
      console.error(`[payout] Failed ${payment.id}:`, err);
    }
  }

  return results;
}
