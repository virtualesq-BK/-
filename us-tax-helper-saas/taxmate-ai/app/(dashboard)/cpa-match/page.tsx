import { CpaMatchBrowser } from '@/components/cpa/CpaMatchBrowser';

export default function CpaMatchPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Find a CPA</h1>
        <p className="text-muted-foreground">
          Match with a licensed CPA for your 10-minute verification session
        </p>
      </div>
      <CpaMatchBrowser />
    </div>
  );
}
