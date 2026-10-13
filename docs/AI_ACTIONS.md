# PropBot Pro — AI Guarded Actions & Safety Framework

To ensure enterprise safety and eliminate unauthorized commitments in real estate sales conversations, PropBot Pro implements a **Four-Tier Guarded Action Framework** enforced by `apps/api/src/modules/ai/guarded-actions.service.ts`.

---

## 1. Action Permission Tiers (T0 – T3)

Every tool or action an AI assistant can invoke is assigned a permission tier:

```
+----------------------------------------------------------------------------------+
|                                T0: READ-ONLY                                     |
|  Status: AUTO-EXECUTED                                                           |
|  - Search available project inventory & floor plans                              |
|  - Retrieve verified project brochures & amenities                              |
|  - Query real-time site visit available calendar slots                           |
|  - Calculate estimated loan EMI based on public formulas                         |
+----------------------------------------------------------------------------------+
                                        |
+----------------------------------------------------------------------------------+
|                         T1: REVERSIBLE / INFORMATIONAL                           |
|  Status: AUTO-EXECUTED WITH AUDIT LOG                                            |
|  - Update Buyer DNA preferences (BHK, preferred locality)                        |
|  - Attach lead tag (e.g., "NRI Investor", "First-Time Buyer")                   |
|  - Log conversation summary note to CRM lead profile                             |
+----------------------------------------------------------------------------------+
                                        |
+----------------------------------------------------------------------------------+
|                            T2: HIGH BUSINESS IMPACT                              |
|  Status: HELD FOR HUMAN APPROVAL                                                 |
|  - Book and confirm site visit appointment with senior consultant                |
|  - Reassign high-intent lead to VIP closing team                                 |
|  - Modify buyer verified budget ceiling or financing pre-qualification status    |
|  - Send custom incentive brochure                                                |
+----------------------------------------------------------------------------------+
                                        |
+----------------------------------------------------------------------------------+
|                           T3: PROHIBITED / FINANCIAL                             |
|  Status: STRICTLY BLOCKED                                                        |
|  - Offer custom price discounts or waive registration fees                       |
|  - Guarantee possession or completion dates without developer sign-off           |
|  - Promise guaranteed rental yields or investment returns                        |
|  - Issue legal warranties, RERA exemptions, or title indemnities                 |
+----------------------------------------------------------------------------------+
```

---

## 2. Guarded Action Lifecycle & Approval Queue

When an AI model suggests a **Tier 2** action:

```
[AI Model Tool Call] ---> [executeAgentAction()]
                                  |
                +-----------------+-----------------+
                |                                   |
           Tier 0 / Tier 1                        Tier 2
                |                                   |
         [Auto-Execute]                     [Persist in agent_actions]
                |                                Status: 'held'
                v                                   |
         [Return to Bot]                            v
                                         [Notify Sales Manager]
                                         (Dashboard & Webhook)
                                                    |
                                    +---------------+---------------+
                                    |                               |
                              [Approve Action]              [Reject Action]
                                    |                               |
                           [Execute Action]               [Notify AI / Lead]
                            Status: 'approved'            Status: 'rejected'
```

### Reviewing Actions in Dashboard
1. Sales managers navigate to **AI Control -> Approvals**.
2. Each item displays:
   - Target Lead Name & Intent Score
   - Requested Action Name & Proposed Parameters
   - AI Reasoning & Conversation Context
3. One-click **Approve** executes the operation immediately (e.g., confirms the visit in the calendar).

---

## 3. Emergency AI Kill Switch

Every chatbot includes an immediate **Kill Switch** (`aiKillSwitchActive`):

- **Activation**: Via Dashboard toggle or `PATCH /api/chatbots/:id` with `{ "aiKillSwitchActive": true }`.
- **Immediate Effect**:
  1. `executeAgentAction()` immediately throws `AI_KILL_SWITCH_ACTIVE`.
  2. Generative tool calls are halted instantly.
  3. The chatbot displays a courteous fallback:
     > *"Our automated property advisor is currently undergoing scheduled maintenance. Please enter your contact number or email, and a senior consultant will assist you directly."*
  4. Visitor contact capture continues operating safely.

---

## 4. Operational Safety Limits & Expiration

1. **Daily Action Cap**:
   - Configured per tenant in `company_ai_settings.daily_action_cap` (default: 100).
   - Once total actions for the current calendar day reach the cap, further automated actions are blocked with `status: 'blocked'`.
2. **Per-Lead Rate Limiting**:
   - Caps automated AI actions per individual lead at a maximum of **10 actions per rolling 24-hour window**.
   - Prevents looping agents or runaway automations from overwhelming prospective buyers.
3. **48-Hour Proposed Action Expiration**:
   - Proposed T2 actions are assigned an expiration timestamp `expires_at = now() + 48 hours`.
   - Stale actions that remain unapproved after 48 hours automatically transition to `status: 'expired'` via the background worker sweep (`scheduledJobsService.expireStaleApprovals()`).
4. **Parameter Editing & Feedback Upon Review**:
   - Authorized managers (`approve_ai_actions` permission) can modify action parameters before approving (e.g. adjust proposed discount or payment terms).
   - Rejections require an explicit explanation (`reason`), which is permanently stored in the action result audit trail.

---

## 5. Audit Log & Record Keeping

All action evaluations (including blocked Tier 3 attempts, auto-executed Tier 1 actions, and human-reviewed Tier 2 proposals) are recorded in the `agent_actions` audit table with:
- `company_id`: Tenant context
- `lead_id`: Targeted buyer
- `agent_name`: Source assistant / copilot
- `action_type`: Tool identifier
- `tier`: `T0`, `T1`, `T2`, or `T3`
- `status`: `executed`, `proposed`, `approved`, `rejected`, `expired`, or `blocked`
- `args`: Arguments supplied by the agent or edited by the approving manager
- `result`: Execution payload or rejection reason
- `expires_at`: 48h expiration timestamp for proposed actions
- `created_at` & `updated_at`: Exact UTC timestamps

