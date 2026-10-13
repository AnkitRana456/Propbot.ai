# PropBot Pro — System Architecture & Topology

## 1. Overview & System Topology

**PropBot Pro** is a multi-tenant, chat-first real estate conversion platform engineered as a high-performance TypeScript monorepo. It couples AI-driven buyer qualification with a lightweight CRM, real-time lead delivery, WhatsApp automation, and smart shortlist rooms.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +---------------------------+  +--------------------------+  +-----------------+ |
|  |     Browser Dashboard     |  |       Embed Widget       |  |    WhatsApp     | |
|  | (React 18 + Vite + TSX)   |  | (Vanilla TS, Shadow DOM) |  |   (Cloud API)   | |
|  +-------------+-------------+  +------------+-------------+  +--------+--------+ |
+----------------|-----------------------------|-------------------------|----------+
                 |                             |                         |
                 v                             v                         v
+-----------------------------------------------------------------------------------+
|                                   GATEWAY LAYER                                   |
|  - Rate Limiting (Memory / Redis token bucket)                                    |
|  - Helmet & CORS policy enforcement (Domain allowlists per chatbot)               |
|  - Request correlation ID injection (X-Request-Id)                                |
|  - Tenant Guard Middleware (JWT parsing -> company_id context)                    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                          CORE MODULAR MONOLITH (apps/api)                         |
|  +------------------------+  +------------------------+  +----------------------+ |
|  | Auth & Tenancy Service |  | Chatbots & RAG Engine  |  | CRM & Lead Scoring   | |
|  +------------------------+  +------------------------+  +----------------------+ |
|  +------------------------+  +------------------------+  +----------------------+ |
|  | Guarded Actions (T0-T3)|  | Outbox Dispatcher      |  | Webhooks & Delivery  | |
|  +------------------------+  +------------------------+  +----------------------+ |
+-----------------------------------------------------------------------------------+
                 |                                             |
                 v                                             v
+----------------------------------+         +--------------------------------------+
|        POSTGRESQL 16 + PGVECTOR  |         |            REDIS & BULLMQ            |
|  - Multi-Tenant RLS policies     |         |  - Background event worker queue     |
|  - Domain Events (Outbox table)  |         |  - Delayed campaign schedules        |
|  - Vector Embeddings (HNSW index)|         |  - WhatsApp webhook dispatch         |
|  - Audit Log & Guarded Actions   |         |  - PubSub for cluster coordination   |
+----------------------------------+         +--------------------------------------+
```

---

## 2. Multi-Tenancy & Data Isolation

Data isolation is guaranteed through a defense-in-depth model combining application-level guards and PostgreSQL Row-Level Security (RLS).

### Application-Level Isolation
- Every tenant table carries `company_id`.
- The `tenantGuard` middleware extracts the tenant claim from verified JWTs and attaches it to `req.tenant`.
- All repository queries explicitly filter on `eq(table.companyId, req.tenant.companyId)`.

### Database-Level Isolation (PostgreSQL RLS)
- PostgreSQL RLS policies are enabled across all tenant-scoped tables (`chatbots`, `leads`, `conversations`, `messages`, `appointments`, `projects`, `units`, `domain_events`).
- Within transactional boundaries, the session variable is set:
  ```sql
  SET LOCAL app.company_id = 'tenant-uuid';
  ```
- RLS policy definition ensures queries cannot access foreign rows even if application code omits filtering:
  ```sql
  CREATE POLICY tenant_isolation_policy ON leads
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
  ```

---

## 3. Storage & Persistence Layer

- **Database**: PostgreSQL 16 managed via **Drizzle ORM** with declarative TypeScript schemas and strict migrations (`drizzle-kit`).
- **Vector Search**: PostgreSQL `pgvector` extension utilizing HNSW indexes (`vector_cosine_ops`) for document chunk retrieval.
- **Transactions**: Multi-step operations (e.g., appointment slot reservation, lead credit deduction, domain event publishing) execute inside atomic transactions (`db.transaction`).
- **Cache & Async Queue**: Redis 7 running BullMQ workers for background jobs (delayed lead re-engagement, webhook delivery with exponential backoff, document embedding generation).

---

## 4. Transactional Outbox Event Architecture

To decouple state changes from external side-effects (webhooks, notifications, workflows, analytics rollups), PropBot Pro enforces a **Transactional Outbox Pattern**:

1. State mutation (e.g., `lead.created`, `lead.qualified`, `appointment.booked`) writes to business tables and appends to `domain_events` in the **same database transaction**.
2. A dedicated BullMQ background worker polls/listens to `domain_events` where `processed_at IS NULL`.
3. Consumers process events asynchronously:
   - **Webhook Outbox Consumer**: Dispatches signed HTTP POST payloads to configured endpoints with retry backoffs.
   - **Analytics Consumer**: Updates daily rollups in real-time.
   - **Notification Consumer**: Sends WhatsApp/Email lead alerts to assigned real estate sales agents.
   - **Workflow Engine**: Evaluates triggered visual automations.

---

## 5. AI Guarded Action Framework

All actions performed by AI agents undergo permission tier validation via `guarded-actions.service.ts`:

| Tier | Classification | Behavior | Examples |
|---|---|---|---|
| **T0** | Read-Only | Auto-executed immediately | Search inventory, fetch project brochure, calculate EMI estimate |
| **T1** | Reversible / Informational | Auto-executed with audit log | Tag lead, update buyer preferences, log customer note |
| **T2** | Business Impact | Placed in approval queue (`held`) | Schedule site visit, assign agent, update buyer budget |
| **T3** | High-Risk / Financial | **Hard Blocked** | Grant price discount, modify payment plan, issue legal guarantee |

### Per-Company Kill Switch
Each tenant holds an emergency kill switch (`aiKillSwitchActive`). When active, all autonomous tool calls are immediately halted, and the chatbot safely degrades to human-handoff mode.

---

## 6. Privacy & PII Sanitization

- **PII Scrubbing**: Before LLM traces are persisted, regex sanitizers mask telephone numbers, email addresses, and payment card numbers.
- **Zero-Dependency Widget Sanitizer**: Renders bot responses inside a browser Shadow DOM with DOMPurify-grade XSS filtering, blocking script injection, inline event attributes (`onload`, `onerror`), and `javascript:` URIs.
- **DPDP / GDPR Compliance**: Opt-in visitor consent banners, right-to-be-forgotten deletion cascades, and portable lead data export endpoints.
