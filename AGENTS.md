<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. Notably: route protection lives in `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts` — the exported function is `proxy`, not `middleware`).
<!-- END:nextjs-agent-rules -->

# Care Request Hub

## What this is

A protected B2B request/supplier-matching platform for the UK care sector. See [README.md](README.md) for setup and [LIMITATIONS.md](LIMITATIONS.md) for what's deliberately not built yet. This is the core-loop MVP slice, not the full original spec.

## Non-negotiables

- **Use UK English throughout** (organisation, not organization; postcode, not zip code; etc.) in every string a user might see, and in commit messages/docs.
- **Preserve provider anonymity.** A supplier must never be able to resolve a provider's identity (or vice versa) before an approved introduction — not via a direct query, not via a joined field, not via a UUID that happens to be resolvable through another table. The anonymity boundary is enforced in Postgres RLS (`supabase/migrations/0003_rls.sql`), not just hidden in the UI. If you add a column to `requests` or `responses`, ask whether it could leak identity before exposing it to the other party's queries — and prefer the explicit allow-list serializer pattern in `src/lib/domain/serialize.ts` as a second, independent guard.
- **Never expose the service-role key to the browser.** It's read only in `src/lib/supabase/admin.ts` (guarded by the `server-only` import) and `scripts/seed.mjs`. Application request handlers must use the session-bound client from `src/lib/supabase/server.ts` so RLS stays the actual enforcement point.
- **Enforce permissions server-side and via RLS**, never only by hiding a button or route. Every table has RLS enabled with default-deny; new tables need the same.
- **Do not introduce real personal or care-recipient data anywhere** — seed/demo/test data must stay obviously fictional (see the existing `scripts/seed.mjs` and integration test fixtures for the pattern: `@example.com` addresses, fictional org names).
- **Run tests after changes**: `npm run typecheck && npm run lint && npm run test && npm run build`. The integration tests in `src/lib/integration/` hit the live Supabase project configured in `.env.local` and are the main line of defence for the anonymity guarantee above — don't skip them when touching RLS policies, triggers, or the requests/responses/introductions schema.
- **Do not weaken security merely to make a test pass.** If an RLS policy or trigger seems to be blocking something that should legitimately work, fix the policy/trigger correctly (see the `0006`–`0010` migrations for real examples of this — trusted service-role writes needed a `auth.uid() is null` bypass added to several triggers, not an RLS policy loosened).
- **Update documentation when architecture or setup changes** — particularly README.md's setup steps and LIMITATIONS.md if you build something previously listed as deferred.
- **Prefer small, reviewable changes.** Each schema change should be its own migration file (append-only — never edit an already-applied migration; add a new one that fixes it, as the `0006`+ migrations do).

## Database workflow

Migrations live in `supabase/migrations/`, applied with `supabase db push --db-url "..."`. Direct Postgres connections to Supabase are IPv6-only; if the environment lacks IPv6 (common), use the Supavisor pooler connection string instead (`postgres.<project-ref>` username, `aws-0-<region>.pooler.supabase.com:5432` host — see README.md step 4). `supabase gen types typescript` requires Docker/Podman for `postgres-meta`; if unavailable, hand-edit `src/types/database.ts` to match the migration and keep it structurally correct (every table needs `Relationships: []` or supabase-js's generic types collapse to `never`).

## Testing conventions

- Throwaway verification scripts (`.mjs` files used to poke the live database while debugging) belong in the project root temporarily and must be deleted before committing — `git status` should never show a stray `*.mjs` outside `scripts/seed.mjs`.
- When creating test users via `auth.admin.createUser`, always pass `email_confirm: true` and use `@example.com` addresses — Supabase's self-serve `signUp()` validates domain deliverability and will reject fake domains outside the admin API, and its shared email-sending has a very low rate limit unsuited to repeated testing.
- In any test file that creates more than one Supabase client in the same process (e.g. a provider client and a supplier client), pass `{ auth: { persistSession: false, autoRefreshToken: false } }` to every `createClient()` call. Without it, multiple GoTrueClient instances share storage/broadcast state and silently clobber each other's session — this caused real test failures during development (see `src/lib/integration/rls.test.ts`).
