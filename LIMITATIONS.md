# Known limitations

This build delivers the smallest working version of the core loop, as requested — not the full spec. This is a record of what's deliberately deferred, and a couple of accepted trade-offs, so nothing here comes as a surprise later.

## Deferred features (not built in this slice)

- **Supplier verification document upload** — file attachments are built for requests and responses (see below), but the supplier onboarding form still doesn't accept verification documents; admins verify suppliers on trust for now.
- **Multi-member organisation teams** — one user per organisation. The schema has `organisation_members` and role columns (`owner`/`manager`/`contributor`/`viewer`) ready for this, and RLS policies are written against membership rather than a single owner column, but there's no invite flow and onboarding always creates the user as `owner`.
- **Real transactional email delivery** — the Resend abstraction logs to console when `RESEND_API_KEY` is unset (the default for local dev). Wiring a real key makes it send for real; no other code changes needed.
- **HighLevel integration** — not started. Nothing in this codebase assumes or depends on it.
- **Full category/region admin management** — categories are seeded directly via migration (7 categories, not the spec's full 25); no admin screen to add/reorder/deactivate them. Regions are replaced entirely by free-text postcode prefixes, per your instruction.
- **Audit log, complaints, notification centre UI, terms/privacy page content** — none built. Draft legal pages, an audit trail, and a complaints workflow are all spec requirements for the fuller build.
- **Terms acceptance record** — the onboarding and request/response forms require the checkbox to be ticked (enforced by Zod), but no `terms_acceptances` row is persisted with a timestamp/version, unlike the fuller spec.
- **Super admin vs admin distinction** — one `platform_admin` organisation type covers both; no separate super-admin permissions (managing other admins, system settings, integration config).
- **Response version history** — only `updated_at` is tracked, not a full history table.
- **Provider private notes on a response** — the `provider_response_notes` table and its RLS exist (so it's ready), but there's no UI to write to it yet.
- **Playwright end-to-end tests** — not included. The live-database integration tests (`src/lib/integration/rls.test.ts`) cover the equivalent permission/anonymity guarantees at the layer where they're actually enforced (Postgres RLS), which is arguably more valuable than browser-level e2e for this specific risk area, but they don't exercise the UI itself.

## Simplifications within what *was* built

- **Withdrawing a response is terminal.** The `unique(request_id, supplier_org_id)` constraint means a supplier can't submit a fresh response after withdrawing — matches "one response per supplier per request" literally, but means withdrawal forecloses re-entering that request.
- **Admin "Approve & publish" is one action**, not the fuller spec's separate approve → set-live steps, and there's no "reject" or "return for changes" flow — an admin either publishes a submitted request or leaves it pending.
- **A rejected introduction can't be re-requested** for the same response (`unique(response_id)` on `introductions`).
- **No separate "unverified/suspended" messaging for suppliers beyond the dashboard banner** shown in this build.

## Accepted trade-offs

- **`npm audit` shows one moderate advisory** (PostCSS, bundled inside Next.js's own dependency tree — an XSS-in-CSS-stringification issue that's build-time only, not reachable at runtime here). `npm audit fix --force` would downgrade Next.js to a years-old canary release to "fix" it, which is a much worse trade. Left as-is; worth revisiting next time Next.js bumps its bundled PostCSS.
- **Supabase's built-in email service has a very low rate limit** (a handful of emails per hour on the free/shared sending infrastructure) — fine for the odd real signup, not for repeated testing. All manual/automated testing in this build used the `auth.admin.createUser` API with `email_confirm: true` to sidestep it entirely, which is also the right pattern for the seed script. Set `RESEND_API_KEY` (or another provider) before relying on real signup emails at any volume.
- **`src/types/database.ts` is hand-written**, matching `supabase/migrations/*.sql`, rather than generated via `supabase gen types typescript`. That command requires Docker/Podman locally to spin up `postgres-meta`, which wasn't available in this environment. Regenerate it once Docker is available, and reconcile any drift against the hand-written version.
- **Direct Postgres connections to this Supabase project are IPv6-only**; the Supavisor pooler (IPv4) was used instead for all `supabase db push` / `gen types` calls in this build. Same applies wherever you next run these commands unless your network has IPv6.

## Bugs found and fixed during end-to-end testing

Worth knowing about even though fixed, since they show up in the migration history (`0006`–`0010`):

- The onboarding RPC's initial `status` value didn't cast to the `organisation_status` enum — every onboarding attempt failed until fixed.
- The supplier coverage-prefix validation reused the single-postcode regex (which requires a digit, e.g. `KA5`), silently rejecting valid broad coverage areas like `KA`.
- Three separate write-rule triggers (`introductions` insert, `requests`/`responses` update, `introductions` decision) unconditionally required an authenticated actor matching a specific role, so trusted service-role writes (the seed script, and any future backend job) were silently rejected with "Not authorised" even though they'd already bypassed RLS entirely. Fixed by trusting a null `auth.uid()` as an already-trusted caller in each.

## Attachments (added after the initial core-loop build)

Requests and responses now support file attachments: a private Supabase Storage bucket, `storage.objects` RLS policies that mirror the request/response access rules (keyed by path, so a file can never leak to someone who couldn't already see its metadata row), and signed 5-minute download URLs. Providers choose per-file whether it's visible to matched suppliers before introduction or kept private; suppliers get an anonymity warning on response attachments, since a file with their letterhead could reveal their identity before an introduction is approved. Covered by dedicated integration tests (`src/lib/integration/attachments.test.ts`) rather than browser e2e, since the remote browser tooling used to build this can't drive a native OS file picker — see that test file for what's actually exercised (private-vs-visible access, cross-supplier isolation, forged-path upload rejection).

Not included in this pass: a file count/size indicator on the opportunity feed cards, virus scanning, and image thumbnails/previews (downloads only, no inline preview).

## Messaging (added after attachments)

Providers and suppliers can exchange threaded messages about a request - one thread per (request, supplier) pair, so different suppliers' conversations are fully isolated from each other and from anyone else. Identity is hidden with role labels ("You" / "Supplier A", matching the same label used in the response comparison view, computed once and shared between both) until an introduction is approved, at which point real organisation names appear automatically - the reveal isn't a separate code path, it just follows from `organisations`/`profiles` RLS finally allowing the query through, the same mechanism already used for responses.

Every message passes through a database trigger that flags ones which look like they contain an email address, a phone number, or a request to move the conversation off-platform (WhatsApp, "call me", etc.) - always recomputed server-side, so a client can't submit a fake "clean" flag. Admins see flagged messages (with real names) at `/admin/messages` and on each request's detail page; providers and suppliers never see the flag itself, only the message content, so the mechanism doesn't tip off anyone trying to route around it. It's a review heuristic, not a hard block - flagged messages still send.

Not included: editing or deleting a sent message, an "unflag"/resolve action for admins, real-time delivery (the thread reloads on send/refresh, no live updates from the other party), and messaging before a supplier has engaged with a request at all (a provider can only open a thread with a supplier who's already responded, since they'd otherwise have no organisation id to address - suppliers can message before responding, as a clarification-question path).

Covered by `src/lib/integration/messages.test.ts`: cross-supplier thread isolation (can't read, can't insert into another supplier's thread even by guessing its id), identity staying hidden through a live conversation until introduction approval, and the flagging trigger catching email/phone/off-platform content sent through real authenticated RLS-gated inserts (not just admin-authored rows) - including proof that a client-supplied `flagged: false` is ignored.

## Recommended next five tasks

1. Build the admin category/region management screens and expand the seeded category list to match the full spec.
2. Add supplier verification document upload during onboarding, reusing the attachment infrastructure now in place.
3. Persist terms acceptance (`terms_versions` / `terms_acceptances`) and build the draft legal pages.
4. Add a notification-centre UI on top of the existing `notifications` table (already populated by triggers; there's just no page to read it yet), and extend it to cover new messages and flagged-message review.
5. Add Playwright e2e tests covering the full UI click-path for the 12 scenarios listed in the original spec (now feasible to include file upload, since Playwright *can* drive a native file input where this session's remote-browser tool couldn't), complementing the existing RLS integration tests.
