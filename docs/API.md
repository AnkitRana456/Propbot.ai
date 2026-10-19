# PropBot Pro — API Reference

## Health & Monitoring

### `GET /healthz`

Health check endpoint reporting API process liveness, uptime, memory, and environment.

#### Request

```http
GET /healthz HTTP/1.1
Host: localhost:3000
```

#### Response (`200 OK`)

```json
{
  "status": "ok",
  "timestamp": "2026-10-02T15:00:00.000Z",
  "uptime": 12.34,
  "service": "propbot-api",
  "version": "1.0.0",
  "environment": "development",
  "memory": {
    "rssMb": 42.1,
    "heapUsedMb": 25.3
  }
}
```

---

## Authentication & Authorization (`/api/auth`)

### `POST /api/auth/register`

Registers a new company, initializes default AI settings, and provisions the first `company_admin`.

#### Request

```json
{
  "companyName": "Prestige Realty",
  "companySlug": "prestige-realty",
  "adminName": "John Doe",
  "adminEmail": "john@prestige.com",
  "password": "Password123!"
}
```

#### Response (`201 Created`)

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@prestige.com",
      "role": "company_admin",
      "status": "active"
    },
    "company": {
      "id": "uuid",
      "name": "Prestige Realty",
      "slug": "prestige-realty",
      "plan": "trial"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "64_char_hex_token...",
      "expiresIn": 900
    }
  }
}
```

### `POST /api/auth/login`

Authenticates a user and returns an Access Token + Refresh Token pair.

#### Request

```json
{
  "email": "john@prestige.com",
  "password": "Password123!",
  "companySlug": "prestige-realty"
}
```

#### Response (`200 OK`)

Returns user details, company details, and tokens. Returns `403 ACCOUNT_PENDING_APPROVAL` if the user is pending admin approval.

### `POST /api/auth/refresh`

Rotates a Refresh Token and issues a new Access Token. Invalidates compromised token families upon reuse detection.

#### Request

```json
{
  "refreshToken": "64_char_hex_token..."
}
```

### `POST /api/auth/logout`

Revokes an active refresh token or all user sessions (`allDevices: true`). Requires Bearer authentication.

### `POST /api/auth/forgot-password`

Generates a secure password reset token and dispatches it via email stub.

### `POST /api/auth/reset-password`

Validates a reset token, updates password, and revokes all active sessions.

### `GET /api/auth/me`

Returns the authenticated user's profile and active tenant context (`req.tenant`). Protected by `authenticate` + `tenantGuard`.

### `GET /api/auth/users/pending`

Lists all users with `pending_approval` status in the tenant. Protected by `requireRole('company_admin', 'ps-owner')`.

### `POST /api/auth/users/:id/approve`

Approves a pending user within the company, setting status to `active`.

### `POST /api/auth/users/:id/reject`

Rejects/disables a user within the company, setting status to `disabled`.

### `GET /api/auth/google` & `GET /api/auth/google/callback`

Optional Google OAuth endpoints. Returns `501 OAUTH_NOT_CONFIGURED` if credentials are not configured in environment.

---

## Dashboard (`/api/dashboard`)

All dashboard endpoints require `Authorization: Bearer <accessToken>` and are secured with `tenantGuard`. Queries automatically isolate data using the authenticated tenant's `companyId`.

### `GET /api/dashboard/stats`

Retrieves aggregated top-line metrics for the company:

- `totalLeads`: Total non-deleted leads
- `newLeads`: Leads in `new` status
- `qualifiedLeads`: Leads in `qualified` status
- `convertedLeads`: Leads in `booked` or `converted` status
- `activeChatbots`: Active non-deleted AI concierges
- `todayVisits`: Site visits scheduled for today (non-cancelled)

#### Response (`200 OK`)

```json
{
  "data": {
    "totalLeads": 128,
    "newLeads": 24,
    "qualifiedLeads": 46,
    "convertedLeads": 12,
    "activeChatbots": 3,
    "todayVisits": 5
  }
}
```

### `GET /api/dashboard/recent-leads`

Retrieves the most recent inbound leads with live intent classification and contact details.

#### Query Parameters

- `limit` (optional, default: 5): Max number of leads to return

#### Response (`200 OK`)

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Aarav Malhotra",
      "phone": "+91 98201 23456",
      "email": "aarav.m@example.com",
      "status": "qualified",
      "priority": "high",
      "intentScore": 88,
      "intentLabel": "hot",
      "source": "Web AI Chatbot",
      "createdAt": "2026-10-02T14:45:00.000Z"
    }
  ]
}
```

### `GET /api/dashboard/notifications`

Retrieves unread notifications and alerts for the authenticated user and company.

#### Response (`200 OK`)

```json
{
  "data": {
    "unreadCount": 1,
    "items": [
      {
        "id": "uuid",
        "type": "lead_hot",
        "title": "🔥 Hot Lead Alert",
        "message": "Priya Sundaram scheduled a site visit for Prestige White Meadows (Score: 92)",
        "isRead": false,
        "createdAt": "2026-10-02T14:50:00.000Z"
      }
    ]
  }
}
```

---

## Chatbots API (`/api/chatbots`)

All `/api/chatbots` endpoints require `Authorization: Bearer <accessToken>` and active tenant context. Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require the `manage_chatbots` permission (`company_admin`, `sales_manager`).

### `GET /api/chatbots`

Lists all chatbots belonging to the authenticated company.

- **Query Params:**
  - `status` (`draft` | `active` | `paused`)
  - `type` (`web` | `whatsapp`)
  - `search` (name substring)

### `GET /api/chatbots/:id`

Retrieves a single chatbot by ID with tenant isolation verification.

### `POST /api/chatbots`

Creates a new chatbot, generates a cryptographically random public key (`pb_live_...`), and saves defaults.

- **Request Body:**

```json
{
  "name": "Prestige Sanctuary Luxury Concierge",
  "type": "web",
  "status": "draft",
  "allowedDomains": ["https://prestigegroup.com"],
  "config": {
    "description": "Pre-sales AI concierge for luxury villas",
    "appearance": {
      "primaryColor": "#059669",
      "position": "bottom-right",
      "botName": "Property Advisor AI"
    },
    "behavior": {
      "tone": "luxury",
      "greetingMessage": "Welcome! How can I help you find your dream villa today?"
    },
    "leadCapture": {
      "enabled": true,
      "triggerAfterMessages": 2
    }
  }
}
```

### `PUT /api/chatbots/:id`

Updates chatbot properties and performs deep merge on nested configuration blocks.

### `PATCH /api/chatbots/:id/status`

Toggles status between `active`, `paused`, and `draft`.

- **Request Body:**

```json
{
  "status": "active"
}
```

### `POST /api/chatbots/:id/duplicate`

Clones an existing chatbot into a new draft with a fresh public key and prefix `"Copy of "`.

### `POST /api/chatbots/:id/rotate-key`

Generates a new public key for the chatbot, immediately invalidating the previous token.

- **Response (`200 OK`):**

```json
{
  "data": {
    "publicKey": "pb_live_79a29e840d216bc5b762512f..."
  }
}
```

### `DELETE /api/chatbots/:id`

Soft-deletes the chatbot while preserving historic leads and conversation records in the CRM.

---

## Knowledge Base & RAG Engine (`/api/chatbots/:id/knowledge`)

All knowledge endpoints enforce authentication, tenant isolation (`tenantGuard`), and RBAC permission checks (`train_chatbots` for mutations).

### `GET /api/chatbots/:id/knowledge/sources`

Lists all ground truth knowledge sources attached to the chatbot.

#### Response (`200 OK`)

```json
{
  "data": {
    "sources": [
      {
        "id": "uuid",
        "companyId": "uuid",
        "chatbotId": "uuid",
        "title": "Master Brochure & Specifications 2026",
        "type": "file",
        "status": "ready",
        "chunkCount": 18,
        "byteSize": 1048576,
        "errorMessage": null,
        "lastTrainedAt": "2026-10-03T12:00:00.000Z",
        "createdAt": "2026-10-03T12:00:00.000Z",
        "updatedAt": "2026-10-03T12:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

### `POST /api/chatbots/:id/knowledge/sources/text`

Creates and queues a raw text / FAQ knowledge source for chunking and vector embedding.

#### Request

```json
{
  "title": "Amenities & Operational Guidelines",
  "content": "The central clubhouse spans 45,000 sq ft featuring a heated indoor swimming pool, gym, squash courts, and EV charging points."
}
```

### `POST /api/chatbots/:id/knowledge/sources/qa`

Creates structured Question & Answer pairs that provide precise contextual answers.

#### Request

```json
{
  "title": "Pricing & Payment Milestones FAQ",
  "pairs": [
    {
      "question": "What is the booking token amount?",
      "answer": "The booking token is ₹10 Lakhs for 3BHK villas and ₹20 Lakhs for 4BHK presidential villas."
    }
  ]
}
```

### `POST /api/chatbots/:id/knowledge/sources/crawl`

Triggers a recursive same-domain website crawl to ingest developer website pages.

#### Request

```json
{
  "title": "Official Developer Microsite",
  "url": "https://prestigegroup.com/projects/sanctuary",
  "config": {
    "maxDepth": 2,
    "maxPages": 20,
    "sameDomainOnly": true,
    "respectRobotsTxt": true
  }
}
```

### `POST /api/chatbots/:id/knowledge/sources/upload`

Uploads a document file (`multipart/form-data`) supporting PDF, DOCX, TXT, CSV, and XLSX.

#### Form Fields
- `title` (string): Human-readable title
- `file` (binary): Document file (up to 25 MB)

### `POST /api/chatbots/:id/knowledge/sources/:sourceId/retrain`

Re-chunks the source content and re-computes 1536-dimensional vector embeddings and full-text `tsvector` columns.

### `DELETE /api/chatbots/:id/knowledge/sources/:sourceId`

Deletes the knowledge source and cascades removal of all associated vector chunks.

---

### `POST /api/chatbots/:id/knowledge/query` (Hybrid RAG Interactive Test)

Executes a hybrid search query ($0.7 \times \text{Cosine Similarity} + 0.3 \times \text{PostgreSQL tsvector text rank}$) against bot vectors and Q&A overrides.

#### Request

```json
{
  "query": "What are the starting prices for 3BHK villas?",
  "topK": 4,
  "similarityThreshold": 0.65
}
```

#### Response (`200 OK`)

```json
{
  "data": {
    "answer": "Residences start from ₹3.25 Cr onwards for 3BHK luxury villas according to our Master Brochure.",
    "confidence": 0.96,
    "isGrounded": true,
    "isFallback": false,
    "overrideApplied": false,
    "citations": [
      {
        "sourceId": "uuid",
        "sourceTitle": "Master Brochure 2026",
        "sourceType": "file",
        "sectionHeader": "Pricing & Investment",
        "snippet": "Residences start from ₹3.25 Cr onwards for 3BHK villas and ₹5.50 Cr for 4BHK presidential villas.",
        "similarityScore": 0.96
      }
    ],
    "tokensUsed": {
      "prompt": 210,
      "completion": 45,
      "total": 255
    },
    "latencyMs": 85
  }
}
```

---

### Q&A Priority Overrides (`/api/chatbots/:id/knowledge/overrides`)

Overrides take absolute priority and bypass vector similarity search, returning an exact response with 100% confidence.

#### `GET /api/chatbots/:id/knowledge/overrides`
Lists all active priority overrides.

#### `POST /api/chatbots/:id/knowledge/overrides`
Creates a priority override:
```json
{
  "question": "Can I combine two 3BHK apartments into a duplex?",
  "answer": "Yes, adjacent unit combinations are supported on floors 4 through 12 subject to structural review.",
  "source": "correction"
}
```

#### `DELETE /api/chatbots/:id/knowledge/overrides/:overrideId`
Deletes the priority override.

---

### Unanswered Questions Inbox (`/api/chatbots/:id/knowledge/unanswered`)

Tracks low-confidence or unanswered queries asked by visitors to identify knowledge gaps.

#### `GET /api/chatbots/:id/knowledge/unanswered`
Lists pending unanswered questions with aggregated frequency counts and timestamps.

#### `POST /api/chatbots/:id/knowledge/unanswered/:questionId/resolve`
Resolves an unanswered question by supplying a verified answer, which automatically creates a permanent Q&A override.
```json
{
  "answer": "All 4BHK villas include separate servant quarters and dedicated utility space."
}
```

---

## Lead Capture & Buyer DNA (`/api/leads`)

### `GET /api/leads`
Lists leads for the current tenant with pagination, status filtering, and search.
- **Query params**: `page`, `limit`, `status`, `intentLabel` (`cold` | `warm` | `hot`), `assignedTo`, `search`.
- **Requires**: `view_leads` permission.

### `POST /api/leads`
Captures or updates a lead conversationally.
- Validates Indian (+91) and international numbers.
- If duplicate phone is detected, attaches a `duplicateMergeSuggestion` and links conversation instead of creating a second lead.
- Extracts Buyer DNA and updates Live Intent Score (0–100).
- If intent score reaches $\ge 70$, triggers Hot Lead Alert and creates an AI Handoff Brief.

### `GET /api/leads/:id`
Retrieves full details for a lead, including Buyer DNA profile, Intent Score breakdown, and AI Handoff Brief.

### `PATCH /api/leads/:id/status`
Updates lead pipeline status (`new`, `contacted`, `qualified`, `site_visit_scheduled`, `negotiation`, `booked`, `converted`, `lost`).
- **Requires**: `edit_leads` permission.

### `POST /api/leads/:id/merge`
Merges a duplicate lead into the primary record:
```json
{
  "sourceLeadId": "uuid-of-duplicate-lead"
}
```
- Consolidates conversation history, updates Buyer DNA, and clears the merge suggestion.

### `GET /api/leads/scoring-config`
Retrieves tenant custom weights and scoring thresholds.

### `PUT /api/leads/scoring-config`
Updates tenant custom weights and scoring thresholds.
- **Requires**: `manage_settings` permission.

---

## CRM Engine (`/api/crm`)

All CRM endpoints enforce tenant isolation, Bearer JWT authentication, and RBAC permissions.

### Pipeline & Kanban

#### `GET /api/crm/pipeline`
Returns the 8-stage Kanban board containing grouped lead summaries:
- Stages: `new`, `contacted`, `qualified`, `site_visit_scheduled`, `site_visit_done`, `negotiation`, `booked`, `lost`.
- Query params: `search`, `assignedAgentId`, `priority`, `hotOnly`.
- **Requires**: `view_leads` permission.

#### `PATCH /api/crm/pipeline/:leadId/stage`
Moves a lead between pipeline stages:
- **Body**: `{ "status": "site_visit_scheduled", "lostReason": "budget_mismatch" }`
- Mandatory `lostReason` validated if `status === 'lost'`.
- Automatically triggers follow-up task creation on `site_visit_scheduled` and `site_visit_done`.
- Emits `lead_status_changed` domain event.
- **Requires**: `edit_leads` permission.

#### `POST /api/crm/pipeline/bulk-stage`
Bulk updates stage for multiple leads:
- **Body**: `{ "leadIds": ["uuid1", "uuid2"], "status": "contacted" }`
- **Requires**: `edit_leads` permission.

### Assignment & Routing

#### `POST /api/crm/leads/:leadId/assign`
Assigns a lead to an agent manually or via round-robin:
- **Body**: `{ "agentId": "uuid", "roundRobin": false, "reason": "VIP routing" }`
- If `roundRobin: true`, automatically balances workload across active agents in the tenant.
- Emits `lead_assigned` domain event.
- **Requires**: `edit_leads` permission.

#### `POST /api/crm/leads/bulk-assign`
Bulk assigns multiple leads to an agent:
- **Body**: `{ "leadIds": ["uuid1", "uuid2"], "agentId": "uuid" }`
- **Requires**: `edit_leads` permission.

### Tasks & Follow-ups

#### `GET /api/crm/tasks`
Lists scheduled tasks for the tenant:
- **Query params**: `leadId`, `assignedUserId`, `status` (`pending` | `completed`), `type`, `myDay` (`true`), `overdue` (`true`), `page`, `limit`.
- **Requires**: `view_leads` permission.

#### `POST /api/crm/tasks`
Creates a follow-up task or site visit:
- **Body**:
  ```json
  {
    "leadId": "uuid",
    "assignedUserId": "uuid",
    "title": "Call to confirm budget and location preferences",
    "type": "call",
    "dueDate": "2026-10-12T10:00:00Z",
    "priority": "high",
    "description": "Customer requested callback after 10 AM"
  }
  ```
- Automatically updates `leads.next_follow_up_at`.
- **Requires**: `edit_leads` permission.

#### `PATCH /api/crm/tasks/:taskId`
Updates or completes a task:
- **Body**: `{ "status": "completed" }`
- Setting `status: "completed"` sets `completedAt: new Date()` and recalculates `leads.next_follow_up_at`.
- **Requires**: `edit_leads` permission.

#### `DELETE /api/crm/tasks/:taskId`
Deletes a task and recalculates `leads.next_follow_up_at`.
- **Requires**: `edit_leads` permission.

### Internal Notes

#### `GET /api/crm/leads/:leadId/notes`
Lists internal team collaboration notes for a lead with author details.
- **Requires**: `view_leads` permission.

#### `POST /api/crm/leads/:leadId/notes`
Adds an internal note:
- **Body**: `{ "content": "Customer requested 3-year possession plan." }`
- Records activity in visitor timeline.
- **Requires**: `edit_leads` permission.

#### `DELETE /api/crm/notes/:noteId`
Soft-deletes an internal note.
- **Requires**: `edit_leads` permission.

### Visitor Timeline

#### `GET /api/crm/leads/:leadId/timeline`
Retrieves chronological timeline of all activities for a lead:
- Aggregates chat sessions, status changes, task creations, completions, notes, and agent assignments.
- Query params: `activityType`, `limit`.
- **Requires**: `view_leads` permission.

### Contacts & Organizations

#### `GET /api/crm/contacts`
Lists universal contacts directory with search and organization filter:
- **Query params**: `search`, `organizationId`, `page`, `limit`.
- **Requires**: `view_leads` permission.

#### `GET /api/crm/contacts/:id`
Retrieves contact profile along with all linked property inquiries (`leads`).
- **Requires**: `view_leads` permission.

#### `POST /api/crm/contacts`
Creates a new contact record:
- **Body**: `{ "firstName": "Rohan", "lastName": "Verma", "phone": "+919876543210", "email": "rohan@example.com" }`
- **Requires**: `edit_leads` permission.

#### `POST /api/crm/contacts/merge`
Consolidates two contact profiles:
- **Body**: `{ "sourceContactId": "uuid1", "targetContactId": "uuid2" }`
- Reassigns all leads, notes, tasks, and activities from source to target contact.
- **Requires**: `edit_leads` permission.

#### `GET /api/crm/organizations`
Lists organizations/brokerages registered under the tenant.
- **Requires**: `view_leads` permission.

#### `POST /api/crm/organizations`
Creates a new organization record.
- **Requires**: `edit_leads` permission.

### CSV Export & Reports

#### `POST /api/crm/export`
Generates a downloadable CSV export of leads based on filters and custom column selections:
- **Body**: `{ "filters": { "status": "qualified" }, "columns": ["name", "phone", "email", "intentScore", "budgetMax", "status"] }`
- Returns CSV content stream (`text/csv`).
- **Requires**: `view_leads` permission.

#### `GET /api/crm/reports`
Generates real estate CRM performance metrics:
- Sales agent leaderboard (leads assigned, converted, conversion rate, completed tasks).
- Speed-to-lead average response time.
- Conversion attribution by acquisition source (`chat`, `whatsapp`, `manual`).
- Lost reasons Pareto breakdown.
- **Requires**: `view_analytics` permission.

---

## Property Inventory & Smart Shortlist Room (`/api/properties` & `/api/shortlist-room`)

### Projects Inventory

#### `GET /api/properties/projects`
Lists all property projects for the authenticated tenant:
- **Query params**: `status` (`pre_launch` | `under_construction` | `ready_to_move`), `search`, `location`, `page`, `limit`.
- Returns paginated projects with aggregated `totalUnitsCount` and `availableUnitsCount`.
- **Requires**: `view_inventory` permission.

#### `GET /api/properties/projects/:id`
Retrieves single project details including amenities, specifications, USPs, floor plans, and locality insights.
- **Requires**: `view_inventory` permission.

#### `POST /api/properties/projects`
Registers a new property project and auto-indexes project data in the AI Knowledge Base:
- **Body**: `{ "name": "Skyline Heights", "builderName": "Skyline Developers", "location": "Whitefield, Bengaluru", "status": "under_construction", "reraNumber": "PRM/KA/RERA/1251/446/PR/200123/003456", "startingPrice": 12500000, "bhkOptions": [2, 3], "completionDate": "2027-12-31" }`
- **Requires**: `manage_inventory` permission (`company_admin`, `sales_manager`).

#### `PATCH /api/properties/projects/:id`
Updates existing project details and re-indexes Knowledge Base.
- **Requires**: `manage_inventory` permission.

### Units Inventory & Bulk Import

#### `GET /api/properties/projects/:projectId/units`
Lists units within a project:
- **Query params**: `bhk`, `status` (`available` | `blocked` | `sold`), `floor`, `priceMax`, `page`, `limit`.
- **Requires**: `view_inventory` permission.

#### `POST /api/properties/projects/:projectId/units`
Adds a single unit to a project:
- **Body**: `{ "tower": "Tower A", "floor": 12, "unitNumber": "A-1204", "bhk": 3, "carpetAreaSqft": 1450, "price": 14500000, "status": "available", "facing": "East" }`
- **Requires**: `manage_inventory` permission.

#### `PATCH /api/properties/units/:unitId/status`
Quick-toggles unit status:
- **Body**: `{ "status": "blocked" }` (`available`, `blocked`, or `sold`).
- **Requires**: `manage_inventory` permission.

#### `POST /api/properties/projects/:projectId/units/import`
Bulk imports 50+ units via CSV string or array of rows:
- Supports Indian currency formats (`1.5 Cr`, `85 Lakhs`, `₹1,50,00,000`).
- Reports failed rows with specific validation errors.
- **Requires**: `manage_inventory` permission.

### Digital Brochures & Tracking

#### `GET /api/properties/projects/:projectId/brochures`
Lists all collateral brochures for a project.
- **Requires**: `view_inventory` permission.

#### `POST /api/properties/projects/:projectId/brochures`
Uploads / registers a brochure:
- **Body**: `{ "title": "Skyline Heights Master Brochure", "fileUrl": "https://cdn.example.com/skyline.pdf", "isGated": true }`
- **Requires**: `manage_inventory` permission.

#### `POST /api/properties/brochures/:id/request`
Buyer brochure request:
- If gated, requires `leadId` or contact details (`phone`, `email`).
- Returns tracked download link `/api/properties/brochures/track/:token`.

#### `GET /api/properties/brochures/track/:token`
Public brochure redirect endpoint:
- Validates HMAC signature and timestamp.
- Increments brochure download count.
- Logs `brochure_opened` activity on visitor timeline.
- Increases lead intent score (+10 points).
- Redirects HTTP 302 to target PDF file URL.

### Property Search Tool

#### `GET /api/properties/search` & `POST /api/properties/search`
Structured search query endpoint used by the bot and agents:
- Query/Body: `budgetMin`, `budgetMax`, `bhk`, `location`, `limit`.
- Returns matching `PropertyCardResponse` items with match score and highlights.
- **Requires**: `view_inventory` permission.

### Smart Shortlist Room

#### `POST /api/shortlist-room`
Generates a new shareable shortlist room for a lead:
- **Body**: `{ "leadId": "uuid", "projectIds": ["uuid1", "uuid2"], "expiresInDays": 7 }`
- If `projectIds` is omitted, uses the 4-factor Buyer DNA matching engine to recommend top 3-5 properties.
- Returns unguessable public room link (`/room/:token`).
- **Requires**: `manage_inventory` or `edit_leads` permission.

#### `GET /api/shortlist-room/lead/:leadId`
Lists active shortlist rooms generated for a lead.
- **Requires**: `view_leads` permission.

#### `GET /api/shortlist-room/public/:token`
Public, unauthenticated endpoint for prospective buyers:
- Validates room expiration and tenant isolation.
- Returns buyer name, curated properties, photos, amenities, match scores, and side-by-side comparison matrix.

#### `POST /api/shortlist-room/public/:token/telemetry`
Public telemetry ping from the buyer's browser:
- **Body**: `{ "eventType": "dwell_time" | "project_clicked" | "compare_viewed" | "emi_calculated", "projectId": "uuid", "dwellSeconds": 30 }`
- Logs `room_viewed` activity on the visitor timeline.
- Increases lead intent score (+15 points on initial room view).
- Updates lead's favorite project based on highest dwell time and interaction.

---

## 8. Appointments & Calendar Sync Endpoints

### Appointments Dashboard & Management

#### `GET /api/appointments`
Lists all site visits and appointments:
- **Query Params**: `status` (`scheduled`, `confirmed`, `completed`, `no_show`, `cancelled`, `rescheduled`), `search`, `date` (`YYYY-MM-DD`), `agentId`, `projectId`, `leadId`, `page`, `limit`.
- **Requires**: `view_appointments` permission.

#### `GET /api/appointments/kpis`
Fetches appointment dashboard KPI summary:
- **Response**: `{ "upcoming": 7, "today": 3, "calendarSynced": 5, "all": 12 }`
- **Requires**: `view_appointments` permission.

#### `GET /api/appointments/:id`
Retrieves detailed appointment record with lead identity, project, and assigned agent.
- **Requires**: `view_appointments` permission.

#### `POST /api/appointments`
Schedules a new appointment:
- **Body**: `{ "leadId": "uuid", "projectId": "uuid", "appointmentType": "site_visit", "scheduledAt": "2026-11-20T11:00:00Z", "location": "Site Gallery", "notes": "Buyer interested in 3BHK" }`
- Enforces database transaction lock preventing double bookings (returns `409 Conflict` if unavailable).
- Automatically advances CRM lead stage to `site_visit_scheduled`, logs activity, and adds +25 to Intent Score.
- **Requires**: `manage_appointments` permission.

#### `POST /api/appointments/:id/reschedule`
Reschedules an appointment to another open time slot:
- **Body**: `{ "scheduledAt": "2026-11-22T15:00:00Z", "reason": "Client requested afternoon timing" }`
- Marks previous appointment as `rescheduled` and creates linked new appointment.
- **Requires**: `manage_appointments` permission.

#### `PATCH /api/appointments/:id/status`
Updates appointment lifecycle status:
- **Body**: `{ "status": "confirmed" | "completed" | "no_show" | "cancelled", "cancellationReason": "Optional text" }`
- When marked `completed`: advances lead stage to `site_visit_done` and generates a 48h CRM follow-up task.
- When marked `no_show`: triggers no-show recovery and generates a 24h rebooking call task.
- **Requires**: `manage_appointments` permission.

---

### Availability Engine & Settings

#### `GET /api/appointments/available-slots`
Generates open booking slots for a specified date:
- **Query Params**: `date` (`YYYY-MM-DD`, required), `projectId` (optional), `agentId` (optional).
- Evaluates working hours, working days, slot duration, buffer times, blackout dates, and existing bookings.
- **Requires**: `view_appointments` permission.

#### `GET /api/appointments/settings/availability` & `PUT /api/appointments/settings/availability`
Retrieves and updates company scheduling rules:
- **Body**: `{ "workingDays": [1, 2, 3, 4, 5, 6], "startTime": "09:00", "endTime": "18:00", "slotDurationMinutes": 45, "bufferMinutes": 15, "maxVisitsPerSlot": 1, "blackoutDates": ["2026-12-25"] }`
- **Requires**: `manage_settings` permission.

---

### Google Calendar Integration

#### `GET /api/appointments/calendar/status`
Checks 2-way Google Calendar synchronization status (`synced` vs `dashboard_only`).
- **Requires**: `view_appointments` permission.

#### `GET /api/appointments/calendar/oauth-url`
Generates Google Calendar OAuth authorization URL.
- **Requires**: `manage_appointments` permission.

#### `POST /api/appointments/calendar/mock-connect`
Connects mock calendar provider for offline development and CI environments.
- **Requires**: `manage_appointments` permission.

#### `DELETE /api/appointments/calendar/disconnect`
Disconnects active Google Calendar synchronization.
- **Requires**: `manage_appointments` permission.

---

### Automated Reminders & Surveys

#### `POST /api/appointments/reminders/sweep`
Executes background sweep sending 24-hour and 2-hour automated reminders to upcoming visitors.
- **Requires**: `manage_appointments` permission.

#### `POST /api/appointments/survey/:token`
Public buyer post-visit feedback survey endpoint:
- **Body**: `{ "rating": 5, "interestedInBooking": "yes" | "maybe" | "no", "feedback": "Loved the layout and amenities!" }`
- When `interestedInBooking` is `yes`: elevates Intent Score by +15 points and transitions lead to `negotiation` stage.

---

### Public Chatbot Widget Booking

#### `GET /api/chatbots/:chatbotId/available-slots`
Public endpoint queried by the website chatbot widget to display open time slots to visitors.

#### `POST /api/chatbots/:chatbotId/book-visit`
Public endpoint called by the chatbot `book_visit` tool:
- **Body**: `{ "visitorName": "Sneha Patel", "visitorPhone": "+919876543210", "visitorEmail": "sneha@example.com", "projectId": "uuid", "scheduledAt": "2026-11-20T11:00:00Z", "notes": "Requested 3BHK visit" }`
- Captures or updates CRM lead, assigns stage `site_visit_scheduled`, emits `visit_booked` domain event, and awards +25 Intent Score points.
- Returns formatted confirmation message with date, time, and instructions.

---

## 9. WhatsApp AI Bot & Shared Inbox Endpoints

### Meta Cloud API Webhook Endpoints

#### `GET /api/webhooks/meta`
Public Meta webhook verification challenge endpoint:
- **Query Params**: `hub.mode`, `hub.verify_token`, `hub.challenge`.
- Matches configured tenant `verify_token` and returns `hub.challenge` string with HTTP 200.

#### `POST /api/webhooks/meta`
Public incoming Meta Cloud API message/event receiver:
- **Headers**: `X-Hub-Signature-256` (HMAC SHA-256 of raw request body).
- **Body**: Standard WhatsApp Business Account webhook payload with `messages`, `contacts`, `statuses`.
- Validates signature against tenant `appSecret` if configured.
- Deduplicates messages by `wamid` via `whatsapp_inbound_events` table.
- Automatically captures/updates Lead and Contact with `source: 'whatsapp'`.
- Supports opt-out commands (`STOP` / `UNSUBSCRIBE`) and opt-in commands (`START`).
- Detects human handoff requests and negative sentiment (`needs_human`).
- Evaluates Guarded Action Layer for price and payment commitments (`T2 proposed`).

---

### WhatsApp Configuration & Management

#### `GET /api/whatsapp/config`
Retrieves tenant WhatsApp configuration:
- Returns masked tokens (`maskedAccessToken`), `phoneNumberId`, `businessPhoneNumber`, `verifyToken`, `callbackUrl`, and automation toggles.
- **Requires**: `manage_settings` or `manage_chatbots` permission.

#### `PUT /api/whatsapp/config`
Updates tenant WhatsApp settings and Meta credentials:
- **Body**: `{ "phoneNumberId": "104928172635412", "businessPhoneNumber": "+919876543210", "accessToken": "EAAG...", "enableAutomation": true, "aiAutoReplies": true, "pauseAfterAgentReply": true, "frustrationHandoff": true, "autoAssignOwner": true, "handoffKeywords": ["agent", "human"] }`
- **Requires**: `manage_settings` permission.

#### `POST /api/whatsapp/config/generate-verify-token`
Generates a new cryptographically secure webhook verification token:
- **Response**: `{ "verifyToken": "hex-string" }`
- **Requires**: `manage_settings` permission.

---

### Shared Inbox Operations

#### `GET /api/whatsapp/overview`
Fetches WhatsApp dashboard summary KPI metrics:
- **Response**: `{ "messagesToday": 48, "aiResolutionRate": 94, "handoffsCount": 3, "avgFirstResponseSeconds": 1.8, "activeConversations": 12, "totalConnectedNumbers": 1 }`
- **Requires**: `view_chatbots` or `view_leads` permission.

#### `GET /api/whatsapp/conversations`
Lists WhatsApp conversation threads with pagination and filters:
- **Query Params**: `filter` (`all`, `needs_human`, `assigned_to_me`), `search`, `page`, `limit`.
- Returns conversation items with visitor phone, name, last snippet, unread counter, sentiment, intent score, and 24h window remaining hours.
- **Requires**: `view_chatbots` or `view_leads` permission.

#### `GET /api/whatsapp/conversations/:id`
Retrieves full WhatsApp conversation thread:
- Returns full message history with delivery statuses (`sent`, `delivered`, `read`), 24-hour service window timer, and lead Buyer DNA.
- **Requires**: `view_chatbots` or `view_leads` permission.

#### `POST /api/whatsapp/conversations/:id/messages`
Sends manual agent reply via WhatsApp:
- **Body**: `{ "content": "Hello, I can help you with the 3 BHK layout." }`
- Validates 24-hour customer service window (disallows freeform message if expired).
- Auto-pauses AI automation for the thread if `pauseAfterAgentReply` is active.
- **Requires**: `manage_chatbots` or `edit_leads` permission.

#### `POST /api/whatsapp/conversations/:id/takeover`
Manual agent takeover: pauses AI responses and flags thread as `needs_human`.
- **Requires**: `manage_chatbots` or `edit_leads` permission.

#### `POST /api/whatsapp/conversations/:id/resume-ai`
Resumes automated AI bot responses on the conversation thread.
- **Requires**: `manage_chatbots` or `edit_leads` permission.

#### `POST /api/whatsapp/conversations/:id/close`
Closes active WhatsApp conversation.
- **Requires**: `manage_chatbots` or `edit_leads` permission.

---

### Template Broadcast Campaigns

#### `POST /api/whatsapp/campaigns/broadcast`
Sends approved Meta template message broadcast to a segmented lead audience:
- **Body**: `{ "templateName": "property_inquiry_details", "targetSegment": "all" | "hot" | "site_visit_scheduled" | "new", "leadIds": ["uuid"] }`
- Creates record in `whatsapp_campaigns` and dispatches template messages to matching leads.
- **Requires**: `manage_chatbots` permission.

---

## Webhooks & Integrations Engine (`/api/webhooks`, `/api/integrations`)

All webhooks and integrations endpoints enforce tenant isolation, Bearer JWT authentication, and RBAC permissions (except public inbound lead ingestion which operates with secure portal API keys or company tenant identifiers).

### Webhook Endpoints Management

#### `GET /api/webhooks/endpoints`
Lists all registered outbound webhook endpoints for the tenant:
- **Requires**: `view_webhooks` permission.

#### `POST /api/webhooks/endpoints`
Registers a new outbound webhook endpoint:
- **Body**:
  ```json
  {
    "name": "Production CRM Sync",
    "url": "https://api.example.com/webhooks/leads",
    "subscribedEvents": ["lead_captured", "visit_booked", "intent_score_changed"],
    "headers": {
      "Authorization": "Bearer token_secret_123"
    },
    "payloadTemplate": "{\\"lead_id\\": \\"{{id}}\\", \\"phone\\": \\"{{phone}}\\"}",
    "isActive": true
  }
  ```
- Automatically generates a cryptographically secure signing secret (`whsec_...`).
- Validates URL against SSRF protection guard (rejects private RFC 1918 IPs, loopbacks, and non-HTTP protocols).
- **Requires**: `manage_webhooks` permission.

#### `GET /api/webhooks/endpoints/:id`
Retrieves an endpoint by ID, masking sensitive headers and providing the signing secret for endpoint verification.
- **Requires**: `view_webhooks` permission.

#### `PUT /api/webhooks/endpoints/:id`
Updates an existing endpoint configuration (URL, subscribed events, custom headers, payload template, active status).
- **Requires**: `manage_webhooks` permission.

#### `DELETE /api/webhooks/endpoints/:id`
Deletes a webhook endpoint.
- **Requires**: `manage_webhooks` permission.

#### `POST /api/webhooks/endpoints/:id/test`
Dispatches a synthetic test ping event (`test_event`) to the endpoint to verify destination connectivity, latency, and signature verification:
- **Response**: `{ "success": true, "statusCode": 200, "durationMs": 142, "status": "success", "logId": "uuid" }`
- **Requires**: `manage_webhooks` permission.

---

### Delivery Audit Logs & Manual Replay

#### `GET /api/webhooks/logs`
Lists paginated delivery logs for the tenant with multi-factor filtering:
- **Query Params**: `endpointId`, `status` (`all`, `success`, `retrying`, `failed`, `dead_letter`), `eventType`, `startDate`, `endDate`, `search`, `page`, `limit`.
- Returns logs with sanitized request headers, response status code, attempt count (`1/3`, `2/3`, `3/3`), duration, and error message.
- **Requires**: `view_webhooks` permission.

#### `GET /api/webhooks/logs/kpis`
Fetches top-level delivery performance metrics:
- **Response**:
  ```json
  {
    "totalDeliveries": 1284,
    "successRate": 99.2,
    "avgDurationMs": 215,
    "deadLetterCount": 2,
    "retryingCount": 5
  }
  ```
- **Requires**: `view_webhooks` permission.

#### `GET /api/webhooks/logs/:id`
Retrieves full delivery log record including request payload, response body, sanitized request headers, and response headers.
- **Requires**: `view_webhooks` permission.

#### `POST /api/webhooks/logs/:id/replay`
Manually replays a failed or dead-lettered webhook event immediately:
- Resets attempt counters and logs new delivery status.
- **Requires**: `manage_webhooks` permission.

---

### Inbound Portal Lead Ingestion

#### `POST /api/webhooks/inbound/leads`
Public webhook endpoint for receiving lead inquiries from external real estate portals and ad networks:
- **Body**:
  ```json
  {
    "portal": "99acres", // "99acres" | "magicbricks" | "housing" | "meta_ads" | "google_ads"
    "name": "Pooja Hegde",
    "phone": "+919876500012",
    "email": "pooja@example.com",
    "project": "Prestige Serenity Shores",
    "budget": "2.5 Cr - 3 Cr",
    "configuration": "3 BHK",
    "externalLeadId": "99A_LEAD_84710",
    "metadata": {
      "city": "Bengaluru",
      "locality": "Whitefield"
    }
  }
  ```
- Normalizes Indian (+91) and international phone numbers.
- Checks duplicate detection rules: matching phone numbers update existing CRM lead records with merge suggestions.
- Updates lead source to the portal name.
- Emits `lead_created` domain event to the transactional outbox.
- Dispatches automated WhatsApp introductory welcome message if WhatsApp automation is enabled for the company.
- **Response**: `{ "success": true, "data": { "leadId": "uuid", "contactId": "uuid" } }` (HTTP 201).

---

### Native Integrations & Conversion Tracking

#### `GET /api/integrations`
Lists configured integration adapters (Google Sheets, HubSpot, Zoho CRM, Meta CAPI, Google Ads) with masked secrets:
- **Requires**: `view_webhooks` or `manage_settings` permission.
- **Security**: Sensitive tokens and passwords are fully masked (`••••••••last4`).

#### `GET /api/integrations/platform`
Lists platform-level foundation integrations and status (OpenAI, Anthropic, Gemini, WhatsApp, R2 Storage, SMTP):
- **Requires**: `ps-owner` role.
- **Security**: Key values are strictly masked.

#### `PUT /api/integrations/:provider`
Configures integration settings and credentials:
- **Providers**: `google_sheets`, `hubspot`, `zoho`, `generic_rest`, `meta_pixel`, `google_ads`.
- **Security**: All API keys, secrets, tokens, and passwords are automatically encrypted at rest using AES-256-GCM (`vault:v1:iv:tag:ciphertext`).
- **Body**: `{ "config": { "spreadsheetId": "..." }, "status": "active", "events": ["lead.created"] }`
- **Requires**: `manage_webhooks` or `manage_settings` permission.

#### `POST /api/integrations/:provider/test`
Tests connectivity with external integration provider using mock provider fallback in testing/development environments.
- **Requires**: `manage_webhooks` or `manage_settings` permission.

#### `POST /api/integrations/pixel/event`
Dispatches ad conversion events to Meta Conversions API (CAPI) and Google Ads:
- **Body**:
  ```json
  {
    "eventName": "Lead", // "Lead" | "Schedule" | "Contact"
    "consentGiven": true,
    "leadId": "uuid",
    "email": "visitor@example.com",
    "phone": "+919876543210",
    "customData": {
      "currency": "INR",
      "value": 15000000
    }
  }
  ```
- **Strict Consent Mode**: If `consentGiven !== true`, the event is strictly suppressed with an audit log and NOT forwarded to ad networks.
- **Requires**: `view_webhooks` or public widget session.

---

## Analytics, Attribution & Forecasting (`/api/analytics`)

### Overview & Funnels

#### `GET /api/analytics/kpis`
Retrieves 6 core KPI metrics with trend deltas calculated against the previous identical period duration:
- **Query Params**: `period` (`today` | `7d` | `30d` | `90d` | `custom`), `startDate`, `endDate`, `chatbotId`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "totalConversations": { "value": 1240, "delta": 14.2, "trend": "up" },
      "leadsGenerated": { "value": 184, "delta": 8.5, "trend": "up" },
      "conversionRate": { "value": 14.8, "delta": -1.2, "trend": "down" },
      "avgResponseTimeSec": { "value": 1.4, "delta": -18.3, "trend": "up" },
      "satisfactionRate": { "value": 94.2, "delta": 2.1, "trend": "up" },
      "activeChatbots": { "value": 3, "delta": 0, "trend": "neutral" }
    }
  }
  ```
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/cta-funnel`
Retrieves the 5-step CTA widget interaction funnel:
- **Funnel Stages**: `Shown` ➔ `Clicked` ➔ `Started` ➔ `Completed` ➔ `Failed`.
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      { "stage": "Shown", "count": 10000, "dropOffRate": 0, "conversionFromTop": 100 },
      { "stage": "Clicked", "count": 3200, "dropOffRate": 68.0, "conversionFromTop": 32.0 },
      { "stage": "Started", "count": 1850, "dropOffRate": 42.2, "conversionFromTop": 18.5 },
      { "stage": "Completed", "count": 1420, "dropOffRate": 23.2, "conversionFromTop": 14.2 },
      { "stage": "Failed", "count": 430, "dropOffRate": 0, "conversionFromTop": 4.3 }
    ]
  }
  ```
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/real-estate-funnel`
Retrieves the 7-stage end-to-end real estate journey funnel:
- **Funnel Stages**: `Visitor` ➔ `Chat` ➔ `Lead` ➔ `Qualified` ➔ `Visit Booked` ➔ `Visit Done` ➔ `Booked`.
- Includes stage count, drop-off percentage from previous stage, and conversion percentage from top of funnel.
- **Requires**: `view_analytics` permission.

---

### Dashboard Tabs

#### `GET /api/analytics/performance`
Retrieves daily trend metrics and traffic channel distribution:
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "timeline": [
        { "date": "2026-10-01", "conversations": 42, "leads": 6, "conversionRate": 14.3 }
      ],
      "channelShare": [
        { "channel": "Web Widget", "count": 820, "percentage": 66.1 },
        { "channel": "WhatsApp", "count": 420, "percentage": 33.9 }
      ]
    }
  }
  ```
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/engagement`
Retrieves visitor behavioral and engagement depth analytics:
- `heatmap`: 7x24 grid of Day-of-Week (`0=Sunday` to `6=Saturday`) and Hour-of-Day (`0-23`) with conversation counts.
- `messagesPerConversation`: Distribution buckets (`1-2`, `3-5`, `6-10`, `11+`).
- `dropOffTurns`: Visitor drop-off turn distribution (`Turn 1`, `Turn 2`, `Turn 3`, `Turn 4+`).
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/top-queries`
Retrieves visitor inquiry clustering and unanswered question gap analysis:
- `themes`: Clustered question themes (`Pricing & Payment Plans`, `Configurations & Floor Plans`, `Location & Connectivity`, `Amenities & Possession`, `RERA & Approvals`) with counts and sample queries.
- `unanswered`: Unanswered questions logged in `unanswered_questions` table with frequency counts and direct links to knowledge base override resolution.
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/real-estate-insights`
Retrieves real estate domain intelligence:
- `demandByLocality`: Top requested micro-markets and localities.
- `demandByBhk`: Breakdown by unit configuration (`1 BHK`, `2 BHK`, `3 BHK`, `4+ BHK`, `Plots/Villas`).
- `demandByBudget`: Demand segments (`< 1 Cr`, `1 - 1.5 Cr`, `1.5 - 2.5 Cr`, `2.5 - 5 Cr`, `5+ Cr`).
- `mostAskedObjections`: Top objection categories (`Budget Too High`, `Possession Date Far`, `Location Far from IT Hub`, `High Floor Rise Charges`).
- `responseTimeVsConversion`: Cohort conversion analysis for `< 5s`, `5-15s`, `15-30s`, `> 30s` response times.
- `speedToLeadSla`: Hot-lead follow-up SLA compliance percentages (`< 5 mins`, `5-15 mins`, `15-60 mins`, `> 60 mins`).
- **Requires**: `view_analytics` permission.

---

### AI Quality & Attribution & Forecasting

#### `GET /api/analytics/ai-quality`
Retrieves AI governance, token economics, and human-in-the-loop oversight metrics:
- `costPerLead`: Total LLM token spend divided by leads generated.
- `tokenUsage`: Prompt tokens, completion tokens, and total estimated cost in USD.
- `approvalQueueStats`: Total actions queued, approved, rejected, and pending.
- `accuracyTrend`: Weekly grounded evaluation accuracy percentage.
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/attribution`
Calculates multi-touch marketing attribution across campaigns:
- **Query Params**: `model` (`first_touch` | `last_touch` | `linear`).
- **Response**: Array of campaign performances:
  - `campaign`: Campaign name or UTM tag.
  - `leads`: Attributed lead volume under chosen model.
  - `deals`: Attributed closed deals / appointments.
  - `spend`: Total logged ad spend (INR).
  - `cpl`: Cost Per Lead (`spend / leads`).
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/forecast`
Generates a 30-day forward-looking predictive forecast:
- Uses 30-day moving average baseline with 7-day cyclical seasonality and 80% confidence interval band (`estimate: true`).
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/spends` & `POST /api/analytics/spends`
Lists and logs manual campaign advertising spend for CPL computation:
- **Body (`POST`)**:
  ```json
  {
    "campaignName": "Google_Search_Bangalore_East",
    "channel": "google_ads",
    "amount": 45000,
    "currency": "INR",
    "startDate": "2026-10-01",
    "endDate": "2026-10-31"
  }
  ```
- **Requires**: `manage_analytics` or `view_analytics` permission.

#### `GET /api/analytics/export/csv`
Streams a comprehensive CSV export containing daily rolled-up analytics metrics, conversations, leads, and conversion rates.
- **Headers**: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="propbot-analytics-export-....csv"`.
- **Requires**: `view_analytics` permission.

#### `GET /api/analytics/admin/overview`
Platform-wide multi-tenant benchmark overview for Super Administrators:
- Aggregates cross-company totals (total companies, total conversations, total leads, average conversion rate, and average response time).
- **Requires**: `ps-owner` role.


---

## 12. Users, Billing & Settings Endpoints (`/api/users`, `/api/agency`, `/api/subscription`, `/api/settings`)

All administrative endpoints enforce tenant isolation, Bearer JWT authentication, and RBAC permissions.

### 12.1 User Management & Invitations (`/api/users`)

#### `GET /api/users`
Lists all team members and users in the tenant:
- **Query Params**: `role` (`ps-owner`, `admin`, `sales_manager`, `agent`, `marketing`, `analyst`), `status` (`active`, `pending`, `deactivated`), `team`, `search`, `page`, `limit`.
- Returns user items with avatar, role, team, working hours, lead capacity, assigned chatbots, and joined date.
- **Requires**: `manage_users` or `view_analytics` permission.

#### `GET /api/users/kpis`
Fetches User Management summary KPI cards:
- **Response**: `{ "totalUsers": 12, "activeUsers": 10, "pendingInvites": 2, "clientCompanies": 3 }`
- **Requires**: `manage_users` permission.

#### `GET /api/users/invitations`
Lists pending team invitations:
- Returns invitation records with email, role, team, invitedBy, expiresAt, and status (`pending`, `accepted`, `revoked`, `expired`).
- **Requires**: `manage_users` permission.

#### `POST /api/users/invite`
Sends an email invitation with a secure cryptographically unguessable token:
- **Body**: `{ "email": "agent@example.com", "role": "agent", "team": "Bangalore East", "leadCapacity": 30, "chatbotIds": ["uuid"] }`
- Enforces plan user limit via `enforcePlanLimit('users')`.
- **Requires**: `manage_users` permission.

#### `DELETE /api/users/invitations/:id`
Revokes a pending invitation token.
- **Requires**: `manage_users` permission.

#### `POST /api/users/accept-invite`
Public endpoint to accept an invitation and activate account:
- **Body**: `{ "token": "hex-invitation-token", "name": "Rohan Sharma", "password": "SecurePassword123!" }`
- Validates token validity and expiration, hashes password, creates user record, and revokes invitation.

#### `GET /api/users/audit-logs`
Retrieves tenant audit logs for security, compliance, and user management events:
- **Query Params**: `action`, `actorId`, `page`, `limit`.
- Returns timestamped log entries with action, actor, target user, IP address, and metadata diff.
- **Requires**: `manage_users` permission.

#### `GET /api/users/sessions`
Lists active sessions and refresh families for the authenticated user or team:
- **Requires**: `manage_users` permission.

#### `DELETE /api/users/sessions/:familyId`
Revokes a specific session family, terminating user sessions on remote devices.
- **Requires**: `manage_users` permission.

#### `PUT /api/users/:id`
Updates user profile, role, team assignment, capacity, and status:
- **Body**: `{ "role": "sales_manager", "team": "Central Sales", "workingHours": { "start": "09:00", "end": "18:00", "timezone": "Asia/Kolkata" }, "leadCapacity": 50, "chatbotIds": ["uuid"], "isActive": true }`
- **Requires**: `manage_users` permission.

#### `DELETE /api/users/:id`
Deactivates or removes a user from the tenant.
- **Requires**: `manage_users` permission.

#### `POST /api/users/:id/reset-2fa`
Admin emergency action to reset a user's lost Two-Factor Authentication (TOTP) secret:
- Logs security audit trail.
- **Requires**: `manage_users` permission (`admin` or `ps-owner`).

---

### 12.2 Agency & Client Delivery (`/api/agency`)

#### `GET /api/agency/clients`
Lists child client companies managed under agency reseller mode:
- Returns client companies with assigned chatbots, active delivery rules, and lead credit balance.
- **Requires**: `manage_settings` permission.

#### `POST /api/agency/clients`
Provisions a new child client company under the agency parent account:
- **Body**: `{ "name": "Godrej Partner Agency", "slug": "godrej-partner", "email": "contact@partner.com", "deliveryRules": { ... } }`
- **Requires**: `manage_settings` permission.

#### `PUT /api/agency/clients/:id/delivery-rules`
Updates automated lead routing and delivery rules for a client:
- **Body**:
  ```json
  {
    "workingHoursOnly": true,
    "roundRobin": true,
    "duplicateWindowHours": 24,
    "channels": {
      "email": true,
      "webhook": true,
      "whatsapp": false,
      "webhookUrl": "https://crm.partner.com/inbound"
    }
  }
  ```
- **Requires**: `manage_settings` permission.

#### `POST /api/agency/chatbots/:id/assign`
Assigns a chatbot to a child client company for white-labeled client operations:
- **Body**: `{ "clientId": "uuid" }`
- **Requires**: `manage_chatbots` permission.

#### `GET /api/agency/portal`
Restricted portal view for client logins:
- Returns client company identity, assigned bots, and filtered leads delivered to this client company.
- **Requires**: Authenticated client user.

---

### 12.3 Subscription, Quotas & Invoicing (`/api/subscription`)

#### `GET /api/subscription`
Fetches current subscription details, plan limits, and usage progress meters:
- **Response**:
  ```json
  {
    "planId": "growth",
    "status": "active",
    "currentPeriodEnd": "2026-11-30T00:00:00Z",
    "usage": {
      "bots": { "used": 3, "limit": 10, "percent": 30 },
      "chats": { "used": 1420, "limit": 5000, "percent": 28.4 },
      "tokens": { "used": 420000, "limit": 2000000, "percent": 21 },
      "users": { "used": 4, "limit": 10, "percent": 40 },
      "leadCredits": 250
    },
    "features": {
      "whiteLabel": true,
      "apiAccess": true,
      "workflows": true,
      "voice": false
    }
  }
  ```
- **Requires**: `manage_settings` or `view_analytics` permission.

#### `POST /api/subscription/checkout`
Creates checkout session for upgrading or downgrading plans:
- **Body**: `{ "planId": "growth" | "starter" | "enterprise", "interval": "monthly" | "yearly", "provider": "stripe" | "razorpay" }`
- Returns payment gateway session URL or client order token.
- **Requires**: `manage_settings` permission.

#### `POST /api/subscription/cancel`
Cancels subscription renewal at period end.
- **Requires**: `manage_settings` permission.

#### `GET /api/subscription/invoices`
Lists all historical tax invoices, payments, and PDF download links.
- **Requires**: `manage_settings` permission.

#### `POST /api/subscription/lead-credits`
Purchases add-on lead credit packs:
- **Body**: `{ "packSize": 500, "amount": 2500, "provider": "razorpay" }`
- **Requires**: `manage_settings` permission.

#### `GET /api/subscription/lead-credits/transactions`
Retrieves lead credit ledger showing deductions per delivered lead and additions from top-ups.
- **Requires**: `manage_settings` permission.

#### `POST /api/subscription/webhooks/:provider`
Public webhook receiver for payment gateways (`stripe`, `razorpay`):
- Verifies cryptographic signature (`Stripe-Signature` or `X-Razorpay-Signature`).
- Processes `invoice.paid`, `subscription.updated`, and `subscription.deleted` events.
- Automatically provisions upgraded quotas in database.

---

### 12.4 Company Settings, Security & Data Governance (`/api/settings`)

#### `GET /api/settings`
Retrieves consolidated tenant settings (company profile, operating hours, security policies, AI controls).
- **Requires**: `manage_settings` permission.

#### `PUT /api/settings/profile`
Updates company branding, white-label configuration, and profile:
- **Body**: `{ "name": "Apex Realty", "logo": "https://cdn.example.com/logo.png", "brandColor": "#4F46E5", "whiteLabel": true }`
- If `whiteLabel: true` is requested on plans without white-label entitlement, returns HTTP 403 `PLAN_LIMIT_EXCEEDED`.
- **Requires**: `manage_settings` permission.

#### `PUT /api/settings/operations`
Updates operating hours, sales pipeline stages, custom tags, custom lead fields, and SLA response timer:
- **Body**:
  ```json
  {
    "businessHours": { "start": "09:00", "end": "19:00", "days": [1, 2, 3, 4, 5, 6], "timezone": "Asia/Kolkata" },
    "pipelineStages": ["new", "contacted", "site_visit_scheduled", "negotiation", "won", "lost"],
    "tags": ["Investor", "First-time Buyer", "NRI", "Ready to Move"],
    "customLeadFields": [{ "key": "possessionTimeline", "label": "Possession Timeline", "type": "select" }],
    "hotLeadSlaMinutes": 10
  }
  ```
- **Requires**: `manage_settings` permission.

#### `PUT /api/settings/ai-controls`
Updates AI safety and governance controls:
- **Body**:
  ```json
  {
    "aiKillSwitch": false,
    "allowedTiers": ["T0", "T1", "T2"],
    "dailyActionCap": 100,
    "requireHumanApprovalForT2": true
  }
  ```
- **Requires**: `manage_settings` permission.

#### `GET /api/settings/api-keys`
Lists tenant API keys:
- Returns masked key prefix (`pb_live_...`), name, created date, and last used timestamp.
- **Requires**: `manage_settings` permission.

#### `POST /api/settings/api-keys`
Generates a new secure API key:
- **Body**: `{ "name": "Zapier Webhook Key", "scopes": ["leads:read", "leads:write"] }`
- Generates `pb_live_<random_bytes>` and stores SHA-256 hash at rest.
- Returns raw plaintext key in response once (never retrievable again).
- **Requires**: `manage_settings` permission.

#### `DELETE /api/settings/api-keys/:id`
Revokes an API key immediately.
- **Requires**: `manage_settings` permission.

#### `POST /api/settings/security/2fa/setup`
Initiates TOTP Two-Factor Authentication setup:
- Generates standard base32 secret and QR code data URL (`otpauth://...`).
- **Requires**: Authenticated user.

#### `POST /api/settings/security/2fa/verify`
Verifies user 6-digit TOTP code and activates 2FA on the account:
- **Body**: `{ "token": "123456" }`
- **Requires**: Authenticated user.

#### `POST /api/settings/security/2fa/disable`
Disables Two-Factor Authentication for the user.
- **Requires**: Authenticated user.

#### `PUT /api/settings/security/ip-allowlist`
Configures IP address / CIDR allowlist for tenant dashboard access:
- **Body**: `{ "ipAllowlist": ["192.168.1.0/24", "203.0.113.50"] }`
- **Requires**: `manage_settings` permission (`admin` or `ps-owner`).

#### `GET /api/settings/data/export`
Exports complete tenant data in structured JSON format for GDPR and DPDP compliance:
- Packages company profile, team members, chatbots, leads, activities, conversations, appointments, and audit logs.
- **Requires**: `manage_settings` permission (`admin` or `ps-owner`).

---

## Multilingual, Voice & Advanced AI Copilot (`/api/chatbots` & `/api/crm`)

### Translation Engine

#### `POST /api/chatbots/translate`
Translates visitor queries or agent responses between supported languages (English, Hindi, Hinglish, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Arabic):
- **Body**:
  ```json
  {
    "text": "3BHK विला की शुरुआती कीमत क्या है?",
    "targetLanguage": "English",
    "sourceLanguage": "Hindi"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "translatedText": "What is the starting price for 3BHK villas?",
      "sourceLanguage": "Hindi",
      "targetLanguage": "English"
    }
  }
  ```
- **Requires**: Authenticated user.

---

### Agency Objection-Handling Playbooks

#### `GET /api/chatbots/playbooks`
Retrieves all objection playbooks belonging to the tenant:
- **Requires**: Authenticated user (`view_chatbots` permission).

#### `GET /api/chatbots/:id/playbooks`
Retrieves objection playbooks specifically scoped or active for a chatbot.
- **Requires**: Authenticated user (`view_chatbots` permission).

#### `POST /api/chatbots/playbooks`
Creates a new objection-handling playbook rule:
- **Body**:
  ```json
  {
    "chatbotId": "optional-uuid",
    "category": "pricing",
    "title": "High Price / Budget Stretch",
    "triggerKeywords": ["expensive", "discount", "price too high", "mehenga"],
    "rebuttalText": "Our pricing reflects private elevator lobbies, Italian marble finishes, and 82% open green landscape.",
    "suggestedAction": "Offer flexible 20:80 milestone construction payment schedule",
    "isActive": true
  }
  ```
- **Requires**: `manage_chatbots` permission.

#### `PUT /api/chatbots/playbooks/:id`
Updates an existing objection-handling playbook.
- **Requires**: `manage_chatbots` permission.

#### `DELETE /api/chatbots/playbooks/:id`
Soft-deletes or removes an objection-handling playbook.
- **Requires**: `manage_chatbots` permission.

---

### Dormant Lead Re-Engagement

#### `POST /api/crm/re-engagement/trigger-sweep`
Triggers an automated dormancy sweep for 1-day, 3-day, 7-day, or 30-day dormant leads:
- Evaluates last interaction timestamps, enforces strict opt-out suppression (`isOptedOut: false`), personalizes message copy with Buyer DNA (budget, unit configuration, locality), and logs dispatch in `re_engagement_logs`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "processedCount": 12,
      "dispatchedCount": 8,
      "skippedOptOutCount": 4,
      "failedCount": 0
    }
  }
  ```
- **Requires**: `edit_leads` permission.

---

### Agent Copilot (Shared Inbox & CRM)

#### `POST /api/crm/leads/:id/copilot/suggest-reply`
Generates 3 strategic AI reply pills for human agents based on current conversation and Buyer DNA:
- **Body**: `{ "conversationId": "optional-uuid", "tone": "warm" }`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "suggestions": [
        {
          "id": "reply-1",
          "title": "Direct Answer",
          "strategy": "Direct Answer & Value Anchor",
          "text": "The starting price for 3BHK residences at Prestige Glenwood begins at ₹2.45 Cr with private patio decks."
        },
        {
          "id": "reply-2",
          "title": "Consultative Deepen",
          "strategy": "Consultative Deepen",
          "text": "Are you evaluating possession timelines for ready move-in, or planning investment for mid-2027?"
        },
        {
          "id": "reply-3",
          "title": "Urgency Hook",
          "strategy": "Urgency & Site Visit CTA",
          "text": "Only 3 club-facing garden units remain in Phase 1. Would 11:30 AM this Saturday work for a private preview?"
        }
      ]
    }
  }
  ```
- **Requires**: `view_leads` permission.

#### `POST /api/crm/leads/:id/copilot/summary`
Synthesizes Buyer DNA and conversation history into an executive brief:
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "leadId": "uuid",
      "leadName": "Vikram Malhotra",
      "intentScore": 85,
      "status": "qualified",
      "summary": "High-intent buyer actively seeking 3BHK luxury residence in Whitefield within ₹2.5 Cr budget.",
      "keyRequirements": ["3BHK residence", "Target location: Whitefield", "Budget: ₹2.4 Cr - ₹2.8 Cr"],
      "statedObjections": ["Evaluating construction milestone vs handover date"],
      "recommendedAction": "Call within 5 minutes to confirm private weekend site visit preview.",
      "generatedAt": "2026-10-12T18:00:00.000Z"
    }
  }
  ```
- **Requires**: `view_leads` permission.

#### `POST /api/crm/leads/:id/copilot/call-script`
Generates a structured 60-second personalized call opener, discovery questions, objection preemption, and closing hook from Buyer DNA:
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "leadId": "uuid",
      "leadName": "Vikram Malhotra",
      "callGoal": "Confirm Saturday morning private site visit",
      "suggestedOpener": "Hi Vikram, I noticed you were exploring 3BHK layouts at Prestige Glenwood...",
      "qualifyingQuestions": [
        "Are you primarily focused on East-facing garden residences?",
        "What is your target possession window?"
      ],
      "talkingPoints": [
        "Exclusive club-facing inventory released this week",
        "Flexible 20:80 milestone construction payment schedule"
      ],
      "objectionPreemptions": [
        {
          "anticipatedObjection": "Pricing feels higher than older resale units nearby",
          "rebuttal": "Resale developments in the micro-market lack 80% open landscaped parks and IGBC Platinum sustainability rating."
        }
      ],
      "closingHook": "Would 11:00 AM this Saturday or 3:00 PM Sunday suit your schedule best?"
    }
  }
  ```
- **Requires**: `view_leads` permission.

#### `POST /api/crm/leads/:id/copilot/rebuttals`
Provides on-demand objection rebuttals using multi-framework angles (Value Reframing, Payment Flexibility, Connectivity):
- **Body**: `{ "objection": "The price is higher than our planned budget" }`
- **Requires**: `view_leads` permission.

---

## AI Guarded Actions & Approvals Queue (`/api/approvals`)

### `GET /api/approvals`
Lists pending proposed T2 actions requiring human manager authorization:
- **Query Parameters**: `page` (default 1), `limit` (default 20)
- **Response**: Array of actions with lead details, contact details, expiration timestamp, and arguments.
- **Requires**: `approve_ai_actions` permission (`company_admin`, `sales_manager`).

### `GET /api/approvals/count`
Returns the count of pending approvals for real-time sidebar badges:
- **Response**: `{ "success": true, "count": 3 }`
- **Requires**: `approve_ai_actions` permission.

### `GET /api/approvals/history`
Returns paginated history of executed, approved, and rejected AI actions:
- **Query Parameters**: `page`, `limit`, `tier` (`T0` | `T1` | `T2` | `T3`)
- **Response**: Action history with approver details, timestamps, and execution results.
- **Requires**: `approve_ai_actions` permission.

### `POST /api/approvals/:id/approve`
Approves and executes a pending proposed T2 action with optional parameter editing:
- **Body**: `{ "editedArgs": { "offered_price": 23500000, "terms": "Updated discount" } }` (optional)
- **Response**: `{ "success": true, "data": { ... } }`
- **Requires**: `approve_ai_actions` permission.

### `POST /api/approvals/:id/reject`
Rejects a proposed T2 action with a required feedback explanation:
- **Body**: `{ "reason": "Unit is under temporary management hold." }`
- **Response**: `{ "success": true, "message": "Action successfully rejected" }`
- **Requires**: `approve_ai_actions` permission.

---

## Outbox & Domain Events Admin (`/api/events`)

### `GET /api/events`
Lists domain events with pagination and filtering:
- **Query Parameters**: `page`, `limit`, `type`, `status` (`all` | `pending` | `processed` | `dead`)
- **Response**: Paginated list of domain events with payload, attempts, errors, and timestamps.
- **Requires**: `manage_settings` permission.

### `POST /api/events/:id/replay`
Replays a failed or dead-letter domain event by clearing its attempts, checkpoints, and dead status:
- **Response**: `{ "success": true, "message": "Event successfully queued for replay" }`
- **Requires**: `manage_settings` permission.

---

## Next Best Action (NBA) (`/api/crm/leads/:id/next-best-action`)

### `POST /api/crm/leads/:id/next-best-action/execute`
Executes the lead's current recommended Next Best Action through the Guarded Actions Framework:
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "actionId": "uuid",
      "status": "executed",
      "tier": "T1",
      "message": "T1 action auto-executed and logged."
    }
  }
  ```
- **Requires**: `write_leads` permission.

---

## Voice Calling & Telephony (`/api/voice`)

### `GET /api/voice/calls`
Lists call records for the tenant with optional lead filtering:
- **Query Parameters**: `leadId` (optional), `status` (optional), `page` (optional), `limit` (optional)
- **Response**: Paginated list of call sessions including direction, duration, status, sentiment, recording URL, transcript, summary, and flags.
- **Requires**: `read_leads` permission.

### `POST /api/voice/calls/manual`
Logs a manual call attempt made by a human agent:
- **Request Body**:
  ```json
  {
    "leadId": "uuid",
    "direction": "outbound_manual",
    "durationSeconds": 180,
    "outcome": "interested",
    "notes": "Discussed 3BHK pricing and payment schedules."
  }
  ```
- **Response**: `{ "success": true, "data": { ...callRecord } }`
- **Requires**: `write_leads` permission.

### `POST /api/voice/calls/outbound`
Initiates an outbound voice call through the telephony provider:
- **Request Body**:
  ```json
  {
    "leadId": "uuid",
    "callerPhone": "+918040001000",
    "destinationPhone": "+919876543210"
  }
  ```
- **Response**: `{ "success": true, "data": { "callSid": "call_123", "sessionId": "vsession_456" } }`
- **Requires**: `write_leads` permission.

### `POST /api/voice/webhooks/status`
Webhook endpoint receiving telephony call lifecycle events (`ringing`, `in_progress`, `completed`, `failed`).

### `POST /api/voice/webhooks/recording`
Webhook endpoint receiving call recording URL and speech-to-text transcript. Analyzes content to update Buyer DNA, intent score, and logs human escalations or DND opt-outs.

### `GET /api/voice/settings`
Retrieves voice calling configuration for the tenant:
- **Response**: `{ "success": true, "data": { "enabled": true, "dailyCallCap": 50, "startHour": 9, "endHour": 20, "callerId": "+918040001000" } }`
- **Requires**: `read_settings` permission.

### `PATCH /api/voice/settings`
Updates voice calling settings (daily caps, allowed hours, caller ID, kill switch).
- **Requires**: `manage_settings` permission.

---

## Model Context Protocol (MCP) (`/api/mcp`)

### `GET /api/mcp/sse`
Establishes a persistent Server-Sent Events (SSE) stream for client-agent MCP sessions:
- **Headers**: `Authorization: Bearer <mcp_api_key>`
- **Response**: SSE event stream sending endpoint URI and session events.

### `POST /api/mcp`
Handles JSON-RPC 2.0 requests per MCP specification (`initialize`, `tools/list`, `tools/call`):
- **Headers**: `Authorization: Bearer <mcp_api_key>`
- **Request Body**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_leads",
      "arguments": { "limit": 10 }
    }
  }
  ```
- **Response**: JSON-RPC 2.0 response format.

### `GET /api/mcp/tools`
Lists all available tools and parameter schemas based on API key permissions:
- **Headers**: `Authorization: Bearer <mcp_api_key>`
- **Response**: Array of MCP tools with name, description, and JSON Schema definitions.

### `POST /api/mcp/tools/:toolName`
Direct REST invocation of an individual MCP tool:
- **Headers**: `Authorization: Bearer <mcp_api_key>`
- **Tools**:
  - `get_leads`: Read leads (`mcp:read`)
  - `get_lead_detail`: Read full lead profile & history (`mcp:read`)
  - `get_pipeline_stats`: Aggregate pipeline metrics (`mcp:read`)
  - `get_inventory`: Search units (`mcp:read`)
  - `get_appointments`: List visits (`mcp:read`)
  - `create_lead_note`: Write note (`mcp:write`, Guarded Action T1)
  - `update_lead_status`: Update stage (`mcp:write`, Guarded Action T1)
  - `schedule_appointment`: Book site visit (`mcp:write`, Guarded Action T2)
  - `send_payment_link`: Send booking deposit link (`mcp:write`, Guarded Action T2)

---

## Enterprise Security, SSO & Compliance (`/api/enterprise`, `/api/status`)

### `GET /api/enterprise/sso`
Retrieves enterprise SAML 2.0 or OIDC configuration:
- **Requires**: `manage_settings` permission.

### `PUT /api/enterprise/sso`
Configures enterprise SSO and domain mapping:
- **Request Body**:
  ```json
  {
    "ssoProvider": "okta",
    "domain": "enterprise.com",
    "issuer": "https://identity.enterprise.com",
    "ssoUrl": "https://identity.enterprise.com/sso/saml",
    "certificate": "-----BEGIN CERTIFICATE-----\n...",
    "enforceForDomain": true,
    "isActive": true
  }
  ```
- **Requires**: `manage_settings` permission.

### `POST /api/enterprise/sso/saml/login`
Initiates SAML 2.0 login redirect URL based on corporate email domain.

### `POST /api/enterprise/sso/saml/acs`
Assertion Consumer Service (ACS) endpoint processing SAML assertions and issuing JWT tokens.

### `GET /api/enterprise/sso/oidc/callback`
OIDC callback endpoint processing OAuth authorization codes.

### `POST /api/enterprise/keys/rotate`
Rotates an API key with a 24-hour overlapping grace window:
- **Request Body**: `{ "apiKeyId": "uuid" }`
- **Response**: `{ "success": true, "data": { "newApiKey": "pb_live_...", "gracePeriodEndsAt": "ISOString" } }`
- **Requires**: `manage_settings` permission.

### `GET /api/enterprise/ip-allowlist`
Retrieves configured IP allowlist CIDR blocks.
- **Requires**: `manage_settings` permission.

### `PUT /api/enterprise/ip-allowlist`
Updates allowed CIDR IP blocks.
- **Requires**: `manage_settings` permission.

### `GET /api/enterprise/compliance/audit-export`
Exports tenant audit logs with SHA-256 cryptographic hash:
- **Query Parameters**: `format` (`csv` | `json`), `startDate`, `endDate`
- **Requires**: `manage_settings` permission.

### `GET /api/enterprise/compliance/security-pack`
Generates SOC 2 Type II and ISO 27001 readiness questionnaire answers pack.
- **Requires**: `manage_settings` permission.

### `GET /api/status/uptime`
Public SLA and uptime monitoring endpoint (no authentication required):
- **Response**:
  ```json
  {
    "status": "operational",
    "updatedAt": "ISOString",
    "sla": { "target": "99.9%", "currentMonthUptime": 99.98 },
    "components": [
      { "name": "API Gateway", "status": "operational", "latencyMs": 14 },
      { "name": "PostgreSQL & Vector Store", "status": "operational", "latencyMs": 8 },
      { "name": "Redis Outbox & Caching", "status": "operational", "latencyMs": 3 },
      { "name": "Telephony & Voice Provider", "status": "operational", "latencyMs": 42 },
      { "name": "WhatsApp Cloud API", "status": "operational", "latencyMs": 35 }
    ],
    "incidents": []
  }
  ```




