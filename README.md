# Care Request Hub

A protected B2B request-and-supplier-matching platform for the UK care sector, hosted by The Care Connector Network. Care providers post business purchasing/service requests without exposing their identity; verified suppliers see only the anonymous version and respond; the provider chooses who to meet, and contact details are revealed only after an approved introduction.

**This build covers the core loop only** — see [Scope](#scope) below for what's deliberately not built yet.

## Scope

Implemented and verified end-to-end:

- Provider signs up, completes onboarding, creates and submits a request
- Admin approves and publishes the request
- A verified, matching supplier sees **only** the anonymous version of the request (no provider identity, anywhere)
- Supplier submits a structured response
- Provider compares responses (anonymised as "Supplier A/B/C"), shortlists one
- Provider requests an introduction; admin approves it
- Both parties then see each other's real name and contact details

Location matching uses a postcode prefix (e.g. `KA5`) rather than broad regions: a provider's request carries one prefix, a supplier lists the prefixes it covers (e.g. `KA` covers `KA1`–`KA30`).

Also built:

- **File attachments** for requests and responses (Supabase Storage, private bucket, signed time-limited download URLs). Providers choose per-file whether it's visible to matched suppliers before introduction or kept private; RLS on `storage.objects` mirrors the request/response access rules so a file can never leak to someone who couldn't already see its metadata.
- **Threaded messaging** between a provider and a specific supplier about a request - one thread per (request, supplier) pair, fully isolated from other suppliers' threads. Role labels ("You" / "Supplier A") until an introduction is approved, then real names appear automatically via the same RLS that already gates them elsewhere. Every message passes through a database trigger that flags likely email addresses, phone numbers, or requests to move off-platform, visible to admins at `/admin/messages` - a review heuristic, not a hard block, and never shown to the two parties themselves.

Deliberately **not** built in this slice (see [LIMITATIONS.md](LIMITATIONS.md) for the full list): supplier verification document upload, multi-member organisation teams, real transactional email delivery, HighLevel integration, the full 25-category/region admin screens, audit log UI, complaints, terms-acceptance records, and super-admin vs admin distinction.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Row Level Security) · Zod · React Hook Form · Vitest

## Prerequisites

- Node.js 20+ (uses `node --env-file`)
- A Supabase project ([supabase.com](https://supabase.com), free tier, no card required)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`, no install needed) to apply migrations
- **Docker is not required** for this workflow — migrations are pushed directly to your cloud project rather than run against a local Supabase stack. (If you do have Docker and prefer local development, `supabase start` also works with these same migration files.)

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then from **Project Settings → API** copy the Project URL, anon/publishable key, and service_role/secret key. From **Project Settings → Database → Connection pooling**, note the pooler hostname (e.g. `aws-0-eu-west-1.pooler.supabase.com`) — direct connections are IPv6-only, so most networks need the pooler for the CLI steps below.

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Leave `RESEND_API_KEY` and the HighLevel variables empty for local dev — see [Notifications](#notifications) below.

4. **Apply database migrations**

   ```bash
   npx supabase db push --db-url "postgresql://postgres.<project-ref>:<url-encoded-password>@<pooler-host>:5432/postgres"
   ```

   Replace `<project-ref>` (from your project URL), `<url-encoded-password>` (your database password, set at project creation — percent-encode any special characters, e.g. `@` → `%40`), and `<pooler-host>` with the values from step 2. This runs all files in `supabase/migrations/` in order — schema, RLS policies, triggers, and seed categories.

5. **Seed demo data**

   ```bash
   npm run seed
   ```

   Creates fictional demo accounts and sample requests/responses/an introduction (see [Demo accounts](#demo-accounts)). Safe to re-run — it's idempotent.

6. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open the printed local URL (defaults to `http://localhost:3000`, but picks a free port if that one's in use).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest — unit tests always run; live Supabase integration tests run only when `.env.local` has credentials (skipped otherwise) |
| `npm run seed` | Idempotent demo data seed |

## Demo accounts

Created by `npm run seed`. Password for all: `DemoPass123!`

| Email | Role | Notes |
| --- | --- | --- |
| `admin@example.com` | Admin | Full visibility, approves requests/suppliers/introductions |
| `provider1@example.com` | Provider | Ayrshire Care Homes Group (KA5) — has an open request with a shortlisted response |
| `provider2@example.com` | Provider | Glasgow Residential Care Ltd (G2) — has a request with an **approved introduction** (log in as this or `supplier2@example.com` to see revealed contact details) |
| `supplier1@example.com` | Supplier | Ayrshire Training Solutions — verified, covers KA |
| `supplier2@example.com` | Supplier | Glasgow IT Support Co — verified, covers G |
| `supplier3@example.com` | Supplier | Pending Verification Supplies Ltd — **not yet verified**, log in as `admin@example.com` to verify it via Suppliers |

These are placeholder accounts with obviously fictional names on `example.com` — never point this seed script at a production project.

## Notifications

In-app notifications (visible via a `notifications` table, no UI page built yet in this slice) are created automatically by Postgres triggers on the key events: request approved, response submitted, introduction decided.

Email notifications use a Resend-compatible abstraction (`src/lib/email/send.ts`). With no `RESEND_API_KEY` set, it logs to the server console instead of sending — this is the default for local dev, so you don't need an email provider to exercise the full loop.

## Tests

`npm run test` runs:

- **Unit tests** (always run, no network) — Zod validation schemas, the anonymous-request serializer's allow-list, status-label completeness.
- **Integration tests** (skipped automatically unless `.env.local` has Supabase credentials) — hit the live database to prove the actual RLS policies and triggers, not just application intent: anonymous access is blocked, a supplier can never read a provider org (or vice versa) before an introduction, unverified suppliers see zero requests, one supplier can't see another's response, duplicate responses are rejected, contact details are gated on an approved introduction, file attachment storage RLS (`src/lib/integration/attachments.test.ts`), and messaging - cross-supplier thread isolation, identity hidden until introduction, and the contact-info flagging trigger catching real RLS-gated inserts (`src/lib/integration/messages.test.ts`).

Playwright end-to-end tests are not included in this slice — the integration test suite above covers the equivalent permission/anonymity guarantees at the database layer, which is where they're actually enforced.

## Deployment

Not deployed as part of this build. To deploy:

1. Push this repository to GitHub.
2. Apply `supabase/migrations/` to your production Supabase project (same `supabase db push` command as local setup, pointed at the production project).
3. Import the repo into Vercel, set the environment variables from `.env.example` in the Vercel project settings (**never** commit real values), and deploy.
4. `SUPABASE_SERVICE_ROLE_KEY` must only ever be set as a server-side environment variable — it is never read by client code in this codebase (grep confirms no `NEXT_PUBLIC_` prefix on it).

## Known limitations

See [LIMITATIONS.md](LIMITATIONS.md) for the full list of what's deliberately deferred, plus a couple of accepted trade-offs (e.g. Next.js's bundled PostCSS has an unpatched moderate advisory; fixing it via `npm audit fix --force` would downgrade Next.js itself, so it's left as-is).
