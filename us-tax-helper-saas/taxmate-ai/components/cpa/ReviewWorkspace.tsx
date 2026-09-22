'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DraftDiffViewer } from './DraftDiffViewer';
import {
  CpaModificationSchema,
  type CpaModification,
} from '@/lib/cpa/review';
import type { TaxDraft, TaxLineItem } from '@/lib/tax/draft-types';

type ReviewData = {
  taxReturn: { id: string; taxYear: number; status: string };
  documents: Array<{
    id: string;
    fileName: string;
    documentType: string;
    aiExtractedData: unknown;
  }>;
  draft: TaxDraft | null;
  review: {
    elapsedMinutes: number;
    targetMinutes: number;
    onTrack: boolean;
  };
};

export function ReviewWorkspace({ taxReturnId }: { taxReturnId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [lineItems, setLineItems] = useState<TaxLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const { register, handleSubmit } = useForm({
    defaultValues: { cpaNotes: '', taxpayerPin: '' },
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/cpa/review/${taxReturnId}`);
    if (!res.ok) {
      setError('Failed to load review');
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setElapsed(json.review.elapsedMinutes);

    const draft = json.draft as TaxDraft | null;
    if (draft) {
      setLineItems([
        ...draft.scheduleC.lineItems,
        ...draft.form8995.lineItems,
        ...draft.form1040Summary.lineItems,
      ]);
    }
    setLoading(false);
  }, [taxReturnId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => setElapsed((e) => e + 1 / 60), 1000);
    return () => clearInterval(timer);
  }, [load]);

  const updateLineAmount = (index: number, amount: number) => {
    setLineItems((items) =>
      items.map((item, i) => (i === index ? { ...item, amount } : item))
    );
  };

  const saveDraft = async (values: { cpaNotes: string }) => {
    setSaving(true);
    setError(null);
    const modifications: CpaModification = CpaModificationSchema.parse({
      lineItems,
      cpaNotes: values.cpaNotes,
    });

    const res = await fetch(`/api/cpa/review/${taxReturnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', cpaModifications: modifications }),
    });

    setSaving(false);
    if (!res.ok) {
      setError('Save failed');
      return;
    }
    setSuccess('Modifications saved.');
  };

  const approveAndSign = async (values: { cpaNotes: string; taxpayerPin: string }) => {
    setApproving(true);
    setError(null);

    const modifications: CpaModification = {
      lineItems,
      cpaNotes: values.cpaNotes,
    };

    const res = await fetch(`/api/cpa/review/${taxReturnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        cpaModifications: modifications,
        taxpayerPin: values.taxpayerPin || undefined,
        reviewFee: 99,
      }),
    });

    setApproving(false);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? 'Approval failed');
      return;
    }

    const result = await res.json();
    setSuccess(
      `Approved in ${result.durationMinutes} min. Compensation: $${result.compensation}. Form 8879 generated.`
    );
    setTimeout(() => router.push('/cpa/dashboard'), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-destructive">{error ?? 'Not found'}</p>;
  }

  const onTrack = elapsed <= 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CPA Review — {data.taxReturn.taxYear}</h1>
          <p className="text-muted-foreground">Return ID: {taxReturnId}</p>
        </div>
        <Card className={onTrack ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5" />
            <div>
              <p className="font-semibold">
                {Math.floor(elapsed)}:{String(Math.floor((elapsed % 1) * 60)).padStart(2, '0')} elapsed
              </p>
              <p className="text-xs">Target: 10 minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </p>
      )}

      <DraftDiffViewer
        draft={data.draft}
        documents={data.documents}
        modifiedItems={lineItems}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Edit Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lineItems.map((item, index) => (
            <div key={index} className="flex items-center gap-4">
              <span className="w-48 truncate text-sm">
                {item.form} L{item.line}: {item.description}
              </span>
              <Input
                type="number"
                value={item.amount}
                onChange={(e) => updateLineAmount(index, Number(e.target.value))}
                className="w-32"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <form className="space-y-4" onSubmit={handleSubmit(approveAndSign)}>
        <div className="space-y-2">
          <Label htmlFor="cpaNotes">CPA Notes</Label>
          <Input id="cpaNotes" {...register('cpaNotes')} placeholder="Review notes..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxpayerPin">Taxpayer PIN (Form 8879)</Label>
          <Input
            id="taxpayerPin"
            {...register('taxpayerPin')}
            placeholder="5-digit PIN"
            maxLength={5}
          />
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={handleSubmit(saveDraft)}
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button type="submit" disabled={approving}>
            {approving ? 'Processing...' : 'Approve & Sign (Form 8879)'}
          </Button>
        </div>
      </form>
    </div>
  );
}
