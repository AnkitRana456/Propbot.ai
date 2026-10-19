# PropBot Pro — Administrator Operations Guide

This guide is designed for **Platform Super Admins** and **Agency/Company Administrators** managing tenants, users, chatbots, AI controls, and integrations across PropBot Pro.

---

## 1. Roles & Permissions Hierarchy

PropBot Pro enforces strict role-based access control (RBAC):

| Role | Scope | Key Capabilities |
|---|---|---|
| `ps-owner` | Platform Wide | Tenant provisioning, billing tiers, global feature flags, cross-tenant system metrics |
| `company_admin` | Company | Chatbot creation, knowledge ingestion, team invites, AI kill switch, integration keys, billing |
| `sales_manager` | Company | Lead assignment rules, CRM pipeline stages, AI action approvals (T2), analytics reports |
| `agent` | Assigned Leads | View assigned leads, chat live with buyers, update stages, manage calendar site visits |
| `viewer` | Read Only | View reports and lead summaries without export or mutation privileges |

---

## 2. Company Onboarding & Provisioning

### Step 1: Create Agency Workspace
1. Navigate to **Super Admin -> Companies -> Create Company**.
2. Specify Company Name, Slug, Default Currency (`INR`, `USD`, `AED`), and Timezone.
3. Assign Subscription Tier (`Starter`, `Growth`, `Enterprise`) and monthly lead credit quota.

### Step 2: Configure Allowed Domains & Security
1. Navigate to **Settings -> Security & Compliance**.
2. Add all production and staging domains hosting the widget (e.g., `https://luxuryrealestate.com`). Requests originating from unapproved domains are rejected by CORS.
3. Set visitor cookie consent policy (DPDP / GDPR mode).

---

## 3. Chatbot Creation & Knowledge Management

### 1. Ingesting Property Data
To ensure zero AI hallucinations, the chatbot only answers from verified knowledge:
- **Project Brochures (PDF)**: Upload floor plans, master plans, and amenity brochures. The RAG pipeline automatically chunks, embeds, and indexes text using pgvector.
- **Unit Inventory**: Import CSV/Excel sheets with unit numbers, BHK configurations, carpet areas, base prices, facing, and availability.
- **RERA Compliance**: Enter developer legal entity and RERA registration numbers. These are automatically attached to property brochures and answers.

### 2. Conversational Playbooks
Configure structured qualification steps:
- Identity discovery (Name, Phone number, Email)
- Buyer DNA extraction (Budget range, BHK preference, Investment vs. End-use, Timeline)
- Automated site visit booking integration with Google Calendar / Office365

---

## 4. AI Guardrails & Human-in-the-Loop Operations

PropBot Pro safeguards agency reputation with strict action tiers:

### Guarded Action Approvals (T2 Actions)
When an AI assistant determines a high-value action is necessary (e.g. scheduling a priority developer site visit or re-assigning a hot lead), it creates a record in the **Approval Queue**:
1. Go to **AI Control -> Approvals**.
2. Review the pending action, buyer intent score, and conversation snippet.
3. Click **Approve** (executes action immediately) or **Reject** with feedback.

### Emergency AI Kill Switch
In the event of unexpected bot behavior, system maintenance, or live marketing campaigns:
1. Navigate to **Chatbots -> [Select Bot] -> Settings**.
2. Toggle **AI Emergency Kill Switch** to `ON`.
3. When activated:
   - All automated generative tools are suspended.
   - The widget switches to static FAQ and Human Callback capture mode.
   - Pending T2 actions are frozen.

---

## 5. Lead Distribution & CRM Routing

Set up automated lead assignment rules under **CRM -> Routing Rules**:
- **Round-Robin**: Distribute hot leads evenly across on-duty agents.
- **Project-Based**: Route leads inquiring about specific luxury developments to dedicated specialist agents.
- **Intent-Based Prioritization**: Immediately alert top closers via WhatsApp when Intent Score >= 75.

---

## 6. Integration Management

- **Outbound Webhooks**: Configure custom HTTPS endpoints receiving signed JSON payloads for `lead.created`, `lead.qualified`, and `appointment.booked`.
- **CRM Sync**: Native connectors for LeadSquared, Salesforce, and HubSpot with field-mapping wizards.
- **WhatsApp Cloud API**: Connect Meta Business accounts for conversational bot automation and agent lead alerts.
