import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="tm-fade-up max-w-2xl text-center">
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          AI 세금 초안 + CPA 10분 검증
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          TaxMate AI
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          AI drafts your tax return. A licensed CPA verifies it in 10 minutes.
          Built for US freelancers, LLCs, and single-member S-Corps.
        </p>
      </div>
      <div className="tm-fade-up tm-fade-up-delay-1 flex gap-4">
        <Button asChild size="lg">
          <Link href="/signup">Get Started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
      <footer className="tm-fade-up tm-fade-up-delay-2 text-center text-xs text-muted-foreground">
        <Link href="/legal/terms" className="hover:text-primary hover:underline">
          Terms
        </Link>
        {' · '}
        <Link href="/legal/privacy" className="hover:text-primary hover:underline">
          Privacy
        </Link>
        {' · '}
        <Link href="/api/health" className="hover:text-primary hover:underline">
          Status
        </Link>
      </footer>
    </main>
  );
}
