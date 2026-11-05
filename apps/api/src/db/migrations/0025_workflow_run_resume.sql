-- Migration 0025: Workflow wait steps pause a run and resume it later.
-- Also moves the two seeded workflows onto the node format the engine reads;
-- the "trigger" key only exists on the old format, so edited workflows are left alone.

ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "resume_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "workflow_runs_resume_idx"
  ON "workflow_runs" ("status", "resume_at");

UPDATE "workflows"
   SET "definition" = '{
     "nodes": [
       {"id": "node-trigger", "type": "trigger", "label": "New Lead Created", "config": {"event_type": "lead_created"}},
       {"id": "node-action-wa", "type": "action", "label": "Send WhatsApp Welcome & Brochure", "config": {"action_kind": "send_whatsapp", "parameters": {"templateName": "prestige_welcome_brochure"}}},
       {"id": "node-delay", "type": "action", "label": "Wait 15 Minutes", "config": {"action_kind": "wait", "parameters": {"hours": 0.25}}},
       {"id": "node-cond", "type": "condition", "label": "Intent Score >= 75?", "config": {"field": "intent_score", "operator": "greater_than", "value": 74}},
       {"id": "node-assign", "type": "action", "label": "Assign Senior Property Advisor", "config": {"action_kind": "assign_agent", "parameters": {}}}
     ],
     "edges": [
       {"id": "e1", "source": "node-trigger", "target": "node-action-wa"},
       {"id": "e2", "source": "node-action-wa", "target": "node-delay"},
       {"id": "e3", "source": "node-delay", "target": "node-cond"},
       {"id": "e4", "source": "node-cond", "target": "node-assign"}
     ]
   }'::jsonb,
       "updated_at" = now()
 WHERE "name" = 'Instant Lead WhatsApp Qualification & Brochure Delivery'
   AND "definition"->'trigger' IS NOT NULL;

UPDATE "workflows"
   SET "description" = 'Waits 24 hours after a site visit is booked, then sends the location pin and proposes a guarded token booking link.',
       "definition" = '{
     "nodes": [
       {"id": "node-trigger", "type": "trigger", "label": "Site Visit Booked", "config": {"event_type": "visit_booked"}},
       {"id": "node-delay", "type": "action", "label": "Wait 24 Hours", "config": {"action_kind": "wait", "parameters": {"hours": 24}}},
       {"id": "node-send-pin", "type": "action", "label": "Send Location Pin & Gate Pass", "config": {"action_kind": "send_whatsapp", "parameters": {"templateName": "site_visit_gate_pass"}}},
       {"id": "node-token-link", "type": "action", "label": "Generate Guarded Token Booking Link", "config": {"action_kind": "send_payment_link", "parameters": {}}}
     ],
     "edges": [
       {"id": "e1", "source": "node-trigger", "target": "node-delay"},
       {"id": "e2", "source": "node-delay", "target": "node-send-pin"},
       {"id": "e3", "source": "node-send-pin", "target": "node-token-link"}
     ]
   }'::jsonb,
       "updated_at" = now()
 WHERE "name" = 'VIP Site Visit Reminder & Guarded Token Booking Link'
   AND "definition"->'trigger' IS NOT NULL;
