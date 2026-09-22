import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';

// Same Korean-friendly display font family as "The Beginning" (Pretendard
// stack), via next/font/google so it's self-hosted and doesn't need the
// Pretendard CDN.
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'TaxMate AI — Self-Employed Tax Filing Assistant',
  description:
    'AI-powered tax draft preparation with CPA review for US freelancers and small business owners.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${notoSansKr.variable} font-sans`}>{children}</body>
    </html>
  );
}
