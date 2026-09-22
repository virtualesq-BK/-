import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | TaxMate AI',
};

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: May 2026</p>

      <h2>1. Service Description</h2>
      <p>
        TaxMate AI provides software tools to help self-employed taxpayers organize
        documents, generate draft tax information, and connect with licensed CPAs for
        review. TaxMate AI is <strong>not</strong> a CPA firm, law firm, or IRS-authorized
        e-file provider unless explicitly stated in writing.
      </p>

      <h2>2. AI Limitations (Critical)</h2>
      <ul>
        <li>
          AI-generated outputs may contain errors, omissions, or outdated information.
        </li>
        <li>
          AI does not replace professional judgment by a licensed CPA or tax attorney.
        </li>
        <li>
          You are solely responsible for reviewing all figures before filing with the IRS.
        </li>
        <li>
          Confidence scores and risk ratings are estimates, not guarantees of accuracy or
          audit outcomes.
        </li>
      </ul>

      <h2>3. CPA Review</h2>
      <p>
        When you engage a CPA through the platform, you enter a professional relationship
        governed by that CPA&apos;s engagement terms. TaxMate AI facilitates matching and
        document exchange only.
      </p>

      <h2>4. Subscriptions &amp; Refunds</h2>
      <p>
        Paid plans renew automatically unless cancelled. Refund policies are disclosed at
        checkout. CPA review fees may be subject to separate terms.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, TaxMate AI shall not be liable for tax
        penalties, interest, audit adjustments, or consequential damages arising from use
        of the Service or reliance on AI outputs.
      </p>

      <h2>6. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard
        to conflict-of-law principles.
      </p>
    </article>
  );
}
