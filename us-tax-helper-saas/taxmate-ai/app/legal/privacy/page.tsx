import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | TaxMate AI',
};

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: May 2026</p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>Account data (name, email, OAuth profile)</li>
        <li>Tax documents you upload (W-2, 1099, receipts, prior returns)</li>
        <li>Chat messages and AI interaction logs</li>
        <li>Payment information (processed by Stripe — we do not store full card numbers)</li>
        <li>Device and usage analytics (if enabled)</li>
      </ul>

      <h2>2. IRC §7216 &amp; Tax Return Information</h2>
      <p>
        Federal law (Internal Revenue Code §7216) restricts disclosure of tax return
        information. We use your data only to provide the Service, facilitate CPA review
        with your consent, and comply with legal obligations. We do not sell tax return
        data to third parties for marketing.
      </p>
      <p>
        Before a CPA accesses your return, you authorize disclosure via the platform&apos;s
        CPA matching and review workflow. CPAs are independent professionals responsible
        for their own §7216 compliance.
      </p>

      <h2>3. AI Processing</h2>
      <p>
        Document text and images may be processed by third-party AI providers (e.g., OpenAI)
        under data processing agreements. We minimize data sent and instruct processors not
        to use your data for model training where contractually available.
      </p>

      <h2>4. Data Retention &amp; Deletion</h2>
      <p>
        You may export or request deletion of your data via Settings → Data Export. We
        retain records as required for legal, tax, and fraud-prevention purposes.
      </p>

      <h2>5. Security</h2>
      <p>
        We use encryption in transit (TLS), encrypted storage, access controls, and
        regular security reviews. No system is 100% secure.
      </p>

      <h2>6. Your Rights (GDPR / CCPA)</h2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct, delete, or
        port your personal data. Contact privacy@taxmate.ai for requests.
      </p>

      <h2>7. Contact</h2>
      <p>privacy@taxmate.ai</p>
    </article>
  );
}
