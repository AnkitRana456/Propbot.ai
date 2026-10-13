# PropBot Pro — Domain Events & Outbox Catalog

PropBot Pro relies on a **Transactional Outbox Pattern** to decouple database state changes from asynchronous side effects (webhooks, email/WhatsApp notifications, analytics rollups, and visual workflow triggers).

---

## 1. Outbox Architecture & Guarantees

Every business mutation writes a domain event to the `domain_events` table inside the **same database transaction** as the primary record update:

```
[API Route Handler]
       |
       v
[db.transaction(async (tx) => { ... })]
       |
       +---> Insert / Update Entity (e.g. leads, appointments)
       +---> Insert Row into domain_events
       |
[Transaction Commits Atomically]
       |
       v
[BullMQ Outbox Poller / Worker]
       |
       +---> Webhook Outbox Dispatcher (Signed HMAC POST)
       +---> Lead Notification Consumer (WhatsApp / Email)
       +---> Analytics Rollup Consumer
       +---> Visual Workflow Engine Consumer
```

### Guarantees
- **At-least-once delivery**: Outbox workers mark events processed only after successful dispatch.
- **Strict ordering per aggregate**: Events for the same lead or appointment maintain causal order.
- **Resilience**: Even if Redis or downstream webhooks are temporarily offline, no events are lost because they are safely stored in PostgreSQL.

---

## 2. Event Envelope Schema

Every domain event matches the following Zod-validated schema:

```json
{
  "id": "evt_01J9...",
  "companyId": "comp_1234",
  "eventType": "lead.qualified",
  "aggregateType": "lead",
  "aggregateId": "lead_5678",
  "payload": {
    "leadId": "lead_5678",
    "name": "Arjun Sharma",
    "phone": "+919876543210",
    "intentScore": 85,
    "buyerDna": {
      "budgetRange": "1.5 - 2 Cr",
      "bhk": "3 BHK",
      "timeline": "Immediate"
    }
  },
  "metadata": {
    "correlationId": "req_abc123",
    "source": "widget_chat",
    "chatbotId": "bot_99"
  },
  "createdAt": "2026-10-13T12:00:00.000Z",
  "processedAt": null
}
```

---

## 3. Complete Domain Event Catalog

### Lead Lifecycle Events
| Event Type | Trigger | Key Payload Attributes |
|---|---|---|
| `lead.created` | New contact captured via Chatbot or WhatsApp | `leadId`, `name`, `phone`, `email`, `source` |
| `lead.qualified` | Visitor completes qualification playbook | `leadId`, `intentScore`, `buyerDna`, `projectInterest` |
| `lead.intent_score_changed` | Visitor demonstrates high engagement | `leadId`, `previousScore`, `newScore`, `reason` |
| `lead.assigned` | Lead routed to a sales agent | `leadId`, `assignedAgentId`, `assignedAgentName` |
| `lead.stage_changed` | Pipeline stage updated (e.g., to Negotiation) | `leadId`, `previousStage`, `newStage` |

### Appointment & Site Visit Events
| Event Type | Trigger | Key Payload Attributes |
|---|---|---|
| `appointment.requested` | Visitor requests site visit via chat | `appointmentId`, `leadId`, `projectId`, `requestedSlot` |
| `appointment.confirmed` | Visit confirmed with sales agent | `appointmentId`, `leadId`, `assignedAgentId`, `scheduledAt` |
| `appointment.rescheduled` | Visit time modified | `appointmentId`, `oldTime`, `newTime` |
| `appointment.cancelled` | Visit cancelled by buyer or agent | `appointmentId`, `reason` |

### Conversation & Shortlist Events
| Event Type | Trigger | Key Payload Attributes |
|---|---|---|
| `conversation.started` | Visitor sends first message | `conversationId`, `chatbotId`, `visitorId`, `channel` |
| `conversation.completed` | Visitor closes chat or session times out | `conversationId`, `messageCount`, `durationSeconds` |
| `shortlist.viewed` | Buyer opens Shortlist Room link | `shortlistId`, `leadId`, `openedAt` |
| `shortlist.unit_favorited` | Buyer bookmarks a specific unit card | `shortlistId`, `leadId`, `unitId` |

---

## 4. Consumer Subsystems & Fan-out Matrix

The outbox dispatcher leverages `SELECT ... FOR UPDATE SKIP LOCKED` inside an atomic transaction to claim batches without locking collisions across concurrent workers:

```
[domain_events (PostgreSQL Outbox)]
              |
              v (SELECT ... FOR UPDATE SKIP LOCKED)
   [Outbox Dispatcher Service]
              |
    +---------+---------+-------------------+
    |                   |                   |
    v                   v                   v
[webhooks]        [notifications]    [next-best-action]
    |                   |                   |
    +---------+---------+-------------------+
              |
              v (Records Checkpoint)
[event_consumer_checkpoints] (eventId, consumerName)
```

1. **Webhook Outbox Consumer (`webhooks`)**:
   - Matches `eventType` against tenant endpoint subscriptions.
   - Computes HMAC-SHA256 signature in `X-PropBot-Signature`.
   - Sends HTTP POST with 5-second timeout and 5 retry attempts.
2. **Notification Consumer (`notifications`)**:
   - Triggers alerts for `lead_hot`, `handoff_requested`, and `visit_booked` to company administrators.
3. **Next Best Action Consumer (`next-best-action`)**:
   - Evaluates Buyer DNA and intent changes on `lead_hot`, `visit_booked`, `room_viewed`, and `intent_changed`.
   - Dynamically updates `leads.next_best_action` with context-grounded recommendations.
4. **Idempotency & Checkpointing**:
   - Table `event_consumer_checkpoints` stores unique `(event_id, consumer_name)`.
   - If an individual consumer fails, already-completed consumers are NOT re-executed upon retry.
5. **Dead-Letter Parking & Admin Replay**:
   - If an event fails 5 consecutive times across attempts, it is parked with `is_dead = true`.
   - Admins can inspect dead events via `GET /api/events?status=dead` and trigger instant replay via `POST /api/events/:id/replay`, which clears checkpoints and resets the event for dispatch.

