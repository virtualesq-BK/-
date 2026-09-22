import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  type NotificationType,
} from './types';

export type NotifyPayload = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** SMS only for critical types when enabled */
  critical?: boolean;
};

async function getUserSettings(userId: string): Promise<NotificationSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationSettings: true, email: true, phone: true, name: true },
  });

  if (!user?.notificationSettings) return DEFAULT_NOTIFICATION_SETTINGS;
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(user.notificationSettings as NotificationSettings) };
}

function shouldNotifyForType(settings: NotificationSettings, type: NotificationType): boolean {
  switch (type) {
    case 'DOCUMENT_PROCESSED':
      return settings.documentProcessed;
    case 'CPA_MATCH_ACCEPTED':
      return settings.cpaUpdates;
    case 'TAX_RETURN_FILED':
      return settings.filingUpdates;
    case 'AUDIT_RISK_SPIKE':
      return settings.auditAlerts;
    case 'PAYMENT_DUE':
      return settings.paymentReminders;
    default:
      return true;
  }
}

async function createInAppNotification(payload: NotifyPayload) {
  return prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] ${to}: ${subject}`);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'TaxMate <onboarding@taxmate.ai>',
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[sms] ${to}: ${body.slice(0, 80)}...`);
    return false;
  }

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return false;

  try {
    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('[sms] send failed:', err);
    return false;
  }
}

/**
 * Unified notification dispatcher (DB + email + optional SMS)
 */
export async function notify(payload: NotifyPayload) {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, phone: true, name: true },
  });

  if (!user) return null;

  const settings = await getUserSettings(payload.userId);
  if (!shouldNotifyForType(settings, payload.type)) {
    return null;
  }

  let notification = null;

  if (settings.inApp) {
    notification = await createInAppNotification(payload);
  }

  if (settings.email && user.email) {
    await sendEmail(
      user.email,
      payload.title,
      `<p>Hi ${user.name ?? 'there'},</p><p>${payload.body}</p><p>— TaxMate AI</p>`
    );
  }

  if (
    settings.sms &&
    payload.critical &&
    user.phone &&
    (payload.type === 'AUDIT_RISK_SPIKE' || payload.type === 'PAYMENT_DUE')
  ) {
    await sendSms(user.phone, `${payload.title}: ${payload.body.slice(0, 120)}`);
  }

  return notification;
}

/** Convenience triggers */
export async function notifyDocumentProcessed(userId: string, fileName: string) {
  return notify({
    userId,
    type: 'DOCUMENT_PROCESSED',
    title: 'Document processed',
    body: `${fileName} has been analyzed. Review extracted data in Documents.`,
    metadata: { fileName },
  });
}

export async function notifyCpaAccepted(userId: string, cpaName: string) {
  return notify({
    userId,
    type: 'CPA_MATCH_ACCEPTED',
    title: 'CPA accepted your request',
    body: `${cpaName} will review your return within 10 minutes.`,
    metadata: { cpaName },
  });
}

export async function notifyTaxReturnFiled(userId: string, submissionId: string) {
  return notify({
    userId,
    type: 'TAX_RETURN_FILED',
    title: 'Tax return filed',
    body: `Your return was submitted successfully. Confirmation: ${submissionId}`,
    metadata: { submissionId },
  });
}

export async function notifyAuditRiskSpike(userId: string, score: number) {
  return notify({
    userId,
    type: 'AUDIT_RISK_SPIKE',
    title: 'Audit risk alert',
    body: `Your audit risk score increased to ${score}. Consider CPA consultation.`,
    metadata: { score },
    critical: true,
  });
}

export async function notifyPaymentDue(userId: string, dueDate: string, amount: number) {
  return notify({
    userId,
    type: 'PAYMENT_DUE',
    title: 'Estimated tax payment due',
    body: `Payment of $${amount.toLocaleString()} is due by ${dueDate}.`,
    metadata: { dueDate, amount },
    critical: true,
  });
}
