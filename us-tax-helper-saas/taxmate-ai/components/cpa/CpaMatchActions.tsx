'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function CpaMatchActions({ matchRequestId }: { matchRequestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: 'accept' | 'decline') {
    setLoading(true);
    const res = await fetch('/api/cpa/match', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchRequestId, action }),
    });
    setLoading(false);

    if (res.ok && action === 'accept') {
      const data = await res.json();
      router.push(data.reviewUrl ?? '/cpa/dashboard');
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={loading} onClick={() => handleAction('accept')}>
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => handleAction('decline')}
      >
        Decline
      </Button>
    </div>
  );
}
