-- Migration 0020: schema for roadmap phases P2-P8 in one batch (tools, flows, omnichannel, voice, data &
-- intelligence, enterprise controls, payments). PostgreSQL only. Purely additive: new tables, new nullable /
-- defaulted columns on a few existing tables, indexes and tenant row-level-security. No data is modified or removed.
-- Later phases may add small follow-up migrations of the same additive kind.

-- =============================================================================================
-- P2  TOOLS (GPT tools + API tools) and their run log
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "key" varchar(80) NOT NULL,
  "name" varchar(150) NOT NULL,
  "description" text,
  "type" varchar(20) NOT NULL,                       -- gpt | api
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,       -- gpt: prompt, model; api: method, url template, headers, body template, response mapping
  "input_schema" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "output_schema" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "secret_ref" varchar(120),                         -- name of the vaulted credential used by an API tool
  "requires_approval" boolean NOT NULL DEFAULT false,
  "rate_limit_per_min" integer NOT NULL DEFAULT 30,
  "status" varchar(20) NOT NULL DEFAULT 'active',    -- active | disabled
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "tools_company_key_uniq" ON "tools" ("company_id", "key") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "tool_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "tool_id" uuid REFERENCES "tools"("id") ON DELETE SET NULL,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  "flow_execution_id" uuid,                          -- FK added after flow_executions exists
  "status" varchar(24) NOT NULL DEFAULT 'ok',        -- ok | error | blocked | pending_approval
  "input" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "output" jsonb,
  "error" text,
  "duration_ms" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "tool_runs_company_created_idx" ON "tool_runs" ("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "tool_runs_tool_idx" ON "tool_runs" ("tool_id", "created_at" DESC);

-- =============================================================================================
-- P3  FLOWS (visual automation): flows, versions, triggers, executions, step trace
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "flows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "description" text,
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "template" varchar(60),
  "status" varchar(20) NOT NULL DEFAULT 'active',    -- active | archived
  "active_version_id" uuid,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "flows_company_name_uniq" ON "flows" ("company_id", lower("name")) WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "flow_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',     -- draft | published | archived
  "graph" jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,     -- max steps, timeouts, error policy
  "change_note" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_versions_flow_version_uniq" ON "flow_versions" ("flow_id", "version");
ALTER TABLE "flows" ADD CONSTRAINT "flows_active_version_fk"
  FOREIGN KEY ("active_version_id") REFERENCES "flow_versions"("id") ON DELETE SET NULL;

-- Published entry points, indexed so an incoming event finds its flows without scanning graphs
CREATE TABLE IF NOT EXISTS "flow_triggers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "flow_version_id" uuid NOT NULL REFERENCES "flow_versions"("id") ON DELETE CASCADE,
  "node_id" varchar(80) NOT NULL,                    -- entry-point node inside the graph
  "trigger_type" varchar(40) NOT NULL,               -- inbound_message | new_lead | lead_stage_changed | visit_booked | visit_missed | form_submitted | schedule | webhook | no_reply
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "channel" varchar(30),
  "is_active" boolean NOT NULL DEFAULT true,
  "next_run_at" timestamp with time zone,            -- for schedule triggers
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "flow_triggers_lookup_idx" ON "flow_triggers" ("company_id", "trigger_type") WHERE "is_active";
CREATE INDEX IF NOT EXISTS "flow_triggers_schedule_idx" ON "flow_triggers" ("next_run_at") WHERE "is_active" AND "next_run_at" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "flow_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "flow_version_id" uuid NOT NULL REFERENCES "flow_versions"("id") ON DELETE CASCADE,
  "trigger_type" varchar(40) NOT NULL,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  "status" varchar(20) NOT NULL DEFAULT 'running',   -- running | waiting | completed | failed | cancelled
  "variables" jsonb NOT NULL DEFAULT '{}'::jsonb,    -- flow / execution / session scoped values
  "current_node" varchar(80),
  "resume_at" timestamp with time zone,              -- wait steps
  "is_test" boolean NOT NULL DEFAULT false,
  "error" text,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "flow_executions_company_started_idx" ON "flow_executions" ("company_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "flow_executions_flow_idx" ON "flow_executions" ("flow_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "flow_executions_resume_idx" ON "flow_executions" ("resume_at") WHERE "status" = 'waiting';
CREATE INDEX IF NOT EXISTS "flow_executions_conversation_idx" ON "flow_executions" ("conversation_id");

CREATE TABLE IF NOT EXISTS "flow_step_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "execution_id" uuid NOT NULL REFERENCES "flow_executions"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "node_id" varchar(80) NOT NULL,
  "node_type" varchar(40) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ok',        -- ok | error | skipped | waiting
  "input" jsonb,
  "output" jsonb,
  "error" text,
  "tokens" integer NOT NULL DEFAULT 0,
  "duration_ms" integer,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "flow_step_runs_execution_idx" ON "flow_step_runs" ("execution_id", "started_at");

ALTER TABLE "tool_runs" ADD CONSTRAINT "tool_runs_flow_execution_fk"
  FOREIGN KEY ("flow_execution_id") REFERENCES "flow_executions"("id") ON DELETE SET NULL;

-- =============================================================================================
-- P4  OMNICHANNEL: identities, channel connections, lead sources, inbox fields, templates, widgets
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "contact_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "channel" varchar(30) NOT NULL,                    -- whatsapp | instagram | messenger | email | web | voice
  "external_id" varchar(255) NOT NULL,               -- wa_id, IGSID, PSID, e-mail address ...
  "handle" varchar(255),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_identities_channel_ext_uniq" ON "contact_identities" ("company_id", "channel", "external_id");
CREATE INDEX IF NOT EXISTS "contact_identities_contact_idx" ON "contact_identities" ("contact_id");

CREATE TABLE IF NOT EXISTS "channel_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "channel" varchar(30) NOT NULL,                    -- instagram | messenger | email | whatsapp | api
  "name" varchar(150) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',   -- pending | connected | error | disconnected
  "external_account_id" varchar(255),                -- page id, IG business id, mailbox address
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,       -- non-secret settings
  "secrets" jsonb NOT NULL DEFAULT '{}'::jsonb,      -- vault-encrypted tokens (same envelope as integrations)
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE SET NULL,
  "last_error" text,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "channel_connections_account_uniq" ON "channel_connections" ("channel", "external_account_id") WHERE "external_account_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "channel_connections_company_idx" ON "channel_connections" ("company_id", "channel");

CREATE TABLE IF NOT EXISTS "lead_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "source_type" varchar(30) NOT NULL DEFAULT 'generic',  -- generic | meta_lead_ads | google_ads | 99acres | magicbricks | housing | csv
  "api_key_prefix" varchar(16) NOT NULL,
  "api_key_hash" varchar(128) NOT NULL,
  "field_mapping" jsonb NOT NULL DEFAULT '{}'::jsonb,    -- incoming field -> lead field / form attribute
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE SET NULL,
  "form_id" uuid REFERENCES "forms"("id") ON DELETE SET NULL,
  "attribution" jsonb NOT NULL DEFAULT '{}'::jsonb,      -- default utm_* / agency partner
  "is_active" boolean NOT NULL DEFAULT true,
  "total_received" integer NOT NULL DEFAULT 0,
  "last_received_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "lead_sources_key_prefix_uniq" ON "lead_sources" ("api_key_prefix");
CREATE INDEX IF NOT EXISTS "lead_sources_company_idx" ON "lead_sources" ("company_id");

CREATE TABLE IF NOT EXISTS "lead_source_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "lead_source_id" uuid NOT NULL REFERENCES "lead_sources"("id") ON DELETE CASCADE,
  "payload" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'received',  -- received | processed | duplicate | rejected | failed
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_source_events_source_created_idx" ON "lead_source_events" ("lead_source_id", "created_at" DESC);

-- Inbox fields on conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "priority" varchar(12) NOT NULL DEFAULT 'normal';   -- low | normal | high | urgent
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "identity_id" uuid REFERENCES "contact_identities"("id") ON DELETE SET NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "last_message_at" timestamp with time zone;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "first_response_at" timestamp with time zone;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "unread_count" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "conversations_inbox_idx" ON "conversations" ("company_id", "status", "last_message_at" DESC);

CREATE TABLE IF NOT EXISTS "conversation_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "mentions" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "conversation_notes_conversation_idx" ON "conversation_notes" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "channel" varchar(30) NOT NULL DEFAULT 'whatsapp',
  "name" varchar(120) NOT NULL,                      -- Meta template name (lowercase, underscores)
  "language" varchar(12) NOT NULL DEFAULT 'en',
  "category" varchar(20) NOT NULL DEFAULT 'utility', -- marketing | utility | authentication
  "components" jsonb NOT NULL DEFAULT '[]'::jsonb,   -- header, body (with {{n}} variables), footer, buttons
  "sample_values" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" varchar(20) NOT NULL DEFAULT 'draft',     -- draft | pending | approved | rejected | paused
  "provider_template_id" varchar(120),
  "rejection_reason" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_name_lang_uniq" ON "message_templates" ("company_id", "channel", "name", "language") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "widgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE SET NULL,
  "name" varchar(150) NOT NULL,
  "allowed_domains" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "styling" jsonb NOT NULL DEFAULT '{}'::jsonb,      -- brand colour, launcher, spacing, theme
  "sections" jsonb NOT NULL DEFAULT '{}'::jsonb,     -- home / conversations / help centre toggles + content
  "nudges" jsonb NOT NULL DEFAULT '[]'::jsonb,       -- proactive prompts by URL pattern / delay
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "widgets_company_idx" ON "widgets" ("company_id");

-- =============================================================================================
-- P5  VOICE: agents, numbers, call timeline, outbound campaigns, do-not-disturb
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "voice_agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,   -- the brain; this row is the voice persona
  "name" varchar(150) NOT NULL,
  "voice" jsonb NOT NULL DEFAULT '{}'::jsonb,        -- provider, voice id, language, accent, speed, pitch
  "greeting" text,
  "closing" text,
  "escalation_rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "recording_consent_script" text,
  "max_call_seconds" integer NOT NULL DEFAULT 600,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "phone_numbers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "provider" varchar(30) NOT NULL,                   -- plivo | exotel | twilio
  "number" varchar(32) NOT NULL,
  "voice_agent_id" uuid REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "direction" varchar(12) NOT NULL DEFAULT 'both',   -- inbound | outbound | both
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "provider_ref" varchar(120),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "phone_numbers_number_uniq" ON "phone_numbers" ("provider", "number");

ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "voice_agent_id" uuid REFERENCES "voice_agents"("id") ON DELETE SET NULL;
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "campaign_id" uuid;
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "outcome" varchar(30);        -- connected | voicemail | no_answer | qualified | visit_booked | not_interested | dnd
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "language" varchar(12);
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "sentiment_score" numeric(4,3);
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "recording_consent" boolean;
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "call_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "call_id" uuid NOT NULL REFERENCES "voice_calls"("id") ON DELETE CASCADE,
  "type" varchar(30) NOT NULL,                       -- utterance | sentiment | keyword | transfer | tool | dtmf | error
  "speaker" varchar(12),                             -- caller | agent | human
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "offset_ms" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "call_events_call_idx" ON "call_events" ("call_id", "offset_ms");

CREATE TABLE IF NOT EXISTS "call_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "voice_agent_id" uuid NOT NULL REFERENCES "voice_agents"("id") ON DELETE RESTRICT,
  "segment_id" uuid REFERENCES "segments"("id") ON DELETE SET NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',     -- draft | scheduled | running | paused | completed | cancelled
  "calling_window" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- days, start/end local time, timezone
  "retry_policy" jsonb NOT NULL DEFAULT '{}'::jsonb,     -- max attempts, gap between attempts
  "concurrency" integer NOT NULL DEFAULT 3,
  "stats" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "starts_at" timestamp with time zone,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_campaign_fk"
  FOREIGN KEY ("campaign_id") REFERENCES "call_campaigns"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "call_campaign_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "call_campaigns"("id") ON DELETE CASCADE,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "phone" varchar(32) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',   -- pending | calling | done | failed | skipped_dnd | skipped_no_consent
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "outcome" varchar(30),
  "call_id" uuid REFERENCES "voice_calls"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "call_campaign_targets_phone_uniq" ON "call_campaign_targets" ("campaign_id", "phone");
CREATE INDEX IF NOT EXISTS "call_campaign_targets_due_idx" ON "call_campaign_targets" ("next_attempt_at") WHERE "status" = 'pending';

CREATE TABLE IF NOT EXISTS "dnd_numbers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "phone" varchar(32) NOT NULL,
  "reason" varchar(60) NOT NULL DEFAULT 'requested',  -- requested | regulator_list | imported
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "dnd_numbers_company_phone_uniq" ON "dnd_numbers" ("company_id", "phone");

-- =============================================================================================
-- P6  DATA & INTELLIGENCE: OAuth connections, KB tests, tags, groups, insights, surveys, dashboards, boards
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "oauth_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "provider" varchar(30) NOT NULL,                   -- google | slack | zoho | hubspot
  "account_label" varchar(255),                      -- e.g. the Google account e-mail
  "scopes" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "tokens" jsonb NOT NULL DEFAULT '{}'::jsonb,       -- vault-encrypted access / refresh tokens
  "status" varchar(20) NOT NULL DEFAULT 'connected', -- connected | expired | revoked | error
  "expires_at" timestamp with time zone,
  "last_error" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "oauth_connections_company_provider_idx" ON "oauth_connections" ("company_id", "provider");

ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "connection_id" uuid REFERENCES "oauth_connections"("id") ON DELETE SET NULL;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "sync_schedule" varchar(20);   -- manual | hourly | daily
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "kb_test_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "results" jsonb NOT NULL DEFAULT '[]'::jsonb,      -- retrieved chunks with match scores
  "best_score" numeric(5,4),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "kb_test_runs_company_idx" ON "kb_test_runs" ("company_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(60) NOT NULL,
  "color" varchar(9) NOT NULL DEFAULT '#64748b',
  "entity_type" varchar(20) NOT NULL DEFAULT 'lead',    -- lead | contact | conversation
  "auto_rule" jsonb,                                    -- optional rule that applies the tag automatically
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "tags_company_name_uniq" ON "tags" ("company_id", "entity_type", lower("name"));

CREATE TABLE IF NOT EXISTS "taggings" (
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "entity_type" varchar(20) NOT NULL,
  "entity_id" uuid NOT NULL,
  "source" varchar(12) NOT NULL DEFAULT 'manual',        -- manual | ai | rule
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("tag_id", "entity_type", "entity_id")
);
CREATE INDEX IF NOT EXISTS "taggings_entity_idx" ON "taggings" ("company_id", "entity_type", "entity_id");

-- Dynamic user groups build on the existing segments table
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "is_dynamic" boolean NOT NULL DEFAULT true;
ALTER TABLE "segments" ADD COLUMN IF NOT EXISTS "refreshed_at" timestamp with time zone;
CREATE TABLE IF NOT EXISTS "segment_members" (
  "segment_id" uuid NOT NULL REFERENCES "segments"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "added_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("segment_id", "contact_id")
);
CREATE INDEX IF NOT EXISTS "segment_members_contact_idx" ON "segment_members" ("contact_id");

CREATE TABLE IF NOT EXISTS "conversation_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "summary" text,
  "intent" varchar(40),                              -- price_enquiry | site_visit | loan | resale | rental | complaint | broker | other
  "labels" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "sentiment" varchar(12),                           -- positive | neutral | negative
  "sentiment_score" numeric(4,3),
  "model" varchar(80),
  "generated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_insights_conv_uniq" ON "conversation_insights" ("conversation_id");
CREATE INDEX IF NOT EXISTS "conversation_insights_company_idx" ON "conversation_insights" ("company_id", "generated_at" DESC);

CREATE TABLE IF NOT EXISTS "surveys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "kind" varchar(12) NOT NULL DEFAULT 'csat',        -- csat | nps | custom
  "form_id" uuid REFERENCES "forms"("id") ON DELETE SET NULL,
  "trigger" jsonb NOT NULL DEFAULT '{}'::jsonb,      -- e.g. { event: "visit_completed", delayMinutes: 120 }
  "channel" varchar(30) NOT NULL DEFAULT 'whatsapp',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "survey_id" uuid NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  "appointment_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL,
  "score" integer,
  "is_estimated" boolean NOT NULL DEFAULT false,     -- AI-inferred when the visitor dropped off
  "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "survey_responses_survey_idx" ON "survey_responses" ("survey_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "dashboards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "description" text,
  "is_shared" boolean NOT NULL DEFAULT false,
  "is_starred" boolean NOT NULL DEFAULT false,
  "schedule" jsonb,                                  -- optional e-mail report schedule
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dashboard_id" uuid NOT NULL REFERENCES "dashboards"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "type" varchar(20) NOT NULL,                       -- line | bar | donut | kpi | funnel | table
  "title" varchar(150) NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,       -- metric key, filters, group-by, date range
  "layout" jsonb NOT NULL DEFAULT '{}'::jsonb,       -- x, y, w, h
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "dashboard_widgets_dashboard_idx" ON "dashboard_widgets" ("dashboard_id");

CREATE TABLE IF NOT EXISTS "boards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "description" text,
  "form_id" uuid REFERENCES "forms"("id") ON DELETE SET NULL,
  "columns" jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{ key, label, color }]
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "board_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "board_id" uuid NOT NULL REFERENCES "boards"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "column_key" varchar(60) NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "assignee_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_at" timestamp with time zone,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,         -- values of the board's form
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "board_tasks_board_column_idx" ON "board_tasks" ("board_id", "column_key", "position");
CREATE TABLE IF NOT EXISTS "board_task_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "task_id" uuid NOT NULL REFERENCES "board_tasks"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- =============================================================================================
-- P7  ENTERPRISE CONTROLS: teams, policies, access logs, API keys, notification rules, usage metering, privacy
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "description" text,
  "lead_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "teams_company_name_uniq" ON "teams" ("company_id", lower("name"));
CREATE TABLE IF NOT EXISTS "team_members" (
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  PRIMARY KEY ("team_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "description" text,
  "rules" jsonb NOT NULL DEFAULT '[]'::jsonb,        -- [{ module, actions: [view|add|change|delete], conditions }]
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "policies_company_name_uniq" ON "policies" ("company_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE TABLE IF NOT EXISTS "policy_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "policy_id" uuid NOT NULL REFERENCES "policies"("id") ON DELETE CASCADE,
  "subject_type" varchar(12) NOT NULL,               -- user | role | team | api_key
  "subject_id" varchar(80) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "policy_assignments_uniq" ON "policy_assignments" ("policy_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "policy_assignments_subject_idx" ON "policy_assignments" ("company_id", "subject_type", "subject_id");
CREATE TABLE IF NOT EXISTS "policy_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "policy_id" uuid REFERENCES "policies"("id") ON DELETE SET NULL,
  "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(30) NOT NULL,                     -- created | updated | deleted | assigned | unassigned
  "change" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "access_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE SET NULL,
  "action" varchar(30) NOT NULL,                     -- view | export | download | search | login
  "resource_type" varchar(40) NOT NULL,
  "resource_id" varchar(80),
  "ip_address" varchar(64),
  "user_agent" varchar(300),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "access_logs_company_created_idx" ON "access_logs" ("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "access_logs_user_idx" ON "access_logs" ("user_id", "created_at" DESC);

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "usage_count" bigint NOT NULL DEFAULT 0;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "notification_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,   -- NULL = company-wide default
  "event_type" varchar(60) NOT NULL,                 -- hot_lead | handoff_requested | visit_booked | sla_breach | webhook_failed ...
  "channels" text[] NOT NULL DEFAULT ARRAY['in_app']::text[],  -- in_app | email | whatsapp | slack
  "conditions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notification_rules_lookup_idx" ON "notification_rules" ("company_id", "event_type") WHERE "is_active";

-- Usage metering (tracking only until pricing is decided): Gemini tokens, messages, call minutes, storage
CREATE TABLE IF NOT EXISTS "usage_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "kind" varchar(30) NOT NULL,                       -- llm_tokens | message | call_minutes | storage_mb | email
  "channel" varchar(30),
  "quantity" numeric(16,4) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
  "ref_type" varchar(30),
  "ref_id" uuid,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "usage_ledger_company_time_idx" ON "usage_ledger" ("company_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "usage_ledger_kind_idx" ON "usage_ledger" ("company_id", "kind", "occurred_at" DESC);

CREATE TABLE IF NOT EXISTS "consent_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "channel" varchar(30) NOT NULL,                    -- whatsapp | sms | voice | email
  "purpose" varchar(40) NOT NULL,                    -- marketing | service | call_recording
  "granted" boolean NOT NULL,
  "source" varchar(40) NOT NULL DEFAULT 'chat',
  "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "consent_records_contact_idx" ON "consent_records" ("company_id", "contact_id", "channel", "purpose", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "data_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "kind" varchar(12) NOT NULL,                       -- export | delete
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "subject_label" varchar(255),
  "status" varchar(16) NOT NULL DEFAULT 'pending',   -- pending | approved | completed | rejected
  "requested_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "result_ref" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);

-- Platform-wide product changelog (not tenant data)
CREATE TABLE IF NOT EXISTS "changelog_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "body_md" text NOT NULL,
  "category" varchar(30) NOT NULL DEFAULT 'feature',
  "published_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- =============================================================================================
-- P8  PAYMENTS & BILLING (schema only; the pricing model and live provider keys are decided later)
-- =============================================================================================
CREATE TABLE IF NOT EXISTS "company_billing_profiles" (
  "company_id" uuid PRIMARY KEY REFERENCES "companies"("id") ON DELETE CASCADE,
  "legal_name" varchar(200),
  "gstin" varchar(20),
  "pan" varchar(12),
  "state_code" varchar(4),
  "address" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "billing_email" varchar(255),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "subscription_invoices" ADD COLUMN IF NOT EXISTS "tax_amount" integer NOT NULL DEFAULT 0;
ALTER TABLE "subscription_invoices" ADD COLUMN IF NOT EXISTS "tax_breakdown" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "subscription_invoices" ADD COLUMN IF NOT EXISTS "billing_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "plan_definitions" (
  "id" varchar(40) PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'INR',
  "price_monthly_minor" bigint NOT NULL DEFAULT 0,
  "price_yearly_minor" bigint NOT NULL DEFAULT 0,
  "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "features" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT false,        -- stays inactive until the pricing decision is made
  "sort_order" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "payment_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "kind" varchar(20) NOT NULL,                       -- booking_token | subscription | credit_topup
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "unit_id" uuid REFERENCES "units"("id") ON DELETE SET NULL,
  "amount_minor" bigint NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'INR',
  "provider" varchar(20) NOT NULL,                   -- stripe | razorpay | manual
  "provider_order_id" varchar(120),
  "provider_payment_id" varchar(120),
  "payment_link_url" text,
  "status" varchar(24) NOT NULL DEFAULT 'created',   -- created | pending | paid | failed | refunded | partially_refunded | expired
  "receipt_no" varchar(40),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "expires_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_provider_order_uniq" ON "payment_orders" ("provider", "provider_order_id") WHERE "provider_order_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_receipt_uniq" ON "payment_orders" ("company_id", "receipt_no") WHERE "receipt_no" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "payment_orders_company_status_idx" ON "payment_orders" ("company_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL REFERENCES "payment_orders"("id") ON DELETE CASCADE,
  "amount_minor" bigint NOT NULL,
  "reason" text,
  "provider_refund_id" varchar(120),
  "status" varchar(16) NOT NULL DEFAULT 'pending',   -- pending | processed | failed
  "requested_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Raw provider webhook log; the unique event id makes redelivery harmless
CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(20) NOT NULL,
  "event_id" varchar(160) NOT NULL,
  "type" varchar(80) NOT NULL,
  "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_event_uniq" ON "payment_events" ("provider", "event_id");

-- Prepaid usage credits (top-ups and consumption), built on the usage ledger
CREATE TABLE IF NOT EXISTS "usage_credit_accounts" (
  "company_id" uuid PRIMARY KEY REFERENCES "companies"("id") ON DELETE CASCADE,
  "balance" numeric(16,4) NOT NULL DEFAULT 0,
  "auto_topup" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "usage_credit_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "delta" numeric(16,4) NOT NULL,
  "reason" varchar(20) NOT NULL,                     -- topup | usage | refund | adjustment | grant
  "payment_order_id" uuid REFERENCES "payment_orders"("id") ON DELETE SET NULL,
  "usage_ledger_id" uuid REFERENCES "usage_ledger"("id") ON DELETE SET NULL,
  "balance_after" numeric(16,4),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "usage_credit_tx_company_idx" ON "usage_credit_transactions" ("company_id", "created_at" DESC);

-- =============================================================================================
-- Row-level security on every new tenant table (same pattern as 0014 / 0019)
-- =============================================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tools','tool_runs','flows','flow_versions','flow_triggers','flow_executions','flow_step_runs',
    'contact_identities','channel_connections','lead_sources','lead_source_events','conversation_notes',
    'message_templates','widgets','voice_agents','phone_numbers','call_events','call_campaigns',
    'call_campaign_targets','dnd_numbers','oauth_connections','kb_test_runs','tags','taggings',
    'segment_members','conversation_insights','surveys','survey_responses','dashboards','dashboard_widgets',
    'boards','board_tasks','board_task_comments','teams','team_members','policies','policy_assignments',
    'policy_changes','access_logs','notification_rules','usage_ledger','consent_records','data_requests',
    'company_billing_profiles','payment_orders','payment_refunds','usage_credit_accounts','usage_credit_transactions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_policy" ON %I', t);
    EXECUTE format($p$CREATE POLICY "tenant_isolation_policy" ON %I AS PERMISSIVE FOR ALL
      USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL)
      WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL)$p$, t);
  END LOOP;
END $$;
