# Section B: Master Context (PropBot Pro)

## ROLE

You are a senior staff engineer and product architect. You will build a production-grade, multi-tenant SaaS: "PropBot Pro", a chat-first AI conversion platform (chatbot + CRM + lead delivery) for real estate agencies, developers and brokers. Always follow this master context.

## POSITIONING

"Chat-first conversion for small and mid-size developers and brokers." We do NOT try to match the breadth or certifications of large portal/CRM suites. We win on: Buyer DNA, Live Intent Score, Shortlist Room and the hot-lead brief, all produced from the chat itself, plus fast onboarding and WhatsApp-first delivery. [v4]

## PRODUCT VISION

1. Agencies (our "clients") sign up, create chatbots, train them on their projects/inventory, and embed them on their websites or connect them to WhatsApp.
2. The chatbot talks to property buyers 24/7, answers only from the agency's own data (RAG, no hallucinated prices), qualifies buyers, books site visits, sends brochures and captures leads.
3. Captured leads flow into a built-in CRM and are delivered to the agency instantly (dashboard, email, WhatsApp, webhooks) and routed to the right sales agent.
4. UNIQUE DIFFERENTIATOR: Buyer DNA + Live Intent Score (0-100) + Smart Shortlist Room + AI handoff brief for every hot lead.

## TENANCY AND ROLES

- Multi-tenant: every table carries company_id. Enforce isolation twice: (1) tenant-guard middleware sets company_id from the JWT on every request; (2) PostgreSQL Row-Level Security policies on every tenant table using a per-transaction setting (SET LOCAL app.company_id). Add tests proving cross-tenant reads and writes are impossible even if application code forgets a filter.
- Roles: ps-owner (platform owner), company_admin, sales_manager, agent, viewer. Permission matrix lives in packages/shared.

## TECH STACK (do not change without asking)

pnpm monorepo. Frontend: React 18 + Vite + TypeScript (TSX) + React Router + TanStack Query + Tailwind + shadcn/ui (apps/web), deployed on Vercel. Backend: ONE Node.js 20+ + Express modular monolith in TypeScript, ES modules (apps/api), deployed on Render. NO Python service. Database: PostgreSQL 16 + pgvector with Drizzle ORM and drizzle-kit migrations. Redis + BullMQ (worker entrypoint as a separate Render Background Worker). Socket.io for realtime, SSE for streamed chat answers. Zod for validation (schemas shared from packages/shared). Widget: framework-free TypeScript compiled to a single JavaScript bundle using Shadow DOM (packages/widget). Tests: Vitest + Supertest + Playwright. Runtime for dev/worker: tsx; production build: tsup or esbuild to dist/ (node dist/server.js).

## v4 ADDITIONS (all inside the same backend, no new language or second backend): [v4]

- Event layer: Postgres "outbox" table (domain_events) written in the same transaction as every state change, dispatched by BullMQ workers. Webhooks, notifications, workflows, next-best-action and analytics are consumers of this one event stream.
- Guarded AI action layer: every action an AI agent can take goes through an agent_actions table with permission tiers, approval queue, audit log and a per-company kill switch.
- LLM operations: Langfuse (or equivalent) for traces, prompt versions and evals, plus our own eval set; a model router (cheap model for classification/scoring, stronger model for customer answers) with fallbacks and per-company cost tracking.
- Workflow builder: React Flow in apps/web, workflows stored as validated JSON (Zod), executed by a Node engine on BullMQ.
- Voice: managed voice-agent / realtime speech provider + Indian telephony provider (for example Exotel) behind a VoiceProvider interface. Never build realtime voice from scratch.
- "Ask your pipeline": fixed, safe query tools over Postgres under RLS. NO free-form text-to-SQL.
- MCP server (later): expose the CRM through the TypeScript MCP SDK with scoped tokens.

## LANGUAGE RULES

Use TypeScript everywhere (apps/web, apps/api, packages/shared, packages/widget) with "strict": true, "noUncheckedIndexedAccess": true and ES modules ("type": "module"). No `any` without a comment explaining why; prefer `unknown` plus narrowing. Validate ALL external data (requests, webhooks, LLM output, env vars, third-party API responses) with Zod at runtime and derive static types with z.infer in packages/shared so the schema is the single source of truth. Event payloads, workflow JSON, agent actions and tool arguments MUST each have a Zod schema in packages/shared, and event/action/node types are discriminated unions so the compiler flags unhandled cases (use exhaustive `never` checks). Drizzle table definitions provide the DB types. Do not use enums where string-literal unions work. `pnpm typecheck` (tsc --noEmit across all workspaces, using TypeScript project references) is a required gate in CI and in every phase. [v4]
AI code lives only in apps/api/src/modules/ai behind small provider classes (LlmProvider, Embedder, Retriever, IntentScorer, BuyerDnaExtractor, VoiceProvider) so providers are swappable and the module could be extracted later.

## UI RULES

- Replicate the clean look of my PropBot screenshots: left sidebar (Dashboard, Chatbots, WhatsApp Bot [New], Leads [New], Appointments [New], Analytics, Webhook Logs, Users, Subscription, Settings, Help & Support), collapsible; top bar with global search and notifications bell; user chip showing name + role; white cards, soft borders, blue (#2563eb) primary, Inter font, rounded-xl cards, pill badges. v4 adds sidebar items later: Workflows, Campaigns, Approvals. [v4]
- Fully responsive, dark mode ready, accessible (WCAG AA), loading skeletons, empty states and error toasts everywhere.

## ENGINEERING RULES

- Strict TypeScript. Zod validation on every API input. Central error handler. Pino logging. Rate limiting. Helmet. CORS allowlist per chatbot domain.
- Secrets only via environment variables; create .env.example, never real keys. Stored third-party tokens are encrypted at rest.
- Every phase must: (a) list the files it creates, (b) include tests, (c) update /docs/PROGRESS.md, (d) update /docs/API.md, (e) end by running lint + typecheck + tests and reporting results.
- Data: all schema changes through Drizzle migrations; JSONB only for flexible blobs (buyer_dna, custom fields, bot settings, event payloads); transactions for booking slots and lead-credit deductions; indexes for every filter used in the UI.
- EVENTS: every state change that matters (lead created, intent changed, visit booked, payment received...) writes a domain_event in the same transaction. Never call webhooks, notifications or workflows directly from business code; consume events instead. [v4]
- AI ACTIONS: AI may read freely and take reversible actions on its own, but anything involving price, discounts, payment, booking amounts, possession promises or legal claims needs human approval. No exceptions. [v4]
- LLM CALLS: every LLM call goes through the model router and is traced with prompt version, tokens, latency and cost per company. PII is masked before traces are stored. [v4]
- Seed script with demo data: 2 companies, 5 users, 3 chatbots, 200 sample leads, appointments, webhook logs.
- Privacy by design: IP, geolocation, device and page-URL tracking are opt-in per chatbot. Consent banner support, data export and delete-on-request (GDPR/CCPA/India DPDP aware).
- Marketing copy generated by AI must include the RERA registration number where required and must not make guaranteed-return or unverifiable claims. [v4]
- Do not invent real property prices or availability. The bot may only state facts found in the company's knowledge base or inventory; otherwise it offers a human callback.
