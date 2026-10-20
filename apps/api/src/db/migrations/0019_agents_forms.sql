-- Migration 0019: Agents, Forms and LLM call log (roadmap phase P1).
-- nullable column on chatbots. Existing chatbots keep agent_id = NULL and behave exactly as today.
-- New tenant tables follow the same row-level-security convention as 0014 (policy on company_id).

-- ---------------------------------------------------------------------------------------------
-- 1. Forms: reusable structured data definitions (custom lead attributes, agent inputs, surveys)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "key" varchar(80) NOT NULL,                       -- slug, unique per company (e.g. buyer_profile)
  "name" varchar(150) NOT NULL,
  "description" text,
  "purpose" varchar(30) NOT NULL DEFAULT 'lead_attributes',  -- lead_attributes | agent_input | survey | task
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "forms_company_key_uniq" ON "forms" ("company_id", "key") WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "form_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "form_id" uuid NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "key" varchar(80) NOT NULL,                       -- attribute key stored in leads.custom_fields
  "label" varchar(150) NOT NULL,
  "type" varchar(30) NOT NULL,                      -- text | longtext | number | currency | select | multiselect | boolean | date | phone | email | url
  "required" boolean NOT NULL DEFAULT false,
  "options" jsonb NOT NULL DEFAULT '[]'::jsonb,     -- choices for select / multiselect
  "validation" jsonb NOT NULL DEFAULT '{}'::jsonb,  -- min, max, minLength, maxLength, pattern
  "default_value" jsonb,
  "help_text" text,
  "ai_hint" text,                                   -- how the assistant should ask for this value in chat
  "collect_in_chat" boolean NOT NULL DEFAULT true,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "form_fields_form_key_uniq" ON "form_fields" ("form_id", "key");
CREATE INDEX IF NOT EXISTS "form_fields_company_idx" ON "form_fields" ("company_id");

-- ---------------------------------------------------------------------------------------------
-- 2. Agents and immutable versions
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "description" text,
  "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "template" varchar(50),                           -- preset used to create it (lead_qualifier, site_visit_booker, ...)
  "status" varchar(20) NOT NULL DEFAULT 'active',   -- active | archived
  "active_version_id" uuid,                         -- the published version served to visitors (FK added below)
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "agents_company_name_uniq" ON "agents" ("company_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "agents_company_idx" ON "agents" ("company_id");

CREATE TABLE IF NOT EXISTS "agent_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',    -- draft | published | archived
  "prompt" jsonb NOT NULL DEFAULT '{}'::jsonb,      -- jobDescription, character, informationToCollect, tone, style, extra
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ key, label, defaultValue, source }]
  "conditions" jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ field, operator, value, appendPrompt }]
  "knowledge" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { sourceIds: [], referenceIds: [] }
  "form_id" uuid REFERENCES "forms"("id") ON DELETE SET NULL,   -- data the agent collects
  "model" varchar(80) NOT NULL DEFAULT 'gemini-3.8-flash',
  "temperature" numeric(3,2) NOT NULL DEFAULT 0.70,
  "max_output_tokens" integer NOT NULL DEFAULT 600,
  "flags" jsonb NOT NULL DEFAULT '{}'::jsonb,       -- oneQuestionPerMessage, splitLongAnswers, language mode, ...
  "change_note" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_versions_agent_version_uniq" ON "agent_versions" ("agent_id", "version");
CREATE INDEX IF NOT EXISTS "agent_versions_company_idx" ON "agent_versions" ("company_id");

ALTER TABLE "agents"
  ADD CONSTRAINT "agents_active_version_fk"
  FOREIGN KEY ("active_version_id") REFERENCES "agent_versions"("id") ON DELETE SET NULL;

-- Saved test conversations used to compare two agent versions side by side
CREATE TABLE IF NOT EXISTS "agent_test_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "messages" jsonb NOT NULL DEFAULT '[]'::jsonb,    -- visitor messages to replay
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "agent_test_cases_agent_idx" ON "agent_test_cases" ("agent_id");

-- Which agent answers for a chatbot. NULL = today's behaviour (persona from chatbot config).
ALTER TABLE "chatbots" ADD COLUMN IF NOT EXISTS "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------------------------
-- 3. Form submissions: values collected for a lead (history; the current values live in leads.custom_fields)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "form_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "form_id" uuid NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "values" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source" varchar(30) NOT NULL DEFAULT 'chat',     -- chat | manual | import | api
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "form_submissions_company_lead_idx" ON "form_submissions" ("company_id", "lead_id");
CREATE INDEX IF NOT EXISTS "form_submissions_form_created_idx" ON "form_submissions" ("form_id", "created_at");

-- ---------------------------------------------------------------------------------------------
-- 4. Knowledge references: named subsets of knowledge sources an agent can be pointed at
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "knowledge_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "description" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_references_company_name_uniq"
  ON "knowledge_references" ("company_id", lower("name")) WHERE "deleted_at" IS NULL;

CREATE TABLE IF NOT EXISTS "knowledge_reference_sources" (
  "reference_id" uuid NOT NULL REFERENCES "knowledge_references"("id") ON DELETE CASCADE,
  "source_id" uuid NOT NULL REFERENCES "knowledge_sources"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  PRIMARY KEY ("reference_id", "source_id")
);
CREATE INDEX IF NOT EXISTS "knowledge_reference_sources_source_idx" ON "knowledge_reference_sources" ("source_id");

-- ---------------------------------------------------------------------------------------------
-- 5. LLM call log: one row per Gemini call (tokens, latency, cost, outcome). Feeds usage and execution views.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "llm_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE SET NULL,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "agent_version_id" uuid REFERENCES "agent_versions"("id") ON DELETE SET NULL,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE SET NULL,
  "channel" varchar(30),
  "purpose" varchar(30) NOT NULL DEFAULT 'chat',    -- chat | routing | extraction | summary | test | compare
  "model" varchar(80),
  "prompt_tokens" integer NOT NULL DEFAULT 0,
  "completion_tokens" integer NOT NULL DEFAULT 0,
  "total_tokens" integer NOT NULL DEFAULT 0,
  "latency_ms" integer,
  "cost_usd" numeric(12,6) NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'ok',       -- ok | error | fallback | blocked
  "error_kind" varchar(40),                         -- quota | timeout | invalid_key | ...
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "llm_calls_company_created_idx" ON "llm_calls" ("company_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "llm_calls_agent_created_idx" ON "llm_calls" ("agent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "llm_calls_conversation_idx" ON "llm_calls" ("conversation_id");

-- ---------------------------------------------------------------------------------------------
-- 6. Row-level security (same pattern as 0014: scoped when app.company_id is set)
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['forms','form_fields','form_submissions','agents','agent_versions',
                           'agent_test_cases','knowledge_references','knowledge_reference_sources','llm_calls']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_policy" ON %I', t);
    EXECUTE format($p$CREATE POLICY "tenant_isolation_policy" ON %I AS PERMISSIVE FOR ALL
      USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL)
      WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL)$p$, t);
  END LOOP;
END $$;
