# PropBot Pro — Version & Release Changelog

All notable changes across development phases are documented in this file.

---

## [1.0.0-rc1] - Phase 14: Hardening, Security & Production Readiness (Current)

### Added
- **AI Guarded Actions Framework**: Implemented four-tier permission model (T0 Read, T1 Reversible, T2 Approval-Held, T3 Blocked) with tenant-level Kill Switch (`guarded-actions.service.ts`).
- **Interactive Documentation**: OpenAPI 3.0 specification viewer mounted at `/api/docs`.
- **E2E Golden Path Integration Test Suite**: Complete end-to-end lifecycle verification covering signup, bot configuration, RAG training, visitor chat, lead capture, assignment, appointment booking, outbox events, and analytics rollups (`tests/e2e/golden-path.test.ts`).
- **Load Test Harness & Report**: High-concurrency load testing validating 200 concurrent visitor chat streams with 0% error rate and sub-millisecond median latency (`tests/load/chat-load-test.ts`, `LOAD_TEST_REPORT.md`).
- **Production DevOps**: Production Docker Compose topology (`docker-compose.prod.yml`), Render Blueprint (`render.yaml`), and GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- **Realistic Demo Seeding**: `pnpm db:seed:demo` script populating Prestige Living workspace with 2 projects, 3 units, 4 team users, 200 leads with Buyer DNA and intent scores, and 30-day analytics.
- **Frontend Compliance & Support**: Built DPDP/GDPR compliant Consent Banner and complete Help & Support Center (`apps/web/src/pages/HelpSupportPage.tsx`).
- **XSS & PII Defenses**: Zero-dependency HTML sanitizer for Shadow DOM widget rendering and phone/email/card sanitization on LLM traces.

### Changed
- Rate limiting upgraded to token-bucket rate limiter with `X-RateLimit-*` and `Retry-After` headers.
- Healthcheck expanded with `/healthz/ready` database connectivity verification.
- Pinned `tinypool >= 2.1.2` and `vite ^5.4.14` in pnpm overrides eliminating 100% of high/critical vulnerabilities.

---

## [0.13.0] - Phase 13: Agent Copilot & Evaluation Benchmarks
- Added Agent Copilot pre-call briefs, talking points, and objection predictions.
- Implemented automated re-engagement engine for cold leads.
- Added comprehensive AI evaluation benchmark runner with accuracy metrics (`apps/api/evals/run-eval.ts`).

## [0.12.0] - Phase 12: Visual Workflow Engine
- Implemented node-based workflow builder (React Flow in frontend, BullMQ execution engine in backend).
- Created trigger-condition-action pipelines for automated follow-ups.

## [0.11.0] - Phase 11: Multilingual Real Estate Engine
- Integrated 10-language real-time translation for Indian and international buyers (`en`, `hi`, `mr`, `gu`, `ta`, `te`, `kn`, `bn`, `ml`, `es`).

## [0.10.0] - Phase 10: Conversion Analytics & Reporting
- Built daily analytics rollups for visitors, leads, visit conversions, and pipeline volume.
- Interactive conversion funnel visualizations.

## [0.9.0] - Phase 9: Webhooks & Outbox System
- Transactional outbox architecture (`domain_events` table) written in same transaction as state mutations.
- HMAC-signed outbound webhook delivery with BullMQ exponential retry queue.

## [0.8.0] - Phase 8: WhatsApp Cloud API Integration
- Direct Meta WhatsApp Cloud API webhooks and outbound messaging.
- Pre-approved HSM notification templates for site visits and hot lead alerts.

## [0.7.0] - Phase 7: Appointments & Site Visit Scheduling
- Interactive appointment booking calendar with agent availability and slot deduplication.
- WhatsApp & email visit confirmations with directions.

## [0.6.0] - Phase 6: Smart Shortlist Room
- Client-facing interactive Shortlist Room for comparing shortlisted units.
- Real-time tracking of buyer favorites and floor plan views.

## [0.5.0] - Phase 5: CRM Pipeline & Lead Management
- Real-time CRM Kanban board with drag-and-drop pipeline stages.
- Lead detail views with Buyer DNA summaries and activity timelines.

## [0.4.0] - Phase 4: Buyer DNA & Live Intent Scoring
- Real-time intent scoring engine (0-100: Cold, Warm, Hot).
- Structured Buyer DNA parameter extraction (budget, BHK, timeline, investment/end-use).

## [0.3.0] - Phase 3: Public Embed Widget
- Vanilla TypeScript framework-agnostic embed widget with Shadow DOM style isolation.
- Streaming SSE chat responses with markdown and unit card rendering.

## [0.2.0] - Phase 2: Chatbot Studio & Knowledge RAG
- Chatbot configuration wizard (branding, personality, qualification playbooks).
- PostgreSQL `pgvector` HNSW index for document chunk embedding and cosine similarity retrieval.

## [0.1.0] - Phase 1: Foundation & Multi-Tenancy
- Monorepo setup with pnpm workspaces, TypeScript strict mode, and Drizzle ORM.
- JWT authentication and PostgreSQL Row-Level Security (RLS) tenant isolation.
