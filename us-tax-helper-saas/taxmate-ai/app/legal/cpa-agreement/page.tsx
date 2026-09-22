import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CPA Platform Agreement | TaxMate AI',
};

export default function CpaAgreementPage() {
  return (
    <article>
      <h1>CPA Platform Agreement</h1>
      <p className="text-muted-foreground">For licensed CPAs using TaxMate AI</p>

      <h2>1. Independent Contractor Status</h2>
      <p>
        CPAs on the platform are independent professionals, not employees or agents of
        TaxMate AI. You maintain full responsibility for all professional services,
        licenses, and malpractice coverage.
      </p>

      <h2>2. Review Standard</h2>
      <ul>
        <li>Target review time: 10 minutes per return (guideline, not guarantee)</li>
        <li>You must verify AI outputs against source documents</li>
        <li>Electronic signature (Form 8879) requires valid PTIN and taxpayer authorization</li>
        <li>You may decline or request additional information for complex returns</li>
      </ul>

      <h2>3. Compensation</h2>
      <p>
        Payouts are processed via Stripe Connect (default split: 70% CPA / 30% platform).
        Funds are released 7 days after completed review to allow for refund disputes.
      </p>

      <h2>4. IRC §7216 &amp; Confidentiality</h2>
      <p>
        You agree to use taxpayer information only for authorized review purposes and in
        compliance with Treasury Circular 230 and applicable state board rules.
      </p>

      <h2>5. Platform Conduct</h2>
      <p>
        Misrepresentation of credentials, failure to maintain an active license, or
        repeated quality issues may result in removal from the platform.
      </p>

      <h2>6. Limitation of Liability</h2>
      <p>
        TaxMate AI provides technology only and is not liable for your professional
        judgments, filings, or client disputes.
      </p>
    </article>
  );
}
