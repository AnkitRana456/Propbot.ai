# AUDIT_REPORT.md — Phase 0 (read-only discovery)

## Status
- SPEC received (Comprehensive Business Logic Analysis, §1–9). First-pass comparison below; items marked ⚠️/❌ were confirmed by grep/read, ✅ only where the code was seen. Deeper line-level verification happens in each phase.
- No source code was changed in Phase 0. This file is the only file written.
- `git stash` / branch `feat/business-logic-completion` not done yet (nothing to commit in Phase 0).

## Detected stack (adaptations to the prompt)
| Prompt assumption | Actual | Adaptation |
|---|---|---|
| Next.js + Vercel | pnpm monorepo: `apps/api` (Express 4-style, tsup), `apps/web` (Vite+React), `apps/widget`, `packages/*` | Use Express routers in `apps/api/src/routes` |
| Spec says MongoDB collections + TTL index | PostgreSQL + Drizzle ORM (`apps/api/src/db/schema/*`, migrations) | OTP expiry = `expires_at` column + cleanup job (no TTL index in Postgres); "atomic upsert" = `INSERT ... ON CONFLICT` with unique indexes |
| `src/lib/openai.ts` | LLM code in `apps/api/src/modules/ai/{router,embeddings.service,retrieval.service}.ts`; deps `@langchain/{google-genai,openai,anthropic}` | Single provider module over Gemini; keep others behind `LLM_PROVIDER` |
| Vercel Blob / cron | Dockerfile, docker-compose, render.yaml; worker `apps/api/src/worker.ts` + `jobs/scheduled-jobs.service.ts` | Local/R2 storage; worker for cron-style jobs |
| bcrypt | `bcryptjs` present | OK |
| Lint script | root `pnpm lint` = eslint (see build results) | |

## DB target
`DATABASE_URL` points to `localhost:5432/propbot_pro` (local, but **not** a `_test` DB). Smoke tests will use a separate `propbot_pro_test` DB; I will not run destructive tests against `propbot_pro`.

## Endpoint map (165 route handlers; mounts in `apps/api/src/server.ts:80-112`)
Per router file (method/path detail: re-run the route grep or see source):
crm 23, properties 19, analytics 14, settings 12, users 11, chatbots 10, auth 9, subscription 8, leads 8, knowledge 6, public-chat 5 (mounted at `/api/public/chat` and `/public`), playbooks 5, mcp 5, approvals 5, enterprise 4, webhooks 3, shortlist-room 3, agency 3, healthz 2, events 2, docs 2, appointments 2, whatsapp 1, voice 1, growth 1, dashboard 1.
Mounts: `/api/auth` (with `authRateLimiter`), `/api/dashboard`, `/api/chatbots[/:id/knowledge|playbooks]`, `/api/leads`, `/api/crm`, `/api/properties`, `/api/shortlist-room`, `/api/appointments`, `/api/whatsapp`, `/api/webhooks`, `/api/integrations`, `/api/analytics`, `/api/users`, `/api/agency`, `/api/subscription`, `/api/settings`, `/api/docs`, `/api/approvals`, `/api/events`, `/api/workflows`, `/api/growth`, `/api/voice`, `/api/mcp`, `/api/enterprise`, `/api/status`.

## DB schema files (`apps/api/src/db/schema`)
actions, analytics, appointments, audit, auth-tokens, chatbots, checkpoints, companies, contacts, conversations, enterprise, events, growth, knowledge, leads, organizations, playbooks, properties, re-engagement, subscriptions, users, voice, webhooks, whatsapp, workflows.
Notable absences to check once spec arrives: no OTP table (`auth-tokens.ts` may cover), no `webhook_logs` confirmed yet (`webhooks.ts` to inspect), no chatbot `deletedAt` confirmed.

## Middlewares / jobs / scripts
- middlewares: authenticate, plan-limits, rate-limiter (in-memory Map store — won't hold across instances), rbac, tenant-guard, validate
- jobs: `jobs/scheduled-jobs.service.ts` (run from `worker.ts`)
- scripts: doctor, setup-keys, smoke-chat; seed: `db/seed.ts`, `db/seed-demo.ts`

## Early findings (spec-independent)
1. **Hardcoded credential:** `apps/api/src/db/seed.ts:71` hashes literal `'Password123!'`; grep for `admin@propbot`/`test@propbot` found none in `src`. Seed should read `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. **Typecheck fails** (`pnpm typecheck`): `src/modules/ai/router.ts` lines 117,125,126,131,132,136,142 (possibly-undefined / string|undefined) and `src/modules/crm/copilot.service.ts:90`. Both files have uncommitted edits.
3. **Lint:** root script `eslint . --max-warnings 0` — running via `pnpm lint` at the workspace level failed (`lint` not found in a package); needs `pnpm exec eslint .`. Not yet run.
4. Rate limiter is in-memory (`middlewares/rate-limiter.ts`); `REDIS_URL` exists in env, so a Redis-backed store is feasible.
5. LLM: `@langchain/google-genai` already installed; `GEMINI_API_KEY` present. `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` empty.

## Env vars read by `apps/api/src` vs `.env.example` / `.env` (values never shown)
| Variable | In .env.example | Set in .env |
|---|---|---|
| ALLOW_OFFLINE_MOCK | yes | missing |
| ANTHROPIC_API_KEY | yes | missing |
| API_BASE_URL | **missing** | missing |
| API_URL | yes | present |
| AWS_ACCESS_KEY_ID | **missing** | missing |
| CORS_ORIGIN | yes | missing |
| DATABASE_URL | yes | present |
| DB_MAX_CONNECTIONS | yes | present |
| EMBEDDING_API_KEY | yes | missing |
| ENCRYPTION_KEY | yes | present |
| EXOTEL_ACCOUNT_SID | **missing** | missing |
| EXOTEL_API_KEY | **missing** | missing |
| EXOTEL_API_TOKEN | **missing** | missing |
| EXOTEL_SUBDOMAIN | **missing** | missing |
| GEMINI_API_KEY | yes | present |
| GOOGLE_CLIENT_ID | **missing** | missing |
| GOOGLE_CLIENT_SECRET | **missing** | missing |
| JWT_ACCESS_EXPIRATION | yes | present |
| JWT_ACCESS_SECRET | yes | present |
| LOG_LEVEL | yes | present |
| META_LIVE_DISPATCH | **missing** | missing |
| META_WHATSAPP_PHONE_NUMBER_ID | yes | present |
| META_WHATSAPP_TOKEN | yes | present |
| META_WHATSAPP_WEBHOOK_VERIFY_TOKEN | yes | present |
| MOCK_PROVIDERS | **missing** | missing |
| NODE_ENV | yes | present |
| OPENAI_API_KEY | yes | missing |
| PORT | yes | present |
| R2_ACCESS_KEY_ID | yes | missing |
| R2_BUCKET_NAME | yes | missing |
| RAZORPAY_KEY_ID | yes | missing |
| RAZORPAY_KEY_SECRET | yes | missing |
| RAZORPAY_WEBHOOK_SECRET | **missing** | missing |
| REDIS_URL | yes | present |
| SMTP_HOST | yes | present |
| STRIPE_SECRET_KEY | **missing** | missing |
| STRIPE_WEBHOOK_SECRET | **missing** | missing |
| TELEPHONY_PROVIDER | **missing** | missing |
| WEB_URL | yes | present |
| WHATSAPP_VERIFY_TOKEN | **missing** | missing |

Missing from `.env.example` (add placeholders in Phase 1): API_BASE_URL, AWS_ACCESS_KEY_ID, EXOTEL_*, GOOGLE_CLIENT_ID/SECRET, META_LIVE_DISPATCH, MOCK_PROVIDERS, RAZORPAY_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TELEPHONY_PROVIDER, WHATSAPP_VERIFY_TOKEN.
Spec-driven vars not yet read by code (will be added): GEMINI_MODEL, LLM_PROVIDER, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, CRON_SECRET, Twilio vars, Graph API version.
Note: two WhatsApp verify-token names exist (`META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_VERIFY_TOKEN`) — consolidate.

## Spec checklist (first pass)
Legend: ✅ ok · ⚠️ partial/buggy · ❌ missing. Paths relative to `apps/api/src`.

### §2 Auth, tenancy, RBAC
- ❌ `isActive:false` signup + "pending approval" login rejection: no match for `pending approval`/user `isActive` in `modules/auth` (only SSO config `isActive`, auth.service.ts:150). Needs user column + login check.
- ⚠️ Roles: code uses `super_admin` (middlewares/rbac.ts:16, tenant-guard.ts:22, users.controller.ts:17) instead of spec `ps-owner`; `admin`/`user` roles via `@propbot/shared` UserRole. Decision: keep `super_admin` as alias of `ps-owner`? (see decisions)
- ✅/⚠️ Server-side RBAC + tenant guard exist (`middlewares/rbac.ts`, `tenant-guard.ts`); per-route coverage and cross-company leak tests still to verify.
- ⚠️ Seed: `db/seed.ts:71` hardcodes `Password123!`; no `SEED_ADMIN_*` env.
- ⚠️ Sessions: access JWT + rotating refresh tokens with reuse detection (auth.service.ts:201-232) — good, but spec "30-day JWT refreshed every 24h" not matched; check `JWT_ACCESS_EXPIRATION` and refresh TTL.
- ❌ Auth rate limit: `middlewares/rate-limiter.ts:100-105` is 20/15min in prod, 1000 in dev (spec: 5/15min).

### §3 Leads
- ⚠️ Phone validation: India-only regexes in `modules/leads/leads.service.ts:40-46` (+ loose regex in intent-scorer.service.ts:88). No NANP rule, no 50+ countries, not shared with widget/web.
- ⚠️ Dedup: leads are keyed through `contacts` (leads.contactId restrict); no confirmed `visitCount`/`lastSeenAt` upsert or unique index on (chatbot, phone/email). Race-safety unverified.
- ❌ OTP / Twilio: no OTP table, service or route (only TOTP 2FA in settings.service.ts and a shared `settings` schema mention). No Twilio code.
- ❌ Brochure gating: no brochure lead capture logic in `modules/chat` (brochure appears only in migrations/knowledge parsing).
- ❌ Invalid-lead cleanup route: not found.
- ⚠️ UTM: attribution.service.ts + public-chat.service.ts handle UTM; `utm_sub_source`/`utm_agencypartner` and widget sessionStorage caching not confirmed (no `sessionStorage` in `packages/widget/src`).

### §4 Conversion tracking
- ❌ Widget/web contain no `dataLayer`, `fbq`, `_tfa`, `gtag` or DOMPurify usage (grep over `packages/widget/src` and `apps/web/src`). All of §4 pixels, synthetic submit event, sandboxed custom scripts missing.

### §5 Webhooks / CRM
- ⚠️ Dispatcher + outbox exist (`modules/webhooks/webhook-dispatcher.service.ts`, `outbox-processor.service.ts`); `webhook_logs` has duration, status, request payload, response body, error (`db/schema/webhooks.ts:44-86`). Need to verify: 30s timeout, 1s/2s/4s backoff (code mentions exponential backoff, `retrying`, `dead_letter` statuses), parallel delivery, PascalCase flattening incl. `SharedURL`.
- ⚠️ Non-blocking delivery: outbox pattern is naturally async (good) — verify lead save doesn't await delivery.
- ⚠️ CRM connectors: `modules/integrations`; HubSpot/Salesforce/Mailchimp completeness unverified. Real-time email alert unverified.

### §6 Chat, media, WhatsApp
- ⚠️ RAG: `modules/ai/{retrieval,embeddings}.service.ts`, `modules/knowledge/*` (parser, crawler); Gemini wiring is in `modules/ai/router.ts` (currently has type errors).
- ❌ Media triggers (floor plan / master plan / map / first-message photos): no matches found.
- ⚠️ Sentiment/frustration: `sentiment` appears in analytics/copilot/intent-scorer; no escalation flag on conversations confirmed.
- ⚠️ WhatsApp: `hub.verify_token` check (whatsapp.adapter.ts:24, whatsapp.service.ts:412) and HMAC `x-hub-signature-256` (whatsapp.controller.ts:206) exist ✅. Issues: hardcoded verify token string in `whatsapp.service.ts:235`; Graph API hard-coded `v19.0` (whatsapp.adapter.ts:264) vs spec v18 → make env var `META_GRAPH_API_VERSION`; first-time-sender auto-lead (`WhatsApp User <last4>`) unverified.

### §7 Security / limits / uploads
- ❌ Rate-limit matrix mismatch (rate-limiter.ts): chat 60/min/session (spec 100), tenant API 600/min (spec general 60), no upload limiter (spec 10/min). Limiter is in-memory; not shared across instances (Redis available via `REDIS_URL`).
- ⚠️ Uploads: knowledge upload exists (`modules/knowledge/*`, `routes/knowledge.routes.ts`); 10MB cap, malicious-content scan (`<script>`, `<?php`, handlers), MIME/ext checks and storage backend unverified. `@vercel/blob` N/A (Express + docker); R2 vars present.

### §8 Retention / deletion
- ❌ 30-day chat archival cron and `CRON_SECRET`: absent (`jobs/scheduled-jobs.service.ts:133` only purges old events/outbox beyond 30 days). Also no HTTP cron routes.
- ⚠️ Chatbot deletion: schema already has soft delete (`chatbots.deletedAt`, `leads.deletedAt`, queries filter `isNull(deletedAt)` in chatbots.service.ts:25,52). **Spec §8 says hard cascade; code is already the safer soft-delete.** Keep soft delete; CSV export before hard delete not found.

### §9 Billing / plan limits
- ⚠️ Server-side enforcement exists via `middlewares/plan-limits.ts` for chatbots, users, WhatsApp numbers; wired in `routes/chatbots.routes.ts:125`, `routes/users.routes.ts:34`. Missing: conversations/month and storage enforcement; plan table values (Trial/Starter/Pro/Enterprise) not compared to `subscriptions` seed data.
- ⚠️ Stripe: `modules/billing/providers/stripe.provider.ts` present; webhook signature verification unverified. Razorpay also present (spec silent).

## Summary
❌ missing: inactive-signup gate, OTP/Twilio, brochure gating, invalid-lead cleanup, all conversion pixels, media triggers, archival cron/CRON_SECRET, upload limiter, conversations/storage plan limits, auth 5/15min.
⚠️ partial: roles naming, phone validation, dedup, UTM, webhooks reliability details, WhatsApp, rate-limit matrix, billing.
✅ solid base: RBAC middleware, tenant guard, refresh-token rotation, outbox + webhook_logs, soft delete, WhatsApp signature check.

## Decisions needed from you
1. Role naming: rename `super_admin` → `ps-owner` (DB migration + shared types) or keep `super_admin` and map `ps-owner` as alias?
2. Spec §8 says chatbot deletion is permanent; code is soft-delete. I will keep soft delete (safer) — confirm.
3. Spec's "MongoDB"/TTL/Vercel items are adapted to Postgres/Express (see Adaptations).
4. Pre-existing uncommitted work (~40 files incl. `ai/router.ts` type errors): stash/branch plan as you instructed happens at start of Phase 1.

## Phase 1 results (branch `feat/business-logic-completion`, created after `git stash` → branch → `git stash pop`; uncommitted work preserved)
- `pnpm typecheck`: **PASS** (fixed possibly-undefined regex matches in `apps/api/src/modules/ai/router.ts`, `apps/api/src/modules/crm/copilot.service.ts:90`).
- `pnpm exec eslint . --max-warnings 0`: **PASS** (removed 23 `any` in web services/components, ~55 unused imports/vars, 2 useless regex escapes).
- `apps/api` build (`tsup`): PASS. `apps/web` build: PASS.
- API tests: 390/391 pass. `tests/whatsapp/whatsapp-inbound-flow.test.ts` timed out at 15s under full parallel run but **passes in isolation (2.4s)** — DB contention flake, not a logic failure; to revisit when the test DB is set up.
- Role rename `super_admin` → `ps-owner`: code/tests/docs updated (18 files); new migration `apps/api/src/db/migrations/0015_rename_super_admin_to_ps_owner.sql` + journal entry. **Not applied** to the `propbot_pro` DB (15 migrations applied there); will be applied to a `propbot_pro_test` DB first. Other roles (`company_admin`, `sales_manager`, `agent`, `viewer`) are unchanged; mapping to spec `admin`/`user` is open (decision below).
- Correction to Phase 0: `userStatusSchema` already contains `pending_approval` (packages/shared/src/schemas/auth.ts) — the inactive-signup gate may be partially implemented; re-verify in Phase 3.
- DB boot: Postgres service reachable on localhost:5432. Index check (read-only) on `propbot_pro`:
  - ✅ `users (company_id, email)` unique, `refresh_tokens` lookups, `contacts (company_id, email|phone)` (non-unique)
  - ❌ no unique/dedup index for leads by chatbot+phone/email, no `conversations (chatbot_id, created_at)` index, no OTP table → Phase 4 migrations. `users.email` is unique per company only, not globally.

## Open decisions
1. Map existing roles `company_admin|sales_manager|agent|viewer` onto spec's `admin|user`, or keep the richer set and treat `company_admin` as `admin`, others as `user`?
2. Commit policy: my Phase 1 edits overlap files you already had modified (≈50). Commit everything on the branch, or only my new files?

## Phase 2 — Gemini provider
- New `apps/api/src/modules/ai/llm.ts` (Express repo has no `src/lib`; adapted): wraps `@google/genai` (official SDK, added to `apps/api`). Exposes `generateText`, `generateTextStream`, `embedText`, `analyzeSentiment`/`heuristicSentiment`, `classifyLlmError`, `getLlmProvider`. Per-attempt timeout (12s; 20s stream), 3 attempts, exponential backoff (500ms, 1s), SDK-internal retries disabled so quota errors surface immediately. Stream retries only before the first chunk.
- `modules/ai/router.ts`: Gemini branches of `execute` and `executeStream` now use `llm.ts`; provider choice honours `LLM_PROVIDER` (openai/anthropic only if selected *and* keyed, else Gemini, else any keyed provider as before). On any failure the existing circuit breaker + offline grounded fallback still returns a friendly reply instead of crashing.
- `modules/ai/embeddings.service.ts`: Gemini embeddings go through `embedText`; deterministic embedding fallback kept.
- Env: `GEMINI_MODEL` (default `gemini-3.8-flash`), `GEMINI_EMBEDDING_MODEL`, `LLM_PROVIDER` added to `.env.example` and `config/env.ts`.
- Script: `apps/api/scripts/check-gemini.ts` → `pnpm --filter @propbot/api check:gemini` (prints key present?, model, reachable?, latency, classified error + hint; exit 1 on failure).
- Tests: `apps/api/tests/ai/llm.test.ts` (6 pass: provider switch, error classification, retry/backoff, non-retryable, not-configured, frustration heuristics).
- **Live Gemini check result: FAIL — [quota]**. Key is present and valid (model list call succeeded; `gemini-3.8-flash` exists), but generateContent returns HTTP 429 "exceeded your current quota". `gemini-2.5-flash` is no longer available to new users (404), so it is not the default. **Action for you:** enable billing / check the key's quota at https://ai.dev/rate-limit, then rerun `pnpm --filter @propbot/api check:gemini`. Until then chat uses the offline fallback.
- Not yet done (later phases): frustration escalation wiring (§6) will call `analyzeSentiment`; `speech-to-text.provider.ts` and `doctor/setup-keys` scripts still reference OpenAI/Anthropic for key checks (left as-is).

## Phase 2 — Gemini provider
- New `apps/api/src/modules/ai/llm.ts` (Express repo has no `src/lib`; adapted): wraps `@google/genai` (official SDK, added to `apps/api`). Exposes `generateText`, `generateTextStream`, `embedText`, `analyzeSentiment`/`heuristicSentiment`, `classifyLlmError`, `getLlmProvider`. Per-attempt timeout (12s; 20s stream), 3 attempts, exponential backoff (500ms, 1s), SDK-internal retries disabled so quota errors surface immediately. Stream retries only before the first chunk.
- `modules/ai/router.ts`: Gemini branches of `execute` and `executeStream` now use `llm.ts`; provider choice honours `LLM_PROVIDER` (openai/anthropic only if selected and keyed, else Gemini, else any keyed provider as before). On any failure the existing circuit breaker + offline grounded fallback still returns a friendly reply instead of crashing.
- `modules/ai/embeddings.service.ts`: Gemini embeddings go through `embedText`; deterministic embedding fallback kept.
- Env: `GEMINI_MODEL` (default `gemini-3.8-flash`), `GEMINI_EMBEDDING_MODEL`, `LLM_PROVIDER` added to `.env.example` and `config/env.ts`.
- Script: `apps/api/scripts/check-gemini.ts` → `pnpm --filter @propbot/api check:gemini` (prints key present?, model, reachable?, latency, classified error + hint; exit 1 on failure).
- Tests: `apps/api/tests/ai/llm.test.ts` (6 pass: provider switch, error classification, retry/backoff, non-retryable, not-configured, frustration heuristics).
- **Live Gemini check result: FAIL [quota].** Key is present and valid (model list succeeded; `gemini-3.8-flash` exists), but generateContent returns HTTP 429 "exceeded your current quota". `gemini-2.5-flash` returns 404 (no longer available to new users), so it is not the default. **Your action:** enable billing / check quota at https://ai.dev/rate-limit, then rerun `pnpm --filter @propbot/api check:gemini`. Until then chat uses the offline fallback.
- Deferred: frustration escalation wiring (§6) will call `analyzeSentiment`; `speech-to-text.provider.ts`, `doctor.ts`, `setup-keys.ts` still reference OpenAI/Anthropic key checks (left as-is).
- Commit policy: per your instruction, nothing is committed until all phases finish.

## Phase 3 — Auth, users, roles (uncommitted, per your instruction)
Re-check vs Phase 0: the `pending_approval` status gate already existed; corrected rows below.
- **Inactive signup / login message** — `modules/auth/auth.service.ts`: company registration now creates the admin as `pending_approval` and returns `tokens: null, pendingApproval: true` (no session issued). `SIGNUP_AUTO_APPROVE=true` opts out; it defaults to true only under `NODE_ENV=test` so the existing 400+ tests keep working. Login of a pending user returns 403 `ACCOUNT_PENDING_APPROVAL` with the exact spec text "Your account is pending approval. Please wait for admin activation." The password is now verified **before** the status check, so wrong-password guessers cannot learn that an account exists or is pending. Web `AuthPage.tsx` shows the message instead of crashing on a null token.
- **Sessions** — spec "30-day JWT refreshed every 24h" implemented as: 15-min access JWT + 30-day rotating refresh token (was 7 days; `REFRESH_TOKEN_TTL_MS`), reuse detection retained. Documented deviation: a deactivated user's access JWT stays valid up to 15 min (refresh is refused immediately).
- **Roles** — `ps-owner` rename done in Phase 1. New privilege-escalation guard (`users.service.ts`, `users.controller.ts`): only a ps-owner can assign/edit the ps-owner role or invite one (a company admin could previously PUT `role` freely → 403 `FORBIDDEN_ROLE` now). Tenant isolation is by `tenantGuard` + company-scoped queries (verified by existing tenant tests); cross-company lead reads get an end-to-end check in Phase 8.
- **Activate / deactivate / change role** — existing `PUT /api/users/:id` (status/role) behind `manage_users`; web `/users` page uses it. Spec names `/dashboard/users`; the web route is `/users`.
- **Rate limit** — `middlewares/rate-limiter.ts` + `server.ts`: 5 requests / 15 min per IP (`AUTH_RATE_LIMIT_MAX`) on `/api/auth/login|register|forgot-password|reset-password` only (refresh/me unthrottled), HTTP 429. Fixed two bypasses: the `x-bypass-rate-limit` header worked in **any** environment (now `NODE_ENV=test` only) and the key trusted a client-supplied `X-Forwarded-For` (now `req.ip`; set `TRUSTED_PROXY_HOPS` behind a proxy). Existing limiter test updated to use `trust proxy`.
- **Seed** — new `apps/api/src/db/seed-admin.ts` (`pnpm seed:admin`): idempotent platform owner from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (min 12 chars), creates company `propbot-platform`; existing owner untouched unless `SEED_ADMIN_RESET_PASSWORD=true`. Demo seed (`db/seed.ts`) now reads `SEED_DEMO_PASSWORD` and refuses to run in production without it.
- **Hardcoded credentials flagged**: `db/seed.ts` fallback `Password123!` (dev only now); web `AuthPage.tsx` quick-demo login still sends `Password123!` and demo emails (dev convenience — remove before production); `auth.utils.ts:9` has a dev fallback JWT secret `dev_jwt_access_secret_...` used when `JWT_ACCESS_SECRET` is unset (env.ts requires the var, so low risk, but should throw in production). No `admin@propbot.ai`/`test@propbot.ai` found in auth code.
- Tests added: `tests/auth/approval-gate.test.ts` (3: locked signup + spec message + no status leak, ps-owner escalation blocked, 5/15min → 429 with spoofed XFF), `tests/auth/seed-admin.test.ts` (2: validation, idempotency). Full API suite: 401/402 then the 1 failure fixed → rate-limiter test. Typecheck + lint clean.
- Side effects to know: the seed test created company `propbot-platform` in the local `propbot_pro` DB (test helpers default to that DB; set `TEST_DATABASE_URL` to isolate — Phase 8). Migration `0015` is still **not applied** to `propbot_pro`; until it is, existing `super_admin` users there can't pass `ps-owner` checks.
- Decision for you: spec has 3 roles (`ps-owner`/`admin`/`user`); repo has 5 (`company_admin`, `sales_manager`, `agent`, `viewer`). I kept the richer set (treat `company_admin`≈admin, others≈user).

## Phase 4 — Lead engine (PostgreSQL / Drizzle; uncommitted)
Stack confirmed: **PostgreSQL via Drizzle ORM (`drizzle-orm` 0.45 + `postgres.js`), SQL migrations in `apps/api/src/db/migrations`**. No MongoDB code exists in the repo or in anything I added; the earlier "MongoDB" mentions only quoted the spec and are now labelled as such.

Migrations (shown to and approved by you, then applied to local `propbot_pro`; 17 applied incl. 0015 + 0016):
- `0015_rename_super_admin_to_ps_owner.sql` — role rename.
- `0016_lead_engine.sql` — `leads` +visit_count/last_seen_at/utm_params/ip_address/user_agent; partial unique indexes `contacts_company_phone_uniq`, `contacts_company_email_uniq` (lower(email)), `leads_company_bot_contact_uniq`; `chatbots` +total_leads/brochure_downloads (backfilled); `conversations_chatbot_created_idx`; new table `lead_otps` (+2 indexes). Pre-checks found 0 duplicate phones/emails, so the unique indexes built without touching data.

Implemented (by file):
- `packages/shared/src/utils/phone.ts` (+ subpath export `@propbot/shared/phone`, so the widget gets the same validator with no zod; widget bundle stays 39 KB): sanitization (strip spaces/()/-/.; keep digits and leading +), India (10 digits, 6-9 start), US/Canada NANP regex, 52 countries (length rules; other countries permissive by length — stated limitation). `tests/phone.test.ts` (7).
- `modules/leads/leads.service.ts`: `captureOrUpdateLead` rewritten — validates phone (400 `INVALID_PHONE`), phone-then-email contact match, one lead per contact per chatbot, **atomic** `visit_count = visit_count + 1`, name/phone/lastSeenAt refresh, UTM jsonb merge, IP/UA, unique-violation retry (SQLSTATE 23505) instead of find-then-insert; atomic chatbot counters; keeps `duplicateMergeSuggestion` behaviour existing tests rely on. New `cleanupInvalidLeadLinks()`.
- `modules/leads/otp.service.ts`: 6-digit `crypto.randomInt`, HMAC-hashed at rest, configurable expiry (1–30 min) / maxAttempts / resend cooldown, attempt counter incremented atomically *before* comparing (parallel guesses can't exceed the cap), purge on lockout, timing-safe compare, Twilio via REST (no SDK) with dev console fallback (503 in production if unconfigured), `purgeExpired()` run from the worker every 60 s (Postgres has no TTL index). Lead is `phoneVerified=true` only after a successful OTP; when OTP is enabled a lead cannot be submitted without a recent verification (403 `OTP_REQUIRED`).
- `modules/chat/public-chat.{service,controller}.ts`, `routes/public-chat.routes.ts`: `POST /public/otp/send`, `/public/otp/verify` (IP rate-limited, `otpRateLimiter`), `POST /public/brochure` (gated: needs name+email+phone, creates lead `source=brochure_download` with IP/UA, increments `total_leads`/`brochure_downloads`/brochure download_count; link never in the 403 body), `requireEmail` enforcement, UTM allow-list (`utm_source/medium/campaign/term/content/sub_source/agencypartner`, 200 chars), session UTMs merged with request UTMs. Also mounted under `/api/public/chat/*`.
- `packages/shared/src/schemas/chatbots.ts`: `leadCapture.requireEmail`, `requireLeadCapture`, `otpSettings`; default email field no longer required (spec: phone required, email optional unless `requireEmail`). Wizard defaults updated.
- `middlewares/cron-auth.ts` + `server.ts`: `POST /api/leads/cleanup-invalid` — `CRON_SECRET` bearer (platform-wide) or signed-in ps-owner/company admin (own company); 401 otherwise; never accepts an unset secret. Lead/contact rows are kept; only the conversation's `lead_id/contact_id` link is cleared.
- Widget (`packages/widget/src/utm.ts`, `ui.ts`): UTM capture into `sessionStorage` (all 7 keys), sent at session start and with the lead; client-side shared phone validation; the form now reads the HTTP status instead of showing "Thank you" after a failed save.
- Tests: `tests/leads/lead-engine.test.ts` (12: invalid phone, 6-way parallel race → 1 contact/1 lead/visit_count 6, email match, UTM/IP/UA, requireEmail, OTP gate/cooldown/lockout/expiry/purge, brochure gate + counters + no second lead, cleanup auth). Full API suite **414/414**, typecheck + eslint clean.

Known limitations / notes:
- Dedup is per **chatbot** (as in the spec) on top of company-wide contact uniqueness, so the same person on two chatbots gets one contact and two leads.
- Brochure OTP: gated downloads go through `captureLead`, so OTP rules apply when enabled.
- Dev OTP fallback prints the code to the server console (spec'd); never enabled in production.
- `JWT_SECRET` fallback in `public-chat.service.ts` is another hardcoded dev secret to remove before production.
- Twilio and WhatsApp/Meta were mocked; nothing paid was called.

## Phase 5 — Conversion tracking & webhooks (uncommitted; complete)
Done (no migration needed):
- **Webhook payload** — `modules/webhooks/lead-webhook-payload.ts`: `lead_captured` is delivered flat with PascalCase keys loaded from Postgres: `LeadId, Name, FirstName, LastName, Phone, Email, PhoneVerified, ChatbotId, ChatbotName, Source, VisitCount, CapturedAt, LastSeenAt, PageUrl, UTMSource, UTMMedium, UTMCampaign, UTMTerm, UTMContent, UTMSubSource, SharedURL (= utm_sub_source), UTMAgencyPartner`; absent UTMs are `""`. `UTMTerm`/`UTMContent` are additions beyond the spec's list (the two remaining standard UTM keys). Other event types keep their existing payloads.
- **Reliability** — `webhook-dispatcher.service.ts`: 30 s timeout (`WEBHOOK_TIMEOUT_MS`), `WEBHOOK_MAX_ATTEMPTS = 4` (1 try + `maxRetries=3`), backoff 1 s / 2 s / 4 s (was 5 s timeout, 3 attempts, 30 s / 120 s / 300 s). `outbox-processor.service.ts`: the outbox consumer now only **enqueues** (`webhook_logs` rows, attempt 0, `retrying`); `processScheduledRetries()` claims due rows with `FOR UPDATE SKIP LOCKED` + a 2-minute lease (no double sends across workers; a crashed worker's rows come back), delivers all endpoints **in parallel** (`Promise.allSettled`), and writes **one `webhook_logs` row per attempt** (duration, HTTP status, request payload, response body, error). Fixed an old bug where a retry wrapped the previous envelope inside a new envelope. `worker.ts`: dedicated 1 s delivery loop (re-entrancy guarded) so 1 s backoff is honoured and slow endpoints never delay event fan-out.
- **Non-blocking decision (serverless question)**: this app is a long-running Express API + separate worker, not serverless. The lead save commits the lead and a `domain_events` row in one transaction (transactional outbox) and returns; delivery happens later in the worker, so nothing is lost if the process dies and nothing waits on a webhook. On a serverless host you would run the same worker loop as a scheduled/queued function instead of an after-response hook.
- **Per-chatbot tracking config** — `chatbotConfig.tracking` (`packages/shared/src/schemas/chatbots.ts`): `gtmEnabled`, `googleAds{conversionId AW-…, conversionLabel, currency, value}`, `metaPixelId`, `taboolaEnabled`, `customScript`. IDs are regex-validated; the public config returns only schema-valid values (`public-chat.service.ts`), nothing hardcoded.
- **Widget** — `packages/widget/src/tracking.ts`, wired in `ui.ts` after the server confirms the lead: GTM `dataLayer.push({event:'propbot_lead_submit', …})` (non-PII metadata + UTMs only), synthetic composed `submit` event on `.propbot-lead-form-body` (crosses the shadow DOM so GTM's Form Submission trigger sees it), `gtag('event','conversion',{send_to:'AW-…/LABEL',currency,value})`, `fbq('track','Lead',…)` with SHA-256-hashed email/phone via `fbq('set','userData')` (never raw PII), Taboola `_tfa.push({notify:'event',name:'lead_capture'})`. Each channel is isolated in try/catch and only runs if the host page loaded that pixel. Custom snippets: **DOMPurify**-sanitized (event handlers, `javascript:`, iframes, forms, objects stripped) and run in an `<iframe sandbox="allow-scripts">` (no `allow-same-origin`). Widget bundle grew 39 KB → 118 KB (DOMPurify).
- Tests: API `lead-webhook-payload.test.ts` (flat/PascalCase mapping incl. `SharedURL`, real DB lead, 2 endpoints delivered in parallel, per-attempt logs), rewrote `webhook-retry.test.ts` (queued → 4 attempts → 4 audit rows, 1/2/4 s delays asserted, no early sends, dead-letter, replay), updated `outbox-dispatch.test.ts`; widget `tracking.test.ts` (jsdom: all channels, throwing/missing pixels, sandbox attributes, sanitizer). API suite **416/416**, widget 10/10, shared 10/10, typecheck + eslint clean. Test tooling added: `jsdom@25` (widget devDependency; jsdom 30 needs a newer Node), `dompurify` (widget dependency).

Not done yet (needs your approval of the migration):
- **Real-time e-mail alert** — no mailer exists in the repo (`email.adapter.ts` is a mock that reports success; no SMTP client). Plan: add `nodemailer`, send on `lead_created` to active company admins (or `leadCapture.alertEmails`), clear "SMTP not configured" skip.
- **CRM sync** — `crm.adapter.ts` only writes to an in-memory map and returns `success: true` (misleading); Salesforce and Mailchimp do not exist; HubSpot is that mock. Plan: real HubSpot (CRM v3 contact upsert, private-app token), Salesforce (REST Lead create, instance URL + access token), Mailchimp (list member PUT, API key) adapters with "not configured" results, run from the same queue with 1/2/4 s retries.
- Both need a durable job table → **proposed `0017_delivery_jobs.sql`** (shown in chat, kept in `apps/api/src/db/migrations/_proposed/`, not journaled, not run).

### Phase 5 part 2 — e-mail alert + CRM sync (migration 0017 approved and applied to local `propbot_pro`; 18 migrations applied)
- `0017_delivery_jobs.sql` (additive, one table `delivery_jobs` + 3 indexes incl. unique `(event_id, kind, provider)` for idempotent enqueue). Drizzle schema `db/schema/delivery-jobs.ts`.
- `modules/delivery/delivery-jobs.service.ts`: the `delivery_jobs` outbox consumer (registered in `outbox-dispatcher.service.ts`) only inserts rows on `lead_created`; a 1 s worker loop (`worker.ts`) claims due jobs with `FOR UPDATE SKIP LOCKED` + 2-minute lease and delivers them in parallel. Retry: 1 attempt + 3 retries at 1 s / 2 s / 4 s; transient errors (network, 408, 429, 5xx) retry, permanent ones (401/403/404/400, bad URL) go straight to `dead_letter`; "not configured" ends as `skipped` (never retried, never reported as success).
- **E-mail alert** (`modules/delivery/mailer.ts`, `nodemailer`): sent to `leadCapture.alertEmails` (new, max 10, validated) or else the company's active `company_admin`/`ps-owner` users; SMTP via `SMTP_HOST/PORT/USER/PASSWORD/FROM`; HTML-escaped body, CR/LF stripped from the subject (header-injection safe); without `SMTP_HOST` the job is `skipped` with "SMTP is not configured".
- **CRM connectors** (`modules/integrations/crm/crm-providers.ts`), config read per send from the integration's vault-encrypted config: **HubSpot** (`accessToken`; contact upsert by e-mail via CRM v3 batch upsert, phone search then create/patch when no e-mail; optional `utmPropertyMap`), **Salesforce** (`instanceUrl` + `accessToken`; creates a `Lead` with the mandatory `LastName`/`Company` defaults; `instanceUrl` must be `https://*.salesforce.com|force.com|salesforce-setup.com` and pass the SSRF guard), **Mailchimp** (`apiKey` + `listId`; member PUT by MD5 of the lower-cased e-mail; default status `pending` = double opt-in, `status: "subscribed"` opts out; leads without e-mail are skipped). `integrationsService.testSync` now runs `testConnection` (read-only credential check) for these three instead of the old fake "success"; `salesforce` and `mailchimp` added to the shared provider enum. The old in-memory `hubspotAdapter` mock is no longer used (Zoho / generic REST remain mocks, out of spec scope).
- Tests: `tests/delivery/delivery-jobs.test.ts` (15: alert recipients/escaping/skip/idempotency; HubSpot success, 1 s / 2 s retries, dead-letter after 4 attempts, immediate dead-letter on 401, missing token → skipped, vault decrypt; Salesforce fields + SSRF refusal + skipped; Mailchimp hash/status/skip; testSync). External APIs and SMTP are mocked; nothing real was called. Hardened three older tests against cross-file outbox sweeps (`webhook-retry`, `lead-webhook-payload`, fan-out checkpoint list now includes `delivery_jobs`). Full API suite **431/431**, typecheck + eslint clean.
- Limitations: the Settings → Integrations UI still only has a HubSpot/Zoho card with no credential form for Salesforce/Mailchimp (backend is ready via `PUT /api/integrations/:provider`); Salesforce uses a pasted access token (no OAuth refresh flow), so a 401 is dead-lettered with a "reconnect" message; no live HubSpot/Salesforce/Mailchimp/SMTP call was made.

## Phase 6 — Chat engine, media, WhatsApp (uncommitted; media wiring waits on migration 0018)
Done (no migration):
- **Frustration detection + escalation** — `modules/ai/llm.ts` `heuristicSentiment`/`isFrustrated` now covers the spec signals (useless, not working, multiple `!`, ALL CAPS of 2+ words; plus scam/fraud/worst/etc.), shared by web chat and WhatsApp. Web: `public-chat.service.ts` `escalateToHuman` stores `messages.sentiment='frustrated'`, sets the conversation `status='needs_human'` + `metadata.escalation{reason,at,triggerMessage}`, emits one `handoff_requested` domain event per conversation (the existing consumer notifies admins and fires the webhook) and replies with `behavior.escalationMessage` (new optional config) or a default empathetic message instead of an AI answer. The inbox filters on `needs_human` already (WhatsApp inbox); web conversations are visible via the notification + status, there is no dedicated web-chat badge yet.
- **Acknowledge & bridge** — `retrieval.service.ts` `buildSystemPrompt` (used by web and WhatsApp): guardrail 5 now forbids flat refusals and requires "acknowledge in one sentence, then bridge to a site visit / callback / brochure"; answers stay limited to the chatbot's own retrieved knowledge (`NO_VERIFIED_DATA_FOUND` path unchanged). The offline responder's off-topic / injection answers were rewritten to bridge (English, Hinglish, Hindi) while keeping the keywords the eval dataset checks.
- **WhatsApp** (`whatsapp.service.ts`, `whatsapp.adapter.ts`): **security fix** — the HMAC signature check was skipped whenever a company had no `appSecret`, so anyone knowing a phone-number ID could inject fake messages/leads; now an app secret (company's or `META_APP_SECRET`) is mandatory and unsigned deliveries get 401 (`ALLOW_UNSIGNED_WHATSAPP_WEBHOOKS=true` only outside production). First-time senders are created as `WhatsApp User <last4>`, `source: whatsapp` (profile name kept as `whatsappProfileName` metadata; `preserveName` stops later messages overwriting a real name); WhatsApp numbers are read as international E.164 (previously a non-Indian sender would have been rejected) with a generic E.164 fallback for countries outside the rule table. Graph API version is `META_GRAPH_API_VERSION` (default `v21.0`, input validated; the spec's v18.0 is retired by Meta). Removed a hardcoded fake price context (`₹3.25 Cr`) that was sent to customers when retrieval failed — it now bridges to an advisor. The demo "quick connect sandbox" (fixed phone-number ID + mock tokens) is blocked in production. Hardcoded `propbot_verify_token_prestige_2026` / mock token exist only inside that sandbox seed.
- **Test isolation** — the API suite no longer calls live LLMs: `apps/api/vitest.config.ts` + `tests/setup-env.ts` blank `GEMINI/OPENAI/ANTHROPIC/EMBEDDING` keys and enable the offline responder (the .env key currently hits Gemini quota, which made tests slow/flaky). `llm.ts` no longer retries a `quota` error (fails fast to the fallback). Existing WhatsApp tests now send **signed** deliveries (`tests/helpers/meta-webhook.ts`).
- **Media triggers (logic)** — `modules/chat/media-triggers.ts` + 8 tests: first message → highlight photos; floor plans (`2bhk`, `3 BHK`, `carpet area`, `floor plan`, `layout`, …, picks the requested BHK); master plan (`master plan`, `site plan`, `project layout` — which does not also fire the floor-plan trigger); location (`location`, `directions`, `where`, `how to reach`) → Google Maps embed (only `google.com/maps` embeds allowed; https-only image URLs). Known spec trade-off: "where" is a very broad trigger and will also match "where do I pay".
- Tests: `tests/phase6/{chat-engine,whatsapp,media-triggers}.test.ts` (frustration signals, bridge prompt/offline answers, web escalation incl. no duplicate handoff, signed/unsigned/verification handshake, first-time sender naming, name preservation, non-table country, sandbox lock, Graph version). API suite **456/456**, typecheck + eslint clean.
- Not verified live: RAG answer quality against Gemini (key is out of quota; see Phase 2) and RAG over real PDFs/CSVs/websites (covered by the existing knowledge tests with the deterministic embedder).

Pending your approval — **proposed `0018_project_media.sql`** (two additive columns on `projects`, kept in `apps/api/src/db/migrations/_proposed/`, not journaled, not run): `highlight_photos jsonb NOT NULL DEFAULT '[]'` and `master_plan_url text`. After it: Drizzle schema fields, a loader that picks the project (name mentioned in the message → `config.mediaProjectId` → the company's only/latest active project, since chatbots are not linked to projects), `media` in the `/public/message` response and message metadata, widget rendering (images + sandboxed map iframe), and API/inventory support for editing the two fields.

## Phase 7 — Security, limits, data lifecycle, billing (uncommitted; no migration needed)
**Critical findings fixed**
1. **Free plan upgrades.** `POST /api/subscription/checkout` with no/`mock` provider switched the caller's plan immediately **in every environment**, and `/api/subscription/webhook/mock` accepted `mock_valid_signature` (and any request under test). Any billing admin could have granted themselves Enterprise. The mock provider is now refused in production (checkout, webhook and signature check).
2. **Fail-open payment webhooks.** Stripe and Razorpay verification returned `true` when no secret was configured, hashed the *parsed* body (so a genuine signature could never match) and Stripe's real `t=…,v1=…` scheme was not implemented. Now: real Stripe verification (HMAC over `${t}.${rawBody}`, 5-minute replay tolerance, key-rotation `v1` lists, timing-safe), Razorpay timing-safe hex HMAC, verification over the **raw request bytes**, missing secret ⇒ reject (401), only "paid" Stripe events can change a plan, and redelivered invoices are idempotent (no second upgrade/invoice).
3. **Rate limiters existed but were not mounted** (chat, session and "tenant" limiters were dead code), so chat, uploads and the API were unthrottled. Fixed below.
4. `x-bypass-rate-limit` and the `X-Forwarded-For` key were fixed in Phase 3.

**Rate-limit matrix** (`middlewares/rate-limiter.ts`, `server.ts`, routes): auth 5 / 15 min (login, register, forgot/reset) → 429; chat `POST /public/message` **100 / min**; uploads **10 / min per user**; general API **60 / min** for requests without credentials, per IP. Sessions: 30 new sessions / min / IP; OTP 10 / 15 min. Exempt from the general limiter: `/healthz`, `/api/auth` (own limit), `/api/public` + `/public` (own limits), inbound webhooks (`/api/webhooks`, `/api/subscription/webhook`), `/api/status`, `/api/cron`. **Deviation (needs your call):** signed-in dashboard traffic uses a separate 600 / min bucket (`API_AUTH_RATE_LIMIT_MAX`) because the SPA itself polls ~40 requests/min on the WhatsApp inbox, so a literal 60 / min would lock users out. **Limitation:** all limiters are in-memory (`MemoryRateLimiter`), so counts are per process and reset on restart; behind several instances/serverless they do not add up. `REDIS_URL` is already in the env, so a Redis-backed store is the recommended next step.

**Uploads** (`modules/knowledge/upload-guard.ts`, `knowledge.controller.ts`, `server.ts`): 10 MB cap (413 `FILE_TOO_LARGE`, checked on the base64 length before decoding); extension allow-list (`.pdf .docx .txt .md .csv .json`; `.html` is no longer accepted for upload) + declared-MIME consistency; executable magic bytes (MZ / ELF / `#!`) rejected under any name; PDF must start `%PDF-` and is rejected if it contains `/JavaScript`, `/JS` or `/Launch`; DOCX must be a zip and is rejected if it carries `vbaProject.bin` (macros); text/CSV/JSON scanned for `<script>`, `<?php`/`<?=`, `<iframe|object|embed>`, `javascript:` and inline event handlers (422 `MALICIOUS_CONTENT`); NUL bytes in "text" rejected. The JSON body limit stays 1 MB everywhere except authenticated knowledge uploads (14 MB parser, only when an `Authorization` header is present). **Storage adaptation:** the app does not keep uploaded binaries (only extracted text in Postgres), so the spec's "local disk in dev / Vercel Blob in prod" has nothing to switch; the plan's storage allowance is measured from stored bytes.

**30-day retention** (`jobs/scheduled-jobs.service.ts` `archiveOldChats`, `routes/cron.routes.ts`, `worker.ts`): conversations idle for 30 days (last message, else creation) keep their row, timestamps and lead/contact links, and their messages are replaced by one stub "This conversation history was archived to save storage space." (`metadata.archivedAt` makes it idempotent); anonymous chats (no lead, no contact) with 0–1 messages are deleted. Runs hourly in the worker and via `GET|POST /api/cron/archive-chats` with `Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`); 401 without it, and 401 when `CRON_SECRET` is unset. The job is global in production; tests run it scoped to a test company only. Heads-up: starting the worker on your dev DB will archive any seeded conversations older than 30 days.

**Chatbot deletion**: already a soft delete in the code (`deletedAt`; leads are kept, the public widget stops serving it). I kept that, did **not** add any hard-delete path, and added `GET /api/chatbots/:id/leads/export` (CSV with UTMs, works for deleted chatbots, tenant-scoped, formula-injection-safe) plus `leadsRetained` / `exportUrl` in the delete response. This intentionally differs from spec section 8 ("permanent cascading delete"); you confirmed soft delete.

**Plan limits enforced server-side**: chatbots and team members (middleware, existing), WhatsApp numbers (existing), **new:** monthly conversations (checked when a web session starts; WhatsApp over-quota still captures the lead but starts no conversation/AI reply) and **storage** (checked on upload; the old hard-coded "12 MB used" is replaced by real usage). All return 403 `PLAN_LIMIT_EXCEEDED`. Limitation: checks read-then-act, so two simultaneous creations right at the limit can both pass (a per-company advisory lock would close this).

**Spec §9 vs code plans — NOT changed (you asked to be consulted on pricing):**

| | Spec | Code (`packages/shared/src/constants/plans.ts`) |
|---|---|---|
| Currency / names | USD; Trial, Starter, Professional, Enterprise | INR; Free Trial, Starter, **Growth**, Enterprise |
| Trial | $0 · 1 bot · 100 conv · **1** member · 100 MB | ₹0 · 1 · 100 · **2** · 100 MB |
| Starter | $29 / $290 · 3 · 1,000 · **3** · 1 GB | ₹2,999 / ₹29,990 · 3 · 1,000 · **5** · 1,000 MB |
| Professional | $79 / $790 · 10 · **10,000** · 10 · 10 GB | Growth ₹7,999 / ₹79,990 · 10 · **5,000** · **15** · 10,000 MB |
| Enterprise | $199 / $1,990 · unlimited everything | ₹19,999 / ₹199,990 · 999 bots · 50,000 conv · 999 users · 100,000 MB |

**Stripe status:** the webhook path is real and signature-checked; **checkout creation is still a stub** (it returns a made-up `checkout.stripe.com/pay/cs_live_…` URL, and nothing calls the Stripe API). Stripe stays in test mode as requested, but a real Checkout Session integration is needed before taking payment. In production, Stripe checkout without `STRIPE_SECRET_KEY` now returns 503 instead of silently mocking.

**Tests**: `tests/phase7/{billing-security,uploads-and-limits,lifecycle}.test.ts` — signature unit tests (valid/tampered/wrong-secret/stale/rotation/missing-secret), HTTP webhook flows (no secret, bad signature, paid event once + duplicate no-op, non-paid ignored, mock refused in production, mock checkout refused), upload guard (boundary at exactly 10 MB, extension/MIME/magic/script/PDF/DOCX cases, 2 MB accepted, >10 MB 413, anonymous big-body, nothing stored on rejection, storage quota, conversation quota), rate-limit matrix (chat 100→429, uploads 10→429, general 60→429 with exempt paths still open), retention (archive/keep links/delete anonymous/idempotent/active-chat untouched/later run), cron auth (missing/wrong/unset/valid, Bearer and header, GET and POST — job stubbed so no real data is touched), chatbot delete keeps leads + CSV export (tenant isolation, injection-safe, quoting). API suite **489/489**, typecheck + eslint clean.

## Phase 6 (media) — completed (uncommitted)
Migration `0018_project_media.sql` approved and applied to local `propbot_pro` (19 migrations applied): `projects.highlight_photos jsonb NOT NULL DEFAULT '[]'`, `projects.master_plan_url text`.

- **Backend:** Drizzle fields (`db/schema/properties.ts`); shared `projectSchema` / create / update schemas (`highlightPhotos` max 10 and `masterPlanUrl`, both **https-only**, so `javascript:`/`http:` URLs are rejected with 400); `inventory.service` reads and writes them. `modules/chat/media-loader.ts` picks the project (named in the message → `config.mediaProjectId` (new optional chatbot setting) → the company's latest project, always scoped to the company) and `media-triggers.ts` builds the items. `public-chat.service.sendMessage` now wraps the answer, attaches `media` to the `/public/message` JSON and to the SSE `done` event, and stores it in the bot message `metadata.media`, so `/public/history` returns it. Media lookup failures never affect the answer; escalations carry no media.
- **Widget:** `packages/widget/src/media.ts` renders photo grids, single plan/master-plan images and a sandboxed Google Maps iframe under the bot reply (https-only images, `google.com/maps` embeds only, `noopener`, `no-referrer`, server strings inserted as text, never HTML). Also fixed the SSE reader, which listened for `delta` while the server sends `chunk`/`done`.
- **Property editor (web):** new "Chat Media" tab on the project page (`ProjectMediaEditor`) and a "Chat media (optional)" section in the Add Project modal, both built on `ProjectMediaFields`: highlight photos (one URL per line with thumbnails), master plan URL with preview, floor-plan rows (title, BHK, carpet area, image URL), latitude/longitude and Google Maps embed URL, with inline validation that mirrors what the chat will display.
- **Tests:** API `tests/phase6/media-chat.test.ts` (9: column round trip, first-message highlights, 3BHK plan with caption, master plan, project layout does not fire floor plans, location map embed, named project wins, history keeps media, pinned `mediaProjectId`, no-project company, tenant isolation, https validation on the API); widget `tests/media.test.ts` (3: rendering, unsafe URL/HTML handling, empty cases). Full API suite **498/498** on two consecutive runs, widget 13/13, typecheck, eslint and web/widget builds clean.
- Hardened flaky tests: the shared dev DB is used by tests running in parallel, so `outbox-dispatch.test.ts` now enqueues its own event instead of racing a global outbox sweep (failures seen only intermittently in full runs, never in isolation).
- **Not verified visually:** I did not open the property editor in a browser (it needs a signed-in session); it is covered by typecheck, the production build and the API tests. Worth a quick manual click-through: Properties → open a project → "Chat Media" tab.
- Remaining from P0 in the new roadmap: Phase 8 smoke-test suite on a separate test DB, removal of the hardcoded dev JWT secrets, optional Redis-backed rate limiter, Gemini billing + re-run of `check:gemini`.

## P1: Agents and Forms (roadmap)

**Delivered**
- Backend: versioned AI agents (draft → publish → rollback, A/B compare, saved test cases), reusable forms (data to collect → saved on `leads.custom_fields.attributes` + `form_submissions`), knowledge references (source bundles), per-call LLM logging (`llm_calls`), model registry (Gemini). Agent instructions (prompt sections, `{{variables}}`, conditional blocks, style flags) now drive public chat and WhatsApp via `prepareAgentTurn`/`collectAttributes`. Fixes the earlier gap where persona `behavior.systemPrompt`/`temperature` were never used.
- Frontend: `/agents` (list + template-based create), `/agents/:id` studio (Behaviour, Model & rules, Knowledge & data tabs; test chat with final-prompt inspector; versions with publish/rollback/discard and A/B compare), `/forms` builder, agent picker on chatbot settings, nav entries.
- Migrations 0019 (P1) and 0020 (schema foundation for P2–P8) applied to local `propbot_pro`; additive only.

**Verification**: API typecheck clean; web typecheck, eslint and `vite build` clean; API suite 531/531. Two cross-file flakes (global row count in uploads test, load timeout in media-chat test) were made robust.

**Not yet done / caveats**: studio UI not clicked through in a browser; Gemini live calls blocked by quota (tests mock); nothing committed.

## P2: Tools and the real-estate action library

**Delivered**
- API tools: HTTPS request builder (method, URL/body templates with URL- and JSON-safe escaping, headers, bearer/header auth from an AES-GCM vaulted secret that is never returned, dot-path response mapping, timeout, 256 KB response cap, SSRF guard, redirects refused). AI tools: prompt + typed outputs returned as structured JSON through the Gemini router (logged in `llm_calls`).
- Every call is recorded in `tool_runs` (ok / error / blocked / pending_approval); per-tool per-minute rate limit; disabled state; agent/flow calls of `requires_approval` tools are held, manual tests are not.
- Action library (`/api/actions`): search_inventory, check_unit_availability, get_project_summary, update_lead_stage. Remaining roadmap actions (messaging, appointments, tags, tasks) ship with P3 flows and P4 channels.
- Agents answer availability questions from live inventory: "3BHK in Tower B under 1.5 Cr" is parsed and the real units are injected into the prompt as authoritative facts (also in the studio test panel).
- Frontend: `/tools` (cards, editor, test runner, run history) and `/tools/actions` (searchable catalogue with a runner).

**Verification**: 18 new tests (tenant isolation, secret never leaked, SSRF, redirect, approval hold, rate limit, live availability); API 549/549, web typecheck/eslint/build clean.

**Caveats**: no function-calling loop yet (live inventory is deterministic, not model-driven); AI tools need a live Gemini key; tool-approval queue UI deferred to P7.

## P3: Flow builder v2

**Delivered**
- Engine (`modules/flows/flow-engine.ts`): graph interpreter with persisted state. Steps: trigger, send message, AI reply, if/else, AI routing (3 attempts then a `default` branch), wait (parks the run; the worker resumes it, claim-safe), loop (capped), set variable, tool, action, sub-flow (inline, depth 3, no waits inside), end. Per-step trace (`flow_step_runs`), error branches, step cap per run (default 50), max 200 parked runs per company, company kill switch, cancel, dry-run mode (nothing sent, waits skipped).
- Versioning: draft → validated publish → rollback (as a new version); publishing rebuilds the indexed `flow_triggers`. Shared `validateFlowGraph` drives both the canvas badges and the publish gate.
- Triggers: new lead, lead stage changed (optional target stage), site visit booked, form submitted (new `form_submitted` domain event), schedule (worker), API/webhook (`POST /api/flows/:id/trigger`). New outbox consumer `flows`; worker loop every 15 s.
- Five real-estate templates: instant lead response, visit reminders (24h/2h), no-show recovery, cold-lead drip, AI lead routing.
- Frontend: `/flows` (cards + template gallery), `/flows/:id` canvas on `@xyflow/react` (palette by category, per-branch connectors, inspector with `{{variable}}` picker, live validation, undo/redo, minimap, test run with per-step highlight, version history), `/executions` (filters + step timeline drawer = LLM-ops view).

**Verification**: 20 new engine/API tests; API 569/569 after updating the fan-out checkpoint expectation (+`flows` consumer); web typecheck, eslint, build clean.

**Caveats / deferred**: send-message writes a bot message to the lead's conversation; real delivery to WhatsApp/e-mail comes with P4 channels. Triggers not yet wired: inbound message, visit missed, no-reply (need P4 events). Canvas not clicked through in a browser. Sub-flow calls inside waits unsupported by design.

## P4: Omnichannel inbox, channels and lead sources

**Delivered**
- Unified inbox (`/api/inbox`): one list across web, WhatsApp, Instagram, Messenger and e-mail with status / channel / owner / priority / tag / search filters (wildcards escaped), awaiting-reply counts, take control / hand back to AI, assignment (team members only), tags, priority, resolve/close, internal notes with @mentions (in-app notifications to same-company users only), first-response time. Replies are delivered on the conversation's own channel; WhatsApp enforces the 24-hour window and requires an **approved** template outside it. Web chat now stays silent while a teammate owns the conversation (`aiPaused`).
- Lead sources: API-key ingestion endpoint (`POST /api/public/omni/lead-sources/ingest`, key shown once, stored as SHA-256, rotate/disable), mappers for Meta Lead Ads, Google Ads, 99acres, MagicBricks, Housing.com and generic field mapping, UTM / agency-partner attribution, optional form attributes, de-duplication through the existing lead engine, event log, CSV import (500 rows).
- Channels: encrypted connections for Instagram / Messenger / e-mail / API, Instagram + Messenger inbound webhook (handshake token and HMAC signature required, fail-closed; contact identities; duplicate-message protection), WhatsApp template manager (variable and sample validation, mock reviewer that rejects "guaranteed returns" wording, approved templates locked), website widget configs (allowed domains, home screen, nudges) served only to allowed origins.
- Frontend: `/inbox` (list, thread, composer, notes, contact panel), `/lead-sources`, `/channels` (connections, templates, widgets).

**Verification**: 27 new tests; API 596/596; web typecheck, eslint, build clean.

**Caveats**: live Meta calls only when `META_LIVE_DISPATCH=true`; live template submission/sync, embedded Meta onboarding, Gmail/IMAP inbound, Instagram comment automation and the widget runtime consuming the new config are not built. AI auto-replies are not generated for Instagram/Messenger (they land as "needs a person"). Inbound-message / visit-missed flow triggers still to wire.

## P5: Voice agents

**Delivered**
- Voice agents (persona on top of an AI agent brain): language, tone, speed, greeting (AI disclosure enforced and recording notice appended), closing, escalation rules, max call length, pause/resume.
- Provider-agnostic call engine: one caller utterance in, one agent utterance out, with every utterance, sentiment reading and keyword signal stored in `call_events`. Safety decisions are rule-based, not left to the model: opt-out phrases end the call, add the number to the DND list and mark the contact opted out; wrong-number, not-interested and goodbye close politely; caller request / discount negotiation / repeated anger hand the call to a person (transfer event, `escalated_to_human`); max duration enforced. Replies use the agent's published version, its knowledge (retrieval) and live inventory facts; a scripted fallback is used when no model is available. Outcomes: qualified, connected, not_interested, dnd, no_answer; transcript, summary, sentiment score written to the call and the lead timeline; existing buyer-DNA/intent scoring reused.
- Outbound campaigns from a saved segment or lead list: DND and missing-consent contacts are skipped at build time and DND is re-checked at dial time; calling window by weekday/hour/timezone (invalid zone = never call); concurrency cap; claim-before-dial; retry policy (attempts, gap); status via telephony webhook; kill switch honoured; pause/cancel; progress and stats. Worker ticks every 15 s.
- Compliance: DND list (normalised numbers, bulk import), automated callbacks now also check it; telephony webhook requires an HMAC signature when `VOICE_WEBHOOK_SECRET` is set and is refused in production when it is not; flow action `request_voice_call`.
- Frontend `/voice`: agents (editor + browser test call that you play by typing, optional spoken replies), numbers & DND, campaigns with live progress, calls with transcript timeline/recording player, analytics.

**Verification**: 32 new tests; API 620/620; web typecheck, eslint, build clean.

**Not built (needs accounts / hardware)**: real telephony media streaming (STT/TTS, barge-in, DTMF), recording storage, warm transfer bridging, Hindi/Hinglish voice quality testing, speed-to-lead within 60 s for portal leads beyond the existing consent-based callback, India DLT/TRAI registration. The engine and campaign layer sit behind the existing `TelephonyProvider` interface so those plug in without changes to the logic.

## P6: Data and intelligence

**Delivered**
- Tags (per entity type, unique names, colours, usage counts, apply/unapply to leads/contacts/conversations with company checks) with **auto-tagging from AI labels**.
- Dynamic groups on top of `segments`: rule builder (stage, intent, score, source, recency, has/completed visit, tag, any collected detail with numeric ranges), live preview, refresh into `segment_members`, member list. Rules are compiled to bound SQL parameters; attribute keys are validated; unknown operators are rejected, not guessed.
- Conversation insights: summary, intent from a real-estate taxonomy (price enquiry, site visit, loan, resale, rental, complaint, broker), labels, sentiment. Rules always classify; Gemini only writes the summary when configured.
- CSAT / NPS surveys with correct NPS maths, range checks, and **AI-estimated scores** (flagged) when the buyer does not answer.
- 360 customer view: one timeline over messages, calls, visits, activities, notes and surveys, plus tags, buyer DNA, attributes, AI summaries.
- Dashboard builder over a fixed metric catalogue (13 metrics: leads by source/stage/agency partner/time, visit conversion, first-response time, AI-only resolution, call outcomes, campaign performance, CSAT, funnel); private vs shared dashboards (shared = viewable, not editable by others).
- Task boards (columns, drag/drop move with dense positions, assignees from your team only, due/overdue, comments, optional form validation of task data, column removal blocked while in use).
- Knowledge tester: runs retrieval only (no tokens spent), shows chunks with match scores, stores history.
- Frontend: `/data` (groups, tags, surveys, knowledge tester), `/boards`, `/dashboards`, `/contacts/:id` (360), link from Contacts.

**Verification**: 17 new tests; web typecheck/eslint/build and API lint clean (see final totals below).

**Not built**: knowledge types Table / Proxy / Media catalogue and Google Docs/Sheets/Drive import with re-sync (need OAuth app), scheduled e-mailed dashboard reports and AI weekly summary, group size trend history, drag-grid layout editor (layout is stored, charts render in a responsive grid).

## P7: Enterprise controls and developer platform

**Delivered**
- Teams and **policies** (ABAC on top of roles): module x action rules (view/add/change/delete/export) with conditions (office hours in a timezone, team membership), assignable to users, roles, teams and API keys, with a full change history. Semantics: roles stay the baseline; once any policy applies to a person, only what the policies grant is allowed (`POLICY_DENIED` otherwise). Policy administration is role-gated and never subject to policies, so nobody can lock themselves out. Enforced today on the inbox (view, reply) and the customer 360 view; `enforcePolicy(module, action)` is a one-line guard for any other route.
- **Access logs**: who viewed a conversation or customer record, who exported or downloaded personal data; filterable, admin-only, CSV export that neutralises spreadsheet formulas and logs itself.
- **PII masking by role** (default: viewers) for phone and e-mail in the inbox and 360 view, configurable per company.
- **API keys**: optional expiry (enforced on use, `KEY_EXPIRED`), usage counter, last used, revoke; keys can be targeted by policies.
- **Notification rules and centre**: company defaults plus personal overrides per event (hot lead, handoff, visit booked, new lead, call completed, SLA breach, webhook failed), in-app and e-mail delivery (WhatsApp/Slack accepted, delivered once those connectors exist); the outbox consumer uses rules when present and the previous built-in alert otherwise; per-user list, unread count, mark read.
- **Usage metering (tracking only)**: tokens/cost by purpose, messages by channel, AI call minutes (test calls excluded), daily series; every billable LLM call and finished call also writes `usage_ledger` rows, the base for P8 credits.
- **Privacy / DPDP**: consent records (latest decision wins; withdrawing voice consent adds the number to DND), data requests with admin approval: export (JSON bundle, download is logged) and erasure by anonymisation (details and message text removed, number added to DND, lead record and counts kept).
- **Public changelog** (`/changelog`, platform-owner publishing).
- Frontend `/controls` (policies, teams, access logs, privacy and data requests, usage, alerts, API keys) and `/changelog`.

**Verification**: 20 new tests; full API suite 657/657 (default test timeout raised to 30 s because ~100 files share one dev DB and bcrypt user creation is slow under load); web typecheck, eslint and build clean; shared 10/10; widget 13/13.

**Not built**: LeadSquared / Zoho bidirectional sync, Slack / Freshdesk / Airtable / Metabase, OpenAPI for the new endpoints and a webhook catalogue, policy enforcement on every legacy route (guard exists, applied to inbox and 360 first), PII masking inside message text and legacy list endpoints, per-company retention settings.

## P8: Payments, billing and credits

Uses the existing plan table (`SUBSCRIPTION_PLANS`, INR) and Stripe, as agreed; no pricing was changed.

**Delivered**
- **Real Stripe Checkout** (REST, no stub): plan purchase is a recurring INR subscription (monthly/yearly) with the company and plan in the session and subscription metadata. Without `STRIPE_SECRET_KEY`, development falls back to the mock provider and production refuses (503).
- **Subscription lifecycle**: paid events upgrade the plan once (event id recorded in `payment_events`; a failed delivery is forgotten so the provider's retry is processed); `invoice.payment_failed` puts the subscription in `past_due` and raises a `payment_failed` alert; after a 7-day grace period the worker moves it to the trial plan; a later successful payment clears it; cancelling also stops renewal at Stripe (`cancel_at_period_end`) using the remembered Stripe subscription id.
- **GST**: company billing profile (GSTIN/PAN/state validated for consistency); every invoice stores the inclusive 18% tax split (CGST+SGST in the seller's state, IGST otherwise, exact to the paisa) and a snapshot of the billing details.
- **Booking-token payments**: payment links for a lead and unit (unit must be available, duplicates blocked), Stripe hosted checkout (24 h max), amount verified against the order before it is credited (mismatch = failed, no receipt), sequential receipt numbers per company and year, escaped printable receipt with the project's RERA number (CSP locked down), lead activity and `payment_received` alert, expiry sweep.
- **Refunds**: partial or full, bounded by what is left, serialised with a row lock so parallel requests cannot over-refund, provider refund with idempotency key, failures recorded and the order stays refundable.
- **Prepaid credits** on top of the P7 usage ledger: packs (with bonus), top-up through a paid order (paying twice never doubles credits), real Gemini cost and AI call minutes debited (1 credit = Rs 1), balance never below zero, one low-balance alert per crossing, only companies with a credit account are metered.
- Frontend `/billing`: booking payments (create link, copy, refund, receipt, test-mode mark paid), credits (packs, history, low-balance reminder), billing details.

**Verification**: 27 new tests (Stripe calls asserted on URL, body, headers and idempotency keys with `fetch` mocked; signature failures; redelivery; amount mismatch; refund race); full API suite 684/684; web typecheck, eslint and build clean.

**Not done**
- Live Stripe calls were not made (no keys here): run one test-mode checkout, one booking token and one refund with your Stripe test keys, and register the webhook (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.expired`).
- Razorpay checkout is still the old stub; GST invoice PDF generation; automatic charging for credit auto top-up (needs a saved payment method; today it reminds); unit blocking/stage change after a token is paid; WhatsApp/chat "send payment link" action for agents (the API exists); Stripe Tax/e-invoicing (IRN) for turnover above the e-invoice threshold.
- Go-live hardening from the roadmap (load tests, backups, monitoring, security review, penetration-test fixes) is a separate workstream.

## UI roadmap (Phases 0 to 6)

Built on the existing stack (TypeScript, Tailwind, React Query, PostgreSQL), not the plain JS / MongoDB the roadmap sketches. Accent is now the roadmap's teal.

**Delivered**
- **P0 design system**: tokens in `styles/tokens.css` (light and dark via `[data-theme]`), Inter, 4px scale, `Input`, `Select`, `Modal`, `Toast`, `Tabs`, `ThemeToggle`, `StatusBadge`, restyled `Button`, `Card`, `Badge`; `/styleguide`. Legacy blue / orange / slate utilities map onto the new palette. AA contrast is enforced by `tests/tokens-contrast.test.ts`.
- **P1 shell**: 240px collapsible sidebar (drawer under 768px, bottom tabs on phones), top bar with breadcrumbs and theme toggle, skip link, `PageHeader`.
- **P2 leads and clients grid**: `DataGrid` (arrow keys, Enter / F2 / double-click to edit, Esc cancels, sortable headers, sticky header, density, skeleton, error with Retry), `LeadsTable` (inline edit of name, phone, budget in INR, follow-up; status pill menu with lost-reason; agent assign; bulk status; search and status filter; CSV export that neutralises spreadsheet formulas; detail drawer). `/clients` reuses it for booked and converted leads. New `PATCH /api/leads/:id` (7 tests).
- **P3**: Overview from real data (stat cards with trends and sparklines, 30-day line chart, leads-by-source donut, recent leads, upcoming visits; Recharts reading CSS variables). Appointments week calendar from real appointments with status colours. Webhook logs: monospace table, status pills, expandable request and response JSON. Chatbot setup already had the stepper and live preview.
- **P4 public site** (`/`): sticky nav, hero with browser and phone frames, trust strip, illustrative proof band (labelled), 6 use cases, alternating feature rows, built-for, 3 steps, pricing read from `SUBSCRIPTION_PLANS`, 8-question FAQ, demo form, footer. New `POST /api/demo-requests` (table `demo_requests`, migration 0021, validation, honeypot, 24 h duplicate guard, 5 / hour / IP limit; 5 tests).
- **P5 imagery**: light and dark dashboard and chat illustrations in `public/images` (SVG, fictional data) shown through `<picture>` with width and height, lazy loading and alt text; CSS browser and phone frames.
- **P6**: reduced-motion safe reveal, route code-splitting (already lazy), per-page titles and meta (`useDocumentMeta`), Open Graph tags, `robots.txt`, build-time sitemap, 404 page.

**Verification**: web typecheck and eslint clean, 97 web tests, build OK. API 696 tests; two stale tests fixed (voice-studio pinned a date the real clock had passed, billing-security left a global event row that made every second run fail). Lighthouse on the production build: mobile 95 / 100 / 96 / 100, desktop 100 / 100 / 96 / 100 (performance, accessibility, best practices, SEO). The 96 is a 429 from the dev API caused by the repeated audit runs.

**Not done**
- Images are SVG, not WebP (no image tooling here); the Open Graph image is SVG, which many social crawlers ignore. Swap in a 1200x630 PNG or JPG and a real screenshot when you have them.
- Sitemap needs `SITE_URL` at build time; without it the step is skipped.
- Analytics page and `AnalyticsDashboard` still use their older hard-coded palettes. The old `components/platform/*` files are no longer used by the home page and can be deleted.
- Authenticated screens were checked by build, types and tests, not by a logged-in visual pass at all four widths; the public site was checked at 360 and 1440 in both themes.

## Roadmap status

P1 to P8 are implemented locally and uncommitted on `feat/business-logic-completion`. Deferred P0 leftovers: smoke suite on a separate test DB, removal of hardcoded dev JWT secrets, Redis rate limiter, Gemini billing + `check:gemini`. Nothing has been clicked through in a browser yet.
