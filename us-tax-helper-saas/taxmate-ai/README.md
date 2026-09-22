# TaxMate AI

AI-powered tax filing assistant for US self-employed workers, with licensed CPA review.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind, shadcn/ui |
| Backend | Next.js API Routes, Prisma, PostgreSQL |
| Auth | NextAuth.js (Google OAuth) |
| AI | Vercel AI SDK, OpenAI, LangChain, Pinecone |
| Queue | BullMQ + Upstash Redis |
| Storage | AWS S3 or Vercel Blob |
| Payments | Stripe + Stripe Connect |
| Deploy | Vercel |

---

## Local Development

```bash
cd taxmate-ai
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL (can match DATABASE_URL locally), OPENAI_API_KEY, etc.
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Optional services

```bash
npm run worker:documents   # BullMQ document processor (needs REDIS_URL)
npm run ingest:irs         # Index IRS publications
npm run seed:cpa           # CPA test accounts
```

---

## Production Deployment (Vercel)

### 1. Prerequisites

- [Vercel](https://vercel.com) account (Pro for Cron Jobs)
- PostgreSQL: [Supabase](https://supabase.com), [Neon](https://neon.tech), or RDS
- [Upstash Redis](https://upstash.com) (REST + TCP URL)
- [OpenAI](https://platform.openai.com) API key
- [Pinecone](https://pinecone.com) index (dim **1536**)
- AWS S3 bucket or Vercel Blob
- [Stripe](https://stripe.com) + Connect
- [Resend](https://resend.com) for email
- [Sentry](https://sentry.io) (recommended)
- Google OAuth credentials

### 2. Database setup

```bash
# Use DIRECT_URL for migrations (direct connection, port 5432)
# Use DATABASE_URL for runtime (pooled, e.g. Supabase port 6543)

npx prisma migrate deploy
```

In Supabase/Neon, enable connection pooling and set both URLs in Vercel.

### 3. Vercel project

1. Import Git repository
2. **Root directory:** `taxmate-ai`
3. **Build command:** `prisma generate && next build` (also in `vercel.json`)
4. **Install command:** `npm install`

### 4. Environment variables

Copy every variable from [`.env.production`](./.env.production) into **Vercel → Settings → Environment Variables** (Production).

Critical variables:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Pooled connection string |
| `DIRECT_URL` | Direct connection for Prisma migrate |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` |
| `CRON_SECRET` | Random string; Vercel sends as `Authorization: Bearer` |
| `OPENAI_API_KEY` | Required for AI features |
| `REDIS_URL` | `rediss://` Upstash TCP URL |
| `STORAGE_PROVIDER` | `s3` recommended for production |

Vercel encrypts environment variables at rest.

### 5. Stripe webhook

```bash
stripe listen --forward-to https://your-domain.vercel.app/api/webhooks/stripe
```

Add `STRIPE_WEBHOOK_SECRET` from Stripe Dashboard or CLI.

### 6. Document worker (separate service)

Vercel serverless cannot run long-running BullMQ workers. Deploy worker on **Railway**, **Render**, or **Fly.io**:

```bash
npm run worker:documents
```

Set same `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, storage vars.

Without worker, uploads use **inline processing** (slower, timeout risk on large PDFs).

### 7. IRS vector index (one-time)

```bash
VECTOR_STORE=pinecone npm run ingest:irs
```

Run from CI or local machine with production Pinecone key.

### 8. Cron jobs

Configured in [`vercel.json`](./vercel.json):

| Schedule | Path | Purpose |
|----------|------|---------|
| Mon 14:00 UTC | `/api/cron/weekly-tax-update` | Re-aggregate income |
| 1st of Jan/Apr/Jul/Oct | `/api/cron/quarterly-reminders` | Estimated tax reminders |
| Daily 06:00 UTC | `/api/cron/process-payouts` | CPA Stripe payouts |

Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.

### 9. Health check

```bash
curl https://your-domain.vercel.app/api/health
```

Returns `200` (healthy/degraded) or `503` (unhealthy). Use for uptime monitors (Better Uptime, Pingdom).

### 10. Sentry

1. Create Sentry project (Next.js)
2. Set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
3. Optional: `SENTRY_ORG`, `SENTRY_PROJECT` for source maps

### 11. Post-deploy checklist

- [ ] Google OAuth redirect URIs include production domain
- [ ] `NEXTAUTH_URL` matches production URL
- [ ] Stripe live keys + webhook
- [ ] S3 bucket CORS / public read policy if needed
- [ ] Run `prisma migrate deploy`
- [ ] Test `/api/health`
- [ ] Legal pages: `/legal/terms`, `/legal/privacy`
- [ ] CPA review flow end-to-end

---

## API Reference (Production)

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Service health |
| `POST /api/feedback` | AI response rating (1–5) |
| `GET /api/cron/*` | Scheduled jobs (auth required) |

---

## Legal

- [Terms of Service](/legal/terms)
- [Privacy Policy](/legal/privacy) — IRC §7216 considerations
- [CPA Platform Agreement](/legal/cpa-agreement)

**Attorney review required** before production launch. Templates are not legal advice.

---

## Project Structure

```
taxmate-ai/
├── app/                 # Pages & API routes
├── components/          # UI components
├── lib/                 # Business logic
│   ├── ai/              # RAG, extraction, drafts
│   ├── monitoring/      # Logger, Sentry, metrics
│   ├── notifications/   # Email, SMS, in-app
│   └── irs/             # e-file mock
├── prisma/              # Schema & migrations
├── vercel.json          # Build & cron config
└── .env.production      # Production env template
```

---

## Phase History

| Phase | Feature |
|-------|---------|
| 1 | Prisma schema, auth |
| 2 | RAG chatbot |
| 3 | Document upload & AI extraction |
| 4 | CPA matching & review, e-file mock |
| 5 | Onboarding, dashboard, notifications |
| 6 | Production deploy, monitoring, legal |

---

## License

Proprietary. All rights reserved.
