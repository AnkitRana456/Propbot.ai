# PropBot Pro — Agency Pilot Onboarding & Go-Live Checklist

Use this operational checklist when onboarding a real-world real estate agency, developer, or brokerage for an initial pilot or production launch.

---

## Phase 1: Workspace & Tenant Provisioning
- [ ] Create tenant company workspace in Super Admin portal.
- [ ] Set company slug, corporate timezone, and local currency (e.g. `INR (₹)`, `USD ($)`).
- [ ] Invite initial Company Administrator and Sales Managers.
- [ ] Verify Row-Level Security (RLS) isolation for tenant.
- [ ] Configure allowed website domains in **Settings -> Security**.

---

## Phase 2: Inventory & Knowledge Base Ingestion
- [ ] Upload official project brochures, floor plans, and amenity decks in PDF format.
- [ ] Verify pgvector chunk indexing and embedding generation (`status: READY`).
- [ ] Ingest unit inventory CSV (Unit numbers, BHK, Carpet Area, Price, Facing, Floor).
- [ ] Enter official developer legal name and **RERA Registration Numbers**.
- [ ] Conduct internal RAG QA: Ask 10 complex inventory queries to confirm zero hallucinations and accurate pricing.

---

## Phase 3: Playbooks & Lead Qualification
- [ ] Configure chatbot identity (Avatar, Assistant Name, Primary Color `#2563eb`).
- [ ] Set greeting message tailored to active marketing campaign.
- [ ] Define budget qualification brackets (e.g., `< ₹1 Cr`, `₹1 – 1.5 Cr`, `> ₹1.5 Cr`).
- [ ] Enable appointment booking integration with sales office calendar.
- [ ] Review Guarded Action tiers (confirm T2 approvals enabled, T3 blocked).

---

## Phase 4: Channels & Embed Integration
- [ ] **Website Widget**:
  - [ ] Embed `<script>` tag on client website or staging environment.
  - [ ] Verify Shadow DOM rendering across desktop and mobile browsers.
  - [ ] Test domain whitelisting (ensure CORS blocks unauthorized domains).
  - [ ] Confirm visitor consent banner displays (DPDP / GDPR compliant).
- [ ] **WhatsApp Cloud API**:
  - [ ] Connect Meta Business WABA ID, Phone Number ID, and Permanent Token.
  - [ ] Verify inbound webhook handshake (`api/whatsapp/webhook`).
  - [ ] Submit and approve Meta HSM notification templates.
  - [ ] Conduct two-way mobile test chat.

---

## Phase 5: CRM & Agent Notification Setup
- [ ] Invite on-duty sales agents and assign project specialties.
- [ ] Configure lead routing rules (Round-Robin or Project-Based).
- [ ] Set up instant WhatsApp / Email alerts for hot leads (Intent Score >= 70).
- [ ] Connect outbound webhook endpoints to agency CRM (Salesforce / LeadSquared / HubSpot).
- [ ] Send test webhook event and verify HMAC signature validation.

---

## Phase 6: Safety & Compliance Sign-Off
- [ ] Test the **Emergency AI Kill Switch**: Verify bot reverts immediately to human callback mode.
- [ ] Verify PII sanitization: Check that raw phone numbers and emails are masked in LLM trace logs.
- [ ] Confirm marketing brochures automatically include required RERA disclaimer.
- [ ] Confirm that all AI promises regarding discounts or delivery dates require manager sign-off.

---

## Phase 7: Pilot QA Simulation
- [ ] Simulate **Cold Visitor Flow**: Casual browsing, low engagement -> Intent Score < 40.
- [ ] Simulate **Hot Buyer Flow**: Inquires on 3 BHK, budget ₹1.5 Cr, requests site visit for Saturday -> Intent Score 85+.
- [ ] Confirm instant agent alert fired within 5 seconds.
- [ ] Verify pre-call **Agent Copilot Brief** generated with talking points.
- [ ] Generate and open **Smart Shortlist Room** link to confirm unit comparison UI.
- [ ] Verify booked appointment appears on agency calendar.

---

## Phase 8: Go-Live & Pilot Monitoring
- [ ] Deploy widget script to production domain.
- [ ] Check API liveness (`/healthz`) and database readiness (`/healthz/ready`).
- [ ] Monitor real-time logs for correlation IDs (`X-Request-Id`).
- [ ] Review end-of-day analytics rollups:
  - Unique visitors
  - Leads captured
  - Average Intent Score
  - Site visits booked
- [ ] Schedule weekly review with agency sales director.
