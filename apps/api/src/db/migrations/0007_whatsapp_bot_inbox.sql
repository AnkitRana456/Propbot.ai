CREATE TABLE IF NOT EXISTS "whatsapp_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE set null,
  "phone_number_id" varchar(100),
  "business_phone_number" varchar(50),
  "access_token" text,
  "app_secret" text,
  "verify_token" varchar(255) NOT NULL,
  "template_name" varchar(255) DEFAULT 'property_inquiry_details',
  "enable_automation" boolean DEFAULT true NOT NULL,
  "ai_auto_replies" boolean DEFAULT true NOT NULL,
  "pause_after_agent_reply" boolean DEFAULT true NOT NULL,
  "frustration_handoff" boolean DEFAULT true NOT NULL,
  "auto_assign_owner" boolean DEFAULT true NOT NULL,
  "handoff_keywords" text[] DEFAULT ARRAY['agent', 'human', 'representative', 'complaint']::text[] NOT NULL,
  "handoff_message" text DEFAULT 'A property advisor will continue this conversation shortly.' NOT NULL,
  "status" varchar(50) DEFAULT 'disconnected' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_configs_company_unique_idx" ON "whatsapp_configs" ("company_id");
CREATE INDEX IF NOT EXISTS "whatsapp_configs_phone_number_idx" ON "whatsapp_configs" ("phone_number_id");
CREATE INDEX IF NOT EXISTS "whatsapp_configs_company_idx" ON "whatsapp_configs" ("company_id");

CREATE TABLE IF NOT EXISTS "whatsapp_inbound_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "wamid" varchar(255) NOT NULL,
  "from_phone" varchar(50) NOT NULL,
  "event_type" varchar(50) DEFAULT 'message' NOT NULL,
  "status" varchar(50) DEFAULT 'received' NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_inbound_company_wamid_idx" ON "whatsapp_inbound_events" ("company_id", "wamid");
CREATE INDEX IF NOT EXISTS "whatsapp_inbound_created_idx" ON "whatsapp_inbound_events" ("created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_inbound_company_idx" ON "whatsapp_inbound_events" ("company_id");

CREATE TABLE IF NOT EXISTS "whatsapp_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "template_name" varchar(255) NOT NULL,
  "segment" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "total_recipients" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "whatsapp_campaigns_company_idx" ON "whatsapp_campaigns" ("company_id");
