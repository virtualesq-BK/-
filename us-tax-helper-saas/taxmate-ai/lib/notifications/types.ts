export type NotificationType =
  | 'DOCUMENT_PROCESSED'
  | 'CPA_MATCH_ACCEPTED'
  | 'TAX_RETURN_FILED'
  | 'AUDIT_RISK_SPIKE'
  | 'PAYMENT_DUE'
  | 'GENERAL';

export type NotificationChannel = 'email' | 'in_app' | 'sms';

export type NotificationSettings = {
  email: boolean;
  inApp: boolean;
  sms: boolean;
  documentProcessed: boolean;
  cpaUpdates: boolean;
  filingUpdates: boolean;
  auditAlerts: boolean;
  paymentReminders: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  inApp: true,
  sms: false,
  documentProcessed: true,
  cpaUpdates: true,
  filingUpdates: true,
  auditAlerts: true,
  paymentReminders: true,
};
