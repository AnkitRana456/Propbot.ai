# PropBot Pro: real-estate platform roadmap (Angoor-inspired)

Prepared 2026-10-21. Scope: only Angoor capabilities that matter for real estate. E-commerce/logistics features (Shopify, ClickPost, Unicommerce, carts, returns) are dropped. **Payments, billing and plan pricing are the last phase (P8).** Until then the LLM provider is **Gemini only** (one `GEMINI_API_KEY`).

Companion document: `docs/ANGOOR_BENCHMARK_AND_ROADMAP.md` (what Angoor does, gap table).

---

## 0. Ground rules

**Backend:** Express + Drizzle/PostgreSQL in `apps/api`, shared types in `packages/shared`, widget in `packages/widget`.
**Frontend:** Vite + React + Tailwind in `apps/web` (existing pages: Dashboard, Chatbots/wizard/settings/training, Leads, Contacts, Properties, Appointments, Analytics, Workflows, Campaigns, WhatsApp, WebhookLogs, Approvals, Users, Subscription, Settings, Help).
**Every phase delivers backend + frontend + tests + docs.** A phase is "done" only when a non-engineer can use it from the UI.
**Migrations:** each phase lists its tables; I show the SQL and wait for your approval before running it (same rule as before).
**Nothing is committed** until you say so.

### Gemini constraints that shape the design
| Need | Gemini approach | Notes |
|---|---|---|
| Chat / RAG answers | `gemini-3.8-flash` (default, already wired in `modules/ai/llm.ts`) | Model chosen per agent from a **model registry** (below) |
| Routing / classification (LLM Logic Routing, intent, sentiment, labelling) | Same model with **`responseMimeType: application/json` + `responseSchema`** | Deterministic, cheap; fall back to heuristics on failure |
| Tool use (API tools, actions) | Gemini **function calling** in an agent loop built on `@google/genai` | Bounded steps, per-tool allow-list, human approval for risky tools (existing T2 queue) |
| Embeddings | `gemini-embedding-001` (already wired, 3072 dims) | |
| Document/image reading (KYC, booking forms, scanned brochures) | Gemini multimodal input | Replaces Angoor's GPT-4 Vision |
| Voice STT / TTS | Gemini transcription and TTS models appear in your key's model list (`gemini-3.5-transcribe`, `gemini-3.8-flash-tts`); verify quality for Hindi/Hinglish before committing | Telephony provider is separate (P5) |
| Cost / quota | Token usage already returned per call | **Your key is currently out of quota: enable billing before P1** |

**Model registry** (new, P1): a table/config of allowed Gemini models with context size, speed tier and price per 1K tokens, so agents pick "Fast" or "Smart" without code changes. Keep the `LLM_PROVIDER` switch so OpenAI/Anthropic can be added later without touching agents.

### Suggested team and timeline
One engineer: about 11-13 months for P0-P7. Two engineers (one backend-heavy, one frontend-heavy) in parallel: about 6-7 months. P8 (payments) adds 3-4 weeks at the end.

```
P0 close-out ─┬─ P1 agents/forms ─ P2 tools/actions ─ P3 flow builder ─┬─ P4 channels+inbox ─ P5 voice
              │                                                       └─ P6 data & intelligence
              └──────────────────────────────────────────── P7 enterprise controls ───── P8 payments
```
P4, P5, P6 can run in parallel after P3. P7 can start any time after P1.

---

## P0. Close-out of the current work (1-2 weeks)

**Goal:** a verified, hardened baseline before building more.

| Area | Work |
|---|---|
| Media (Phase 6 tail) | Approve and run migration `0018_project_media` (`projects.highlight_photos`, `projects.master_plan_url`); Drizzle fields; media loader (project from message name → `config.mediaProjectId` → company's latest project); `media` in `/public/message` response and message metadata; widget renders images + sandboxed Google Maps iframe |
| Inventory UI | Property form gets "Highlight photos" (multi-upload/URL), "Master plan", floor-plan editor, map URL/lat-lng |
| Phase 8 | Smoke-test suite hitting every endpoint (signup→approval→login, 429s, role checks, tenant isolation, chat→Gemini, lead/OTP/brochure, webhooks incl. failing receiver, WhatsApp verify+inbound, cron with/without secret, uploads, delete keeps leads, plan limits) against a **separate `propbot_pro_test` DB**; widget test page; final build + lint |
| Hardening | Remove hardcoded dev JWT secrets (`public-chat.service.ts`, `auth.utils.ts`) so production refuses to boot without real secrets; remove demo quick-login from the web login page outside dev; Redis-backed rate limiter option (`REDIS_URL`) |
| Gemini | Re-run `check:gemini` after billing; token/cost logging per call into a table (feeds P1 execution logs) |

**Frontend:** property editor additions above; widget shows media bubbles.
**Manual:** Gemini billing; approve 0018.
**Done when:** `pnpm test` green on the test DB, `check:gemini` passes, widget page shows photos/floor plan/map from chat.

---

## P1. Agents and Forms (5-7 weeks)

*Angoor: Agents, Forms/Attributes, Knowledge references, Prompt versioning.*

### Backend
- Tables: `agents` (company, name, description, tags, prompt sections, model, temperature, flags, active_version_id), `agent_versions` (immutable snapshots), `agent_variables`, `forms`, `form_fields` (type, label, validation, options, required), `form_submissions`, `knowledge_references` (named subsets of KB sources/collections), `llm_calls` (agent/flow, model, tokens in/out, latency, cost, status, error).
- Agent prompt template sections: Job Description, Character, Information to Collect, Tone, Style/Language (as Angoor) **plus real-estate presets**: Lead Qualifier, Site-Visit Booker, Loan/EMI Helper, Neighbourhood Guide, Post-Visit Follow-up, Re-engagement.
- `{{variable}}` interpolation with lead/contact/project attributes; conditional prompt blocks (Field-Operator-Value).
- Agent runtime service replaces the single `retrievalService.buildSystemPrompt` path: chatbot → default agent; agent flags (one question per message, split long answers, language, auto-replies).
- Forms: custom **lead attributes** (budget, BHK, purpose, possession timeline, loan need, co-applicant, source…) stored typed in Postgres JSONB with schema validation; forms attach to agents ("Information to Collect") and to leads.
- Version publish/rollback; **A/B compare** two versions on a saved test set (run both through Gemini, show side by side).
- `llm_calls` logging for every Gemini call (feeds dashboards in P3/P6).

### Frontend (new routes)
- `/agents` list (name, owner, variables, KB, tags, status) and `/agents/:id` studio: Core tab (prompt sections editor, variables panel, "Refer knowledge" picker, conditions builder), Settings tab (model picker from registry, temperature, flags), **Test chat panel** with transcript + sources, Versions tab (diff, publish, rollback, compare).
- `/forms` builder (drag fields, validation, preview) and a "Lead attributes" settings page; Leads table/drawer renders custom fields.
- Chatbot wizard: choose agent + form instead of free-text persona.

### Gemini notes
Structured extraction of form fields from chat uses `responseSchema`. Add a safety layer: never let an agent state price/availability unless it came from retrieved data (existing guardrails stay as a system block).

### Manual / decisions
Which attributes your sales team needs; sample conversations for the test set.
**Done when:** a manager creates "Site-visit booker" from a template, edits the prompt, tests it, publishes v2 and the live widget uses it.

---

## P2. Tools and the real-estate action library (4-6 weeks)

*Angoor: GPT tools, API tools, 90 actions (we build the ~35 that matter).*

### Backend
- Tables: `tools` (type gpt|api, schema for inputs/outputs, secrets ref, rate limit, requires_approval), `tool_runs` (inputs, outputs, status, duration), `actions_registry` (code-defined, versioned).
- **GPT tools:** prompt + typed inputs → structured JSON output via `responseSchema` (e.g. "Extract budget and BHK", "Summarise call", "Score objection").
- **API tools:** HTTP call builder (method, URL template, headers, auth from the existing encrypted vault, body template, response mapping/JSONPath, timeout, retries), existing SSRF guard, allow-list per company. Tool results available to agents via Gemini function calling.
- **Action library** (each an idempotent function with typed inputs/outputs):
  - *Lead and data:* create/update lead, set stage, add/remove tag, set variable, add to user group, get/update attribute, merge duplicate, assign round-robin, check team availability.
  - *Property:* search inventory, get unit availability/price, get brochure, get floor plan, get distance to landmark (geocode + distance), generate shortlist room link.
  - *Appointments:* create/reschedule/cancel site visit, check agent availability, send reminder.
  - *Messaging:* send WhatsApp template, send text/image/document, send email, notify team (Slack/e-mail/in-app).
  - *Ops:* create task, create ticket, trigger webhook, call API tool, run GPT tool, document-to-text (Gemini vision), wait.
- Approval policy per tool/action (existing T2 queue): money- or commitment-affecting actions need a human.

### Frontend
- `/tools` list + editor (GPT tool form: prompt, inputs, output schema, test runner; API tool form: request builder, secret picker, "Test call" with response viewer).
- `/actions` catalogue (searchable, with input/output docs) used by the flow builder in P3.
- Tool run history per tool.

**Manual:** credentials for any external APIs you want as tools (portal APIs, internal ERP).
**Done when:** an agent can answer "is a 3BHK in Tower B available under 1.5 Cr?" by calling the inventory action live, and a sales manager can add an internal CRM API as a tool without developer help.

---

## P3. Flow builder v2 (8-10 weeks)

*Angoor: flows with entry points, paths, steps, routing, sub-flows, executions.*

### Backend
- Tables: `flows`, `flow_versions` (graph JSON), `flow_entry_points` (trigger type + config), `flow_executions`, `flow_step_runs` (input, output, tokens, error, duration), `flow_variables` (flow/execution/session scopes).
- **Engine** (replaces `workflow-engine.service`): graph interpreter with persisted state (resume after wait/user reply), step categories **Content, Routing, Agent, Tool, Action, Sub-flow**.
  - Routing: Quick Replies (text/phone/url buttons), **LLM Logic Routing** (Gemini picks branch with `responseSchema`, 3 retries), Decision Routing (equals, contains, greater, less…), Wait Time, Loop.
  - Triggers: new inbound message, new lead, lead stage changed, site visit booked/missed, form submitted, scheduled (cron), webhook/API call, no-reply-for-N-hours.
  - Sub-flows with Pre/Post/On-Error/On-Setup hooks; reusable across flows; per-flow versions with publish; dry-run mode.
- Deterministic safety: max steps per execution, loop caps, per-company concurrency, idempotent side effects, kill switch (existing `companyAiSettings.killSwitch`).
- Seed **real-estate flow templates**: instant lead response (<1 min), lead qualification, site-visit booking and reminders (24h/2h), no-show recovery, post-visit feedback, cold-lead re-engagement drip, brochure follow-up, broker/channel-partner lead routing, token-amount nudge (payment step stubbed until P8).

### Frontend
- `/flows` list and `/flows/:id` **canvas** (recommended: `@xyflow/react`): step palette by category, drag/connect, side panel per step with variable picker (`{{ }}` autocomplete), validation badges, minimap, undo/redo, version history, Test run with live highlighting of the executing path.
- `/executions`: table (flow, lead, channel, status, duration, tokens) with filters; detail view = timeline of step inputs/outputs and Gemini prompts/responses (this is the **LLM-ops / observability** screen).
- Template gallery ("Use template").

**Done when:** a marketer builds "missed-visit follow-up" on the canvas, tests it, publishes it, and sees every run traced step by step.

---

## P4. Omnichannel inbox, channels and lead sources (8-12 weeks)

*Angoor: conversational inbox, channels, Instagram, Messenger, email, custom API channel, WhatsApp templates/campaigns, widget builder.*

### Backend
- **Channel abstraction** (extends `ChannelAdapter`): `whatsapp`, `web`, `instagram`, `messenger`, `email`, `api`. Per-channel identity on `contacts` (`contact_identities`: channel, external id, handle).
- **Unified conversations:** one inbox model; statuses (bot, open, pending, resolved), priority, assignee, tags, SLA timers (existing SLA fields), "Take Control" / "Hand back to AI", internal notes, @mentions.
- **Custom API channel / lead-source ingestion:** generated API key + URL, sample cURL, payload→form mapping, trigger or scheduled; prebuilt mappers for **Meta Lead Ads, Google Ads lead forms, 99acres, MagicBricks, Housing.com**, plus generic CSV import. Dedup via the existing contact/lead upsert, `utm_agencypartner`/source attribution kept.
- **Instagram:** DM + comment automation (auto-reply on comments mentioning "price/details", private reply to DM, comment intent classification, post list), webhook verification and signature check.
- **Messenger** (same Meta stack). **Email:** inbound (Gmail OAuth or IMAP) + outbound (SMTP already added in the alert pipeline), threading, attachments.
- **WhatsApp:** template manager (create/submit/sync approval status), 24-hour window enforcement in send path, campaign wizard with audience = user group, dispatch now/scheduled, delivery/read/reply metrics funnel, opt-out handling (exists).
- **Embedded Meta onboarding:** "Continue with Facebook" flow to connect WhatsApp/Instagram/Messenger without pasting tokens (needs Tech Provider approval).
- **Widget builder v2:** configurable Home tab (welcome, quick actions), nudges (proactive prompts by URL/time on page), conversation history for returning visitors, help-centre tab backed by the KB, domain allow-list, theme/branding, install snippet.

### Frontend
- `/inbox`: 4-pane layout (list with filters/tabs, chat window, chat controls, contact panel with lead stage, attributes, past visits, tags, notes). Works across channels; channel badges; composer with templates, media, property cards, quick replies; "Take Control" banner.
- `/channels`: connect/disconnect cards per channel with health status, webhook test, onboarding wizard; `/lead-sources` for API/portal ingestion with test payload runner and mapping UI.
- `/campaigns` upgrade: wizard + metrics funnel; `/templates` manager with preview and status.
- `/widgets` builder with live preview; install instructions.

**Manual:** Meta Business verification, app review (`instagram_manage_messages`, `instagram_manage_comments`, `pages_messaging`), WhatsApp number and templates, Google OAuth for Gmail, portal lead-push credentials. **Start these approvals immediately; they take weeks.**
**Done when:** a Meta lead ad, an Instagram comment and a WhatsApp message all show up in one inbox, get the same AI treatment, and a human can take over any of them.

---

## P5. Voice agents (8-10 weeks)

*Angoor: build, listen, route, call, analyse.*

### Backend
- Telephony adapter (Plivo or Exotel): inbound webhook, outbound call API, media streaming, DTMF, call recording (object storage), webhook signature checks.
- Realtime pipeline: streaming STT → agent (Gemini) → TTS → audio out, barge-in, silence/timeouts, end-of-call detection, language switching (English/Hindi/Hinglish first). Provider choice per company (Gemini transcription/TTS if quality is acceptable, otherwise Google Cloud / Sarvam / ElevenLabs behind the same interface).
- Live signals: sentiment, intent, keyword spotting (budget, "site visit", "not interested"), escalation rules → **warm transfer to a human** with transcript summary.
- **Outbound campaigns:** call lists from user groups, calling windows by timezone, retry rules, concurrency caps, **DND/consent checks**, call outcomes (connected, voicemail, no answer, qualified, visit booked) writing back to the lead, speed-to-lead (call within 60 s of a new web/portal lead).
- Tables: `voice_agents`, `calls`, `call_events`, `call_transcripts`, `call_campaigns`, `call_campaign_targets`.
- Flow-builder steps: Voice, Switch Call To Agent, End Call, Update STT/TTS settings.

### Frontend
- `/voice/agents` (voice, accent, language, speed/pitch/tone, greeting, escalation rules, test call from the browser), `/voice/numbers`, `/voice/campaigns` (builder + live progress), `/voice/calls` (list, audio player, transcript with sentiment timeline, AI summary, outcome), `/voice/analytics`.

**Manual:** telephony account and numbers, **India DLT/TRAI registration** for outbound, recording-consent script, TTS/STT choice after a listening test.
**Done when:** a new portal lead gets an AI call in under a minute, the call is qualified, a site visit is booked and the transcript and outcome appear on the lead.

---

## P6. Data and intelligence (6-8 weeks)

*Angoor: knowledge types, KB references, user groups, tags, dashboards, task boards, CSAT/NPS, 360 view.*

### Backend
- **Knowledge types:** Documents (exists), Table (CSV/Sheets as queryable rows), **Proxy** (live query to your inventory/pricing API or Postgres view; nothing stored), Media catalogue, JSON, Links. Unified `query()` across types; **KB tester** (run questions, see retrieved chunks and match score); KB access scopes; usage stats per KB.
- **Google import:** Docs, Sheets, Drive folders as knowledge sources with re-sync.
- **User groups:** static and **dynamic** (filter rules like "budget 80L-1.2Cr AND 3BHK AND visited>0 AND not booked"), CSV import, group size trend; **Tag Manager** (colours, rules, auto-tagging from AI labels).
- **360 customer view:** unified timeline of messages, calls, visits, emails, documents, payments (later), AI summary, buyer DNA, intent score history.
- **Auto-summarise, label and sentiment** every conversation/call; intent taxonomy for real estate (price enquiry, site-visit, loan, resale, rental, complaint, broker).
- **CSAT/NPS:** automatic post-visit/post-call surveys; estimated score when the user does not answer.
- **Dashboard builder:** widgets (line, bar, donut, KPI, funnel, table) over a defined metric catalogue (leads by source/agency partner, response time, visit conversion, AI resolution rate, cost per lead, call outcomes, campaign performance); sharing and scheduled e-mail reports; AI-written weekly summary.
- **Task boards:** generic Kanban boards bound to forms (site-visit follow-ups, documentation, loan processing), assignees, due dates, comments, timeline.

### Frontend
- `/knowledge` hub (tabs per type, uploader, tester, connection counts), `/groups`, `/tags`, `/contacts/:id` 360 page, `/dashboards` (builder with drag grid), `/boards`, survey settings.

**Done when:** a manager defines a dynamic group "hot 3BHK buyers, no visit yet", launches a WhatsApp campaign to it, and sees conversion on a dashboard they built themselves.

---

## P7. Enterprise controls and developer platform (5-7 weeks)

*Angoor: policies, access logs, API keys, notifications, credits visibility, docs/changelog, integrations.*

- **Policies (ABAC):** module-level View/Add/Change/Delete plus conditions (team, territory/project, business hours, lead value), policy assignment to roles/teams/API keys, change log.
- **Access logs** (who viewed/exported what), export controls, PII masking for phone/email by role.
- **API keys** scoped by policy, expiry, rotation, usage stats; public REST API docs (OpenAPI) and webhook catalogue.
- **Notification centre** (in-app, e-mail, WhatsApp/Slack alerts) with per-user rules.
- **Usage metering (tracking only, no charging yet):** ledger of Gemini tokens, messages per channel, call minutes per company/agent/flow; usage dashboard. This is the base for P8 credits.
- **Integrations:** LeadSquared and Zoho CRM (real, bidirectional lead sync), Slack, Freshdesk (optional), Airtable (optional), Metabase embed.
- **Docs site and changelog** (public), status page.
- Compliance: DPDP consent records, data export/delete requests, retention settings per company.

**Frontend:** `/policies`, `/access-logs`, `/api-keys`, `/usage`, `/notifications`, `/integrations` redesign, `/compliance`.

---

## P8. Payments, billing and pricing (last; 3-5 weeks)

Deferred as requested. Scope when we get there:
- Decide the pricing model (plan tiers vs usage/credits vs MAEU) and align the plan table (`packages/shared/src/constants/plans.ts`, currently differs from the spec).
- Real Stripe or Razorpay Checkout Session, subscription lifecycle, invoices/GST, dunning, cancel/upgrade/downgrade, webhook handling (signature work is already done).
- Credits/top-ups built on the P7 usage ledger; per-channel pass-through pricing.
- **Booking token payments in chat/WhatsApp** (payment link action, receipt, refund rules) and RERA-compliant receipts.
- Go-live hardening: load tests, backups, monitoring, security review, pen-test fixes.

---

## Cross-cutting (every phase)
- **Testing:** unit + integration against a separate test DB; Playwright smoke tests for new screens; Gemini calls mocked in CI with a small recorded fixture set plus a nightly live eval (existing `evals/` suite extended with the flow/agent cases).
- **Security:** vault for all secrets, SSRF guard on every outbound URL, per-tenant isolation tests for each new table, rate limits per new endpoint, audit logging.
- **Observability:** `llm_calls`, `flow_step_runs`, error tracking (Sentry), structured logs.
- **Docs:** a short admin guide page per feature as it ships.

## Manual inputs needed, by phase
| Phase | You provide |
|---|---|
| P0 | Gemini billing enabled; approve migration 0018 |
| P1-P3 | Sample conversations, lead attributes, business rules, design preferences |
| P4 | Meta Business verification and App Review; WhatsApp number and templates; Google OAuth consent screen; portal API/lead-push details; domain for the widget |
| P5 | Plivo/Exotel account and numbers; DLT/TRAI registration; consent script; voice listening test |
| P6 | Google Cloud OAuth (Docs/Sheets/Drive); access to your inventory/pricing source for the Proxy KB |
| P7 | LeadSquared/Zoho/Slack credentials; policy requirements |
| P8 | Stripe or Razorpay live account, pricing decision, GST details |
| All | Production Postgres + separate test DB, Redis, object storage (S3/R2), domain/TLS, Sentry |

## Decisions to confirm
1. Sequence: P0 → P1 → P2 → P3 as the core, then P4 (channels) before P5 (voice)? Or voice earlier because speed-to-lead calling is your biggest revenue lever?
2. Instagram first, or WhatsApp + email + portal lead ingestion first (no Meta review wait)?
3. Do you want customers to **build** flows themselves, or only edit templates we ship (simpler UI, much lower support load)?
4. Voice languages at launch (English only, or Hindi/Hinglish too)?
5. First design-partner customer to validate each phase against?
