import { AlertTriangle } from 'lucide-react';

export function LegalDisclaimer() {
  return (
    <div className="mb-8 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p>
        <strong>Important:</strong> This document is provided for informational purposes
        only and does not constitute legal or tax advice. A licensed attorney should
        review all terms before production use. TaxMate AI is not a law firm or CPA firm.
      </p>
    </div>
  );
}
