/**
 * IRS MeF (Modernized e-File) — DEMO MOCK
 * Production requires IRS e-Services enrollment and A2A certificate.
 */

export type EfileFormPayload = {
  form1040: {
    totalIncome: number;
    adjustedGrossIncome: number;
    totalTax: number;
    refundOrOwed: number;
  };
  scheduleC: {
    grossReceipts: number;
    totalExpenses: number;
    netProfit: number;
  };
  scheduleSE?: {
    selfEmploymentTax: number;
  };
};

export type EfileSubmission = {
  batchId: string;
  submissionId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  xmlPayload: string;
  submittedAt: string;
  processedAt?: string;
  acknowledgment?: string;
};

const mockSubmissions = new Map<string, EfileSubmission>();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMeFXml(
  taxpayerId: string,
  taxYear: number,
  forms: EfileFormPayload
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<IRSTransmission xmlns="urn:irs:efile:mef:mock">
  <SubmissionHeader>
    <TaxYear>${taxYear}</TaxYear>
    <TaxpayerId>${escapeXml(taxpayerId)}</TaxpayerId>
    <SoftwareId>TaxMateAI-DEMO</SoftwareId>
    <TransmissionType>Test</TransmissionType>
  </SubmissionHeader>
  <ReturnData>
    <Form1040>
      <TotalIncome>${forms.form1040.totalIncome}</TotalIncome>
      <AdjustedGrossIncome>${forms.form1040.adjustedGrossIncome}</AdjustedGrossIncome>
      <TotalTax>${forms.form1040.totalTax}</TotalTax>
    </Form1040>
    <ScheduleC>
      <GrossReceipts>${forms.scheduleC.grossReceipts}</GrossReceipts>
      <TotalExpenses>${forms.scheduleC.totalExpenses}</TotalExpenses>
      <NetProfit>${forms.scheduleC.netProfit}</NetProfit>
    </ScheduleC>
    ${
      forms.scheduleSE
        ? `<ScheduleSE><SelfEmploymentTax>${forms.scheduleSE.selfEmploymentTax}</SelfEmploymentTax></ScheduleSE>`
        : ''
    }
  </ReturnData>
</IRSTransmission>`;
}

export async function submitToMeF(
  taxpayerId: string,
  taxYear: number,
  forms: EfileFormPayload
): Promise<EfileSubmission> {
  const batchId = `BATCH-${taxYear}-${Date.now()}`;
  const submissionId = `SUB-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
  const xmlPayload = buildMeFXml(taxpayerId, taxYear, forms);

  const submission: EfileSubmission = {
    batchId,
    submissionId,
    status: 'PENDING',
    xmlPayload,
    submittedAt: new Date().toISOString(),
  };

  mockSubmissions.set(submissionId, submission);

  setTimeout(() => {
    const stored = mockSubmissions.get(submissionId);
    if (stored) {
      stored.status = 'ACCEPTED';
      stored.processedAt = new Date().toISOString();
      stored.acknowledgment = `IRS-ACK-${submissionId}`;
      mockSubmissions.set(submissionId, stored);
    }
  }, 3000);

  return submission;
}

export async function pollEfileStatus(submissionId: string): Promise<EfileSubmission | null> {
  return mockSubmissions.get(submissionId) ?? null;
}

export function buildEfilePayloadFromDraft(aiGeneratedData: unknown): EfileFormPayload | null {
  if (!aiGeneratedData || typeof aiGeneratedData !== 'object') return null;
  const draft = aiGeneratedData as {
    scheduleC?: { grossReceipts?: number; totalExpenses?: number; netProfit?: number };
    form1040Summary?: {
      totalIncome?: number;
      adjustedGrossIncome?: number;
      estimatedTax?: number;
    };
  };

  if (!draft.scheduleC || !draft.form1040Summary) return null;

  const netProfit = draft.scheduleC.netProfit ?? 0;
  const seTax = Math.round(netProfit * 0.9235 * 0.153 * 0.5);

  return {
    form1040: {
      totalIncome: draft.form1040Summary.totalIncome ?? 0,
      adjustedGrossIncome: draft.form1040Summary.adjustedGrossIncome ?? 0,
      totalTax: draft.form1040Summary.estimatedTax ?? 0,
      refundOrOwed: 0,
    },
    scheduleC: {
      grossReceipts: draft.scheduleC.grossReceipts ?? 0,
      totalExpenses: draft.scheduleC.totalExpenses ?? 0,
      netProfit,
    },
    scheduleSE: { selfEmploymentTax: seTax },
  };
}
