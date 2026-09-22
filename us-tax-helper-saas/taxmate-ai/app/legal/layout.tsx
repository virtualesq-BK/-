import Link from 'next/link';
import { LegalDisclaimer } from '@/components/legal/LegalDisclaimer';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-primary">
            TaxMate AI
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/cpa-agreement">CPA Agreement</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 prose prose-slate max-w-none">
        <LegalDisclaimer />
        {children}
      </main>
    </div>
  );
}
