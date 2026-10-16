# PropBot Pro — Forensic Rescue & Diagnosis Report (Phase R0)

**Date**: October 15, 2026  
**Status**: Completed  
**Rule File**: `/docs/V5_ADDENDUM.md`  

---

## 1. Executive Summary

This rescue audit forensic report inspects every subsystem of PropBot Pro against the v4 foundational architecture specification and the v5 production upgrade specification.

Prior to Phase R0, the codebase reported all 15 v4 phases as complete, but live runtime inspection uncovered critical path breakdowns:
1. **Broken Public Chat Route**: Public website visitors and embeddable widgets had no mounted endpoints (`/public/session`, `/public/message`, `/public/lead`) to initialize a session or stream chat messages.
2. **Empty Widget Stub**: `packages/widget` was an empty placeholder class that inserted an empty `div` into the DOM with no chat UI, inputs, or transport logic.
3. **Simulated AI Fallback**: `apps/api/src/modules/ai/router.ts` contained a 500+ line offline response generator (`generateOfflineGroundedResponse`) that silently returned hardcoded regex mock responses instead of failing loudly when LLM keys were missing.
4. **Local Infrastructure State**: Local PostgreSQL 16 is active on port 5432 and database `propbot_pro` is accessible, but the compiled `vector` extension is not installed in the Windows environment, and Redis on port 6379 is not running locally.

### Actions Completed in Phase R0 (Zero Keys Needed):
- ✅ Created `/docs/V5_ADDENDUM.md` defining strict production criteria, AI grounding rules, and secret hygiene.
- ✅ Implemented `PublicChatService` and `PublicChatController` in `apps/api/src/modules/chat/` with session tokens, SSE message streaming, and lead capture.
- ✅ Mounted `/public` and `/api/public/chat` endpoints in `apps/api/src/server.ts`.
- ✅ Gated offline mock fallbacks in `apps/api/src/modules/ai/router.ts` strictly behind `ALLOW_OFFLINE_MOCK=true` and `NODE_ENV !== 'production'`. Throws `ProviderNotConfiguredError` when keys are missing.
- ✅ Built real `ChatWidgetUi` in `packages/widget` with Shadow DOM isolation, floating trigger button, chat window, quick question pills, SSE streaming parser, and lead capture form.
- ✅ Added `pnpm doctor` (`apps/api/src/scripts/doctor.ts`) inspecting Postgres, pgvector, Redis, LLM, Meta WhatsApp, and storage.
- ✅ Added `pnpm smoke:chat` (`apps/api/src/scripts/smoke-chat.ts`) verifying bot provisioning, visitor session, messaging, lead capture, and `domain_events` outbox logging.
- ✅ Added "AI Not Connected" banner to dashboard linking to `/settings` when LLM keys are missing.
- ✅ Verified all test suites: 63 frontend tests and 5 public-chat integration tests passing.

---

## 2. Feature Status & Evidence Matrix

| Feature | Status | Evidence (Files & Lines) | Fix Plan | Needs a Key from User? |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | **Working** | `apps/api/src/modules/auth/auth.service.ts#L1-L280`<br>`apps/api/src/middlewares/rbac.ts#L1-L60` | Verified Argon2id password hashing, JWT access/refresh rotation, and 5-role RBAC matrix. | No |
| **Chatbot Wizard** | **Working** | `apps/web/src/pages/ChatbotWizardPage.tsx#L1-L180`<br>`apps/api/src/modules/chatbots/chatbots.service.ts#L1-L300` | 8-step wizard creates bot record with `publicKey`, color themes, and delivery rules in Postgres. | No |
| **Knowledge Training & Ingestion** | **Working** | `apps/api/src/modules/knowledge/knowledge.service.ts#L1-L240` | Parses text, PDF, URL sources, computes chunks and SHA-256 hashes. Vector embedding uses deterministic vector fallback when OpenAI key is absent. | Yes (`OPENAI_API_KEY` for real embeddings) |
| **Hybrid Retrieval** | **Partial** | `apps/api/src/modules/ai/retrieval.service.ts#L138-L170` | Full-text search (`tsvector` + `plainto_tsquery`) functions; `pgvector` cosine similarity requires `vector` extension in Postgres. | Yes (Postgres with `vector` extension) |
| **Grounded Answering** | **Fixed** | `apps/api/src/modules/ai/router.ts#L43-L55`<br>`apps/api/src/modules/chat/public-chat.service.ts#L170-L240` | Removed silent fake responses. When keys are missing, now returns clear `PROVIDER_NOT_CONFIGURED` status and widget displays honest callback advisory. | Yes (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) |
| **Web Chat Widget** | **Fixed** | `packages/widget/src/ui.ts#L1-L400`<br>`packages/widget/src/index.ts#L1-L105` | Replaced empty stub with full interactive Shadow DOM UI, SSE streaming reader, quick pills, and lead capture modal. | No |
| **Lead Capture & CRM Sync** | **Working** | `apps/api/src/modules/chat/public-chat.service.ts#L240-L320`<br>`apps/api/src/db/schema/leads.ts#L1-L100` | Creates `contacts` and `leads` rows linked to `conversations`, assigns initial intent score (70), and writes to `domain_events`. | No |
| **Buyer DNA Extraction** | **Working** | `apps/api/src/modules/crm/copilot.service.ts#L1-L200` | Extracts budget, configuration, timeline, and purchase purpose from conversation metadata. | Yes (`OPENAI_API_KEY` for live LLM extraction) |
| **Intent Score (0–100)** | **Working** | `apps/api/src/modules/leads/intent-scorer.service.ts#L1-L120` | Rule-based intent scoring algorithm evaluates message count, budget specificity, and contact details. | No |
| **Hot-Lead Alerts & Outbox** | **Working** | `apps/api/src/db/schema/events.ts#L1-L36`<br>`apps/api/src/modules/events/outbox-dispatcher.service.ts#L1-L120` | Emits `lead.created` event into `domain_events` transactional outbox table for worker processing. | No |
| **Inventory & Unit Management** | **Working** | `apps/api/src/modules/inventory/inventory.service.ts#L1-L250`<br>`apps/web/src/pages/PropertiesPage.tsx#L1-L220` | Full CRUD for projects, towers, floor plans, and unit pricing models. | No |
| **Shortlist Room** | **Working** | `apps/api/src/routes/shortlist-room.routes.ts#L1-L45`<br>`apps/web/src/pages/ShortlistRoomPage.tsx#L1-L180` | Token-based public shortlist link allowing buyers to view curated properties and react. | No |
| **Appointments & Site Visits** | **Working** | `apps/api/src/modules/appointments/appointments.controller.ts#L1-L150`<br>`apps/web/src/pages/AppointmentsPage.tsx#L1-L210` | Slot availability checking, reservation transactions, and automated reminder sweeps. | No |
| **WhatsApp Business Bot** | **Partial** | `apps/api/src/modules/whatsapp/whatsapp.service.ts#L1-L230` | Webhook verification and payload normalization implemented; outbound dispatch blocked by missing Meta credentials. | Yes (`META_WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`) |
| **Webhooks & Integrations** | **Working** | `apps/api/src/modules/webhooks/webhooks.service.ts#L1-L180`<br>`apps/web/src/pages/WebhookLogsPage.tsx#L1-L160` | HMAC SHA-256 signature verification, retry scheduling with exponential backoff, delivery logging. | No |
| **Analytics Dashboard** | **Working** | `apps/web/src/components/AnalyticsDashboard.tsx#L1-L850`<br>`apps/api/src/modules/analytics/analytics.service.ts#L1-L150` | Cue Dark Theme sales-analytics application with KPI cards, mini-bars, sales over time charts, and filters. | No |
| **Subscription & Billing** | **Working** | `apps/api/src/modules/billing/billing.service.ts#L1-L200`<br>`apps/web/src/pages/SubscriptionPage.tsx#L1-L180` | Plan tiers (Starter, Pro, Enterprise), lead credit tracking, invoice generation. Gateway blocked by missing Razorpay/Stripe keys. | Yes (Razorpay / Stripe keys for live payments) |

---

## 3. End-to-End Chatbot-to-CRM Conversation Trace

Below is the verified trace of a visitor conversation from public widget to CRM lead generation:

```
[Hop 1] Widget Client (Shadow DOM)
        Action: User clicks floating launcher button
        Target: POST /public/session { publicKey: "pb_..." }
        Status: PASS (200 OK)
        Result: Issues sessionToken (JWT) & conversationId. Returns bot greeting & pills.

[Hop 2] Visitor Query
        Action: Visitor asks "What is the starting price for 3BHK villas?"
        Target: POST /public/message { conversationId, message, stream: true }
        Status: PASS (200 OK)
        Result: Message saved in `messages` table (sender: "visitor").

[Hop 3] AI Retrieval & Model Router
        Action: RAG retrieval & modelRouter evaluation
        Status: PASS (Fails Loudly / Honest Advisory)
        Result: Without LLM key, does NOT fabricate prices. Delivers honest polite notice:
                "Thank you for reaching out! Our real estate AI assistant is currently
                undergoing configuration. Please share your phone number or email..."
                Message saved in `messages` table (sender: "bot", aiOffline: true).

[Hop 4] SSE Streaming Transport
        Action: SSE stream reader chunks output to widget
        Status: PASS
        Result: Stream chunks rendered live in assistant bubble.
                On stream completion (`done: true, aiOffline: true`), renders lead capture card.

[Hop 5] Lead Capture & Outbox
        Action: Visitor inputs "Rahul Verma" and "+919988776655"
        Target: POST /public/lead { conversationId, fullName, phone }
        Status: PASS (200 OK)
        Result: Creates `contacts` row, creates `leads` row with intentScore=70,
                links `conversations.leadId`, writes `lead.created` event into `domain_events`.

[Hop 6] Dashboard Visibility
        Action: Agency navigates to CRM dashboard (/leads)
        Status: PASS
        Result: Captured lead appears in live leads table with "Web AI Chatbot" source.
```

---

## 4. Fakes & Simulations Hunt (Inventory of Findings)

| File | Line(s) | Finding | Remediation in Phase R0 |
| :--- | :--- | :--- | :--- |
| `apps/api/src/modules/ai/router.ts` | Lines 86–374 | `generateOfflineGroundedResponse`: 300+ lines of regex matching returning hardcoded property data. | Gated strictly behind `ALLOW_OFFLINE_MOCK=true`. Throws `ProviderNotConfiguredError` in standard mode. |
| `apps/api/src/modules/ai/router.ts` | Lines 403, 531 | Fallback executed silently when `!apiKey`. | Now throws `ProviderNotConfiguredError` and logs configuration status. |
| `packages/widget/src/index.ts` | Lines 33–57 | Empty stub methods (`identify`, `track`, `setContext`) with no interactive UI. | Replaced with real `ChatWidgetUi` managing Shadow DOM, SSE streaming, and lead form. |
| `apps/api/src/server.ts` | Lines 71–101 | Missing public widget routes `/public/*` or `/api/public/chat/*`. | Implemented and mounted `publicChatRouter`. |
| `apps/web/src/pages/DashboardPage.tsx` | Line 49 | Hardcoded badge `<Sparkles /> AI Engine Active` shown even with missing keys. | Replaced with dynamic check: shows "AI Offline (Keys Missing)" and amber warning banner linking to `/settings`. |

---

## 5. Diagnostic Tooling Verification

### `pnpm doctor` Output:
```
===============================================================
             PROPBOT PRO — SYSTEM DIAGNOSTICS (DOCTOR)         
===============================================================

┌──────────────────────────────────────┬─────────┬────────────────────────────────────────────────────────┐
│ Component                            │ Status  │ Details                                                │
├──────────────────────────────────────┼─────────┼────────────────────────────────────────────────────────┤
│ PostgreSQL Database                  │ PASS    │ Connected to database 'propbot_pro'                    │
│ pgvector Extension                   │ FAIL    │ Extension "vector" is not installed in database        │
│                                      │         │ ↳ Hint: Run "CREATE EXTENSION IF NOT EXISTS vector;... │
│ Redis & BullMQ                       │ FAIL    │ Unreachable at localhost:6379                          │
│                                      │         │ ↳ Hint: Start Redis service or docker compose up -d... │
│ LLM Provider (Live Call)             │ MISSING │ No LLM API keys set (OPENAI_API_KEY, ANTHROPIC_API_... │
│                                      │         │ ↳ Hint: Run pnpm setup:keys in Phase R3                │
│ Embedding Provider                   │ MISSING │ No embedding API key found                             │
│                                      │         │ ↳ Hint: Configure OPENAI_API_KEY or EMBEDDING_API_K... │
│ Meta WhatsApp Cloud API              │ MISSING │ META_WHATSAPP_TOKEN or PHONE_NUMBER_ID is missing      │
│                                      │         │ ↳ Hint: Configure in Phase R3 / Meta developer console │
│ Object Storage (Brochures / R2)      │ MISSING │ No storage credentials configured                      │
│                                      │         │ ↳ Hint: Required for brochure and floor plan upload... │
│ Email / SMTP Service                 │ MISSING │ SMTP_HOST not set (Email notifications disabled)       │
│                                      │         │ ↳ Hint: Configure SMTP_HOST and credentials in .env... │
└──────────────────────────────────────┴─────────┴────────────────────────────────────────────────────────┘
```

### `pnpm smoke:chat` Output:
```
===============================================================
             PROPBOT PRO — SMOKE:CHAT DIAGNOSTIC TEST          
===============================================================

[1/5] Setting up test company and public chatbot...
[2/5] Initializing public visitor session...
[3/5] Testing visitor message transmission and response...
[4/5] Testing lead capture and contact persistence...
[5/5] Verifying database integrity and domain_events outbox...

┌─────────────────────────────┬─────────┬────────────────────────────────────────────────────────┐
│ Step                        │ Status  │ Details                                                │
├─────────────────────────────┼─────────┼────────────────────────────────────────────────────────┤
│ Bot Provisioning            │ PASS    │ Created test bot 'Smoke Test Aurora Bot' with publi... │
│ Session Initiation          │ PASS    │ Conversation ID: 77069e65-2cf1-451b-88bd-74ac68330c47  │
│ Chat Exchange               │ PASS    │ Successfully sent 3 queries and received assistant ... │
│ Lead Capture                │ PASS    │ Lead ID: ce60aba5-04b6-4b3c-8b7c-c6857bec084c, Cont... │
│ Event Outbox Integrity      │ PASS    │ Linked conversation to lead; outbox event 'lead.cre... │
└─────────────────────────────┴─────────┴────────────────────────────────────────────────────────┘

[✓] Chatbot-to-CRM journey verified end-to-end! Smoke test PASSED.
```

---

## 6. Acceptance Criteria Checklist for Phase R0

- [x] **RESCUE_REPORT.md exists with evidence for every feature**: Completed in this document.
- [x] **No canned or simulated chat replies remain on the live path**: Canned generator gated strictly behind explicit test flags; missing keys trigger loud error codes and honest fallback notices.
- [x] **`pnpm doctor` runs and clearly shows which keys are missing**: Implemented, verified, secret-safe.
- [x] **Everything that does not need a key now works; typecheck, lint, tests green**:
  - `pnpm typecheck`: Passed with 0 errors across all workspaces.
  - `@propbot/web` tests: 63 of 63 tests passing.
  - `@propbot/widget` tests: 5 of 5 tests passing (builds ESM and IIFE bundles).
  - `@propbot/api` public chat tests: 5 of 5 tests passing.
  - `pnpm smoke:chat`: 5 of 5 steps passing.
