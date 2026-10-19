# AUDIT_REPORT.md — Phase 0 (read-only discovery)

## Status
- SPEC received (Comprehensive Business Logic Analysis, §1–9). First-pass comparison below; items marked ⚠️/❌ were confirmed by grep/read, ✅ only where the code was seen. Deeper line-level verification happens in each phase.
- No source code was changed in Phase 0. This file is the only file written.
- `git stash` / branch `feat/business-logic-completion` not done yet (nothing to commit in Phase 0).

## Detected stack (adaptations to the prompt)
| Prompt assumption | Actual | Adaptation |
|---|---|---|
| Next.js + Vercel | pnpm monorepo: `apps/api` (Express 4-style, tsup), `apps/web` (Vite+React), `apps/widget`, `packages/*` | Use Express routers in `apps/api/src/routes` |
| MongoDB collections, TTL index | PostgreSQL + Drizzle ORM (`apps/api/src/db/schema/*`, migrations) | OTP expiry = `expires_at` column + cleanup job (no TTL index in Postgres); "atomic upsert" = `INSERT ... ON CONFLICT` with unique indexes |
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
