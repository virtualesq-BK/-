'use client';

import type { TaxDraft, TaxLineItem } from '@/lib/tax/draft-types';
import { cn } from '@/lib/utils';

type DocumentRef = {
  id: string;
  fileName: string;
  documentType: string;
  aiExtractedData: unknown;
};

function confidenceColor(confidence: number) {
  if (confidence >= 90) return 'text-green-600 bg-green-50';
  if (confidence >= 70) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function LineItemRow({ item, label }: { item: TaxLineItem; label?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 text-sm last:border-0">
      <div>
        <span className="font-medium">
          {label ?? `${item.form} Line ${item.line}`}
        </span>
        <p className="text-muted-foreground">{item.description}</p>
        <p className="text-xs text-muted-foreground">Source: {item.source}</p>
      </div>
      <div className="text-right">
        <p className="font-mono font-semibold">${item.amount.toLocaleString()}</p>
        <span
          className={cn(
            'mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium',
            confidenceColor(item.confidence)
          )}
        >
          {item.confidence}% confidence
        </span>
        {item.requiresCpaReview && (
          <p className="mt-1 text-xs text-red-600">CPA review required</p>
        )}
        {item.requiresUserConfirmation && !item.requiresCpaReview && (
          <p className="mt-1 text-xs text-amber-600">User confirmation needed</p>
        )}
      </div>
    </div>
  );
}

export function DraftDiffViewer({
  draft,
  documents,
  modifiedItems,
}: {
  draft: TaxDraft | null;
  documents: DocumentRef[];
  modifiedItems?: TaxLineItem[];
}) {
  if (!draft) {
    return (
      <p className="text-sm text-muted-foreground">No AI draft available.</p>
    );
  }

  const displayItems = modifiedItems ?? [
    ...draft.scheduleC.lineItems,
    ...draft.form8995.lineItems,
    ...draft.form1040Summary.lineItems,
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">AI Draft (Schedule C / 8995 / 1040)</h3>
        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded bg-green-50 p-2">
            <p className="font-bold text-green-700">{draft.summary.autoIncludedCount}</p>
            <p className="text-green-600">Auto (≥90%)</p>
          </div>
          <div className="rounded bg-amber-50 p-2">
            <p className="font-bold text-amber-700">{draft.summary.userConfirmCount}</p>
            <p className="text-amber-600">Confirm (70-90%)</p>
          </div>
          <div className="rounded bg-red-50 p-2">
            <p className="font-bold text-red-700">{draft.summary.cpaReviewCount}</p>
            <p className="text-red-600">CPA (&lt;70%)</p>
          </div>
        </div>
        {displayItems.map((item, i) => (
          <LineItemRow key={`${item.form}-${item.line}-${i}`} item={item} />
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 font-semibold">Source Documents</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No uploaded documents.</p>
        ) : (
          <ul className="space-y-3">
            {documents.map((doc) => {
              const extracted = doc.aiExtractedData as Record<string, unknown> | null;
              return (
                <li key={doc.id} className="rounded border p-3 text-sm">
                  <p className="font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">{doc.documentType}</p>
                  {extracted && (
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(extracted, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
