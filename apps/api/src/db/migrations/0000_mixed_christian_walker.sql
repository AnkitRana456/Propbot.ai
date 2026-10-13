DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    CREATE DOMAIN vector AS text;
  END IF;
END $$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan" varchar(50) DEFAULT 'trial' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_ai_settings" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"allowed_tiers" text[] DEFAULT ARRAY['T0', 'T1']::text[] NOT NULL,
	"daily_action_cap" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"team" varchar(100),
	"status" varchar(50) DEFAULT 'pending_approval' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"industry" varchar(100),
	"website" varchar(255),
	"phone" varchar(50),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"organization_id" uuid,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(50) NOT NULL,
	"alt_phone" varchar(50),
	"lifecycle_stage" varchar(50) DEFAULT 'lead' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "chatbots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'web' NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"public_key" varchar(64) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allowed_domains" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"source_url" text,
	"file_path" text,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"last_trained_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"contact_id" uuid,
	"channel" varchar(50) DEFAULT 'web' NOT NULL,
	"status" varchar(50) DEFAULT 'bot' NOT NULL,
	"assigned_agent_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_type" varchar(50) NOT NULL,
	"sender_id" varchar(255),
	"content" text NOT NULL,
	"tokens_used" integer,
	"latency_ms" integer,
	"sentiment" varchar(50),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"assigned_agent_id" uuid,
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"lost_reason" text,
	"priority" varchar(50) DEFAULT 'medium' NOT NULL,
	"intent_score" integer DEFAULT 0 NOT NULL,
	"intent_label" varchar(50) DEFAULT 'cold' NOT NULL,
	"buyer_dna" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"source" varchar(100) DEFAULT 'chat' NOT NULL,
	"sla_breached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"assigned_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(50) DEFAULT 'follow_up' NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"priority" varchar(50) DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brochures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"is_gated" boolean DEFAULT true NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"builder_name" varchar(255) NOT NULL,
	"rera_no" varchar(100),
	"location" varchar(255) NOT NULL,
	"map_url" text,
	"status" varchar(50) DEFAULT 'under_construction' NOT NULL,
	"possession_date" varchar(100),
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"tower" varchar(100),
	"floor" integer,
	"unit_number" varchar(50) NOT NULL,
	"bhk" integer NOT NULL,
	"carpet_area_sqft" numeric(10, 2) NOT NULL,
	"super_area_sqft" numeric(10, 2),
	"price" numeric(14, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"project_id" uuid,
	"assigned_agent_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" varchar(50) DEFAULT 'scheduled' NOT NULL,
	"calendar_event_id" varchar(255),
	"calendar_status" varchar(50) DEFAULT 'dashboard_only' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"url" text NOT NULL,
	"secret" varchar(255) NOT NULL,
	"subscribed_events" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" varchar(100),
	"event_type" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"status_code" integer,
	"attempt" integer DEFAULT 1 NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_body" text,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan" varchar(50) DEFAULT 'trial' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lead_credits_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"link_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_name" varchar(100) NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"tier" varchar(10) NOT NULL,
	"status" varchar(50) DEFAULT 'proposed' NOT NULL,
	"args" jsonb NOT NULL,
	"result" jsonb,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_ai_settings" ADD CONSTRAINT "company_ai_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brochures" ADD CONSTRAINT "brochures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_company_email_idx" ON "users" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "organizations_company_idx" ON "organizations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_company_phone_idx" ON "contacts" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "contacts_company_email_idx" ON "contacts" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "chatbots_public_key_idx" ON "chatbots" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "chatbots_company_idx" ON "chatbots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_company_bot_idx" ON "knowledge_chunks" USING btree ("company_id","chatbot_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "knowledge_sources_company_bot_idx" ON "knowledge_sources" USING btree ("company_id","chatbot_id");--> statement-breakpoint
CREATE INDEX "conversations_company_bot_idx" ON "conversations" USING btree ("company_id","chatbot_id");--> statement-breakpoint
CREATE INDEX "conversations_contact_idx" ON "conversations" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_company_idx" ON "messages" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lead_activities_lead_created_idx" ON "lead_activities" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_activities_company_idx" ON "lead_activities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leads_company_status_priority_idx" ON "leads" USING btree ("company_id","status","priority");--> statement-breakpoint
CREATE INDEX "leads_company_intent_idx" ON "leads" USING btree ("company_id","intent_score");--> statement-breakpoint
CREATE INDEX "leads_company_contact_idx" ON "leads" USING btree ("company_id","contact_id");--> statement-breakpoint
CREATE INDEX "notes_lead_idx" ON "notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "notes_company_idx" ON "notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tasks_company_user_status_due_idx" ON "tasks" USING btree ("company_id","assigned_user_id","status","due_date");--> statement-breakpoint
CREATE INDEX "brochures_company_project_idx" ON "brochures" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "projects_company_idx" ON "projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "units_company_project_status_idx" ON "units" USING btree ("company_id","project_id","status");--> statement-breakpoint
CREATE INDEX "appointments_company_scheduled_status_idx" ON "appointments" USING btree ("company_id","scheduled_at","status");--> statement-breakpoint
CREATE INDEX "appointments_lead_idx" ON "appointments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_company_idx" ON "webhook_endpoints" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "webhook_logs_endpoint_created_idx" ON "webhook_logs" USING btree ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_logs_company_idx" ON "webhook_logs" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_company_idx" ON "subscriptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "audit_logs_company_created_idx" ON "audit_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_company_idx" ON "notifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "domain_events_processed_created_idx" ON "domain_events" USING btree ("processed_at","created_at");--> statement-breakpoint
CREATE INDEX "domain_events_company_idx" ON "domain_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_actions_company_status_tier_idx" ON "agent_actions" USING btree ("company_id","status","tier");--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "companies" AS RESTRICTIVE FOR ALL USING ("id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "company_ai_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_ai_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "company_ai_settings" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "users" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "organizations" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "contacts" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "chatbots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chatbots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "chatbots" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_sources" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "knowledge_sources" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "knowledge_chunks" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "conversations" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "messages" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "leads" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "lead_activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lead_activities" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "lead_activities" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "notes" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "tasks" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "projects" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "units" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "units" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "brochures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brochures" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "brochures" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "appointments" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "webhook_endpoints" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "webhook_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "webhook_logs" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "subscriptions" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "audit_logs" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "notifications" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "domain_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "domain_events" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);--> statement-breakpoint
ALTER TABLE "agent_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_actions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "agent_actions" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);