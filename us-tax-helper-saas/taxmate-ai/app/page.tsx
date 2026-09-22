import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          TaxMate AI
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          AI drafts your tax return. A licensed CPA verifies it in 10 minutes.
          Built for US freelancers, LLCs, and single-member S-Corps.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/signup">Get Started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
      <footer className="text-center text-xs text-muted-foreground">
        <Link href="/legal/terms" className="hover:underline">
          Terms
        </Link>
        {' · '}
        <Link href="/legal/privacy" className="hover:underline">
          Privacy
        </Link>
        {' · '}
        <Link href="/api/health" className="hover:underline">
          Status
        </Link>
      </footer>
    </main>
  );
}
