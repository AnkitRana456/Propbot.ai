-- Migration: 0002_knowledge_rag.sql
-- Description: Phase 3 Knowledge Base, RAG, pgvector hybrid search, and Q&A overrides

-- 1. Extend knowledge_sources
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "error_message" text;
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "config" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Extend knowledge_chunks with full-text search tsvector
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "tsv" tsvector;
CREATE INDEX IF NOT EXISTS "knowledge_chunks_tsv_idx" ON "knowledge_chunks" USING GIN ("tsv");

-- 3. Create knowledge_qa_overrides table
CREATE TABLE IF NOT EXISTS "knowledge_qa_overrides" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "chatbot_id" uuid NOT NULL REFERENCES "chatbots"("id") ON DELETE cascade,
    "question" text NOT NULL,
    "answer" text NOT NULL,
    "source" varchar(50) DEFAULT 'correction' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "knowledge_qa_overrides_company_bot_idx" ON "knowledge_qa_overrides" ("company_id", "chatbot_id");

-- 4. Create unanswered_questions table
CREATE TABLE IF NOT EXISTS "unanswered_questions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE cascade,
    "chatbot_id" uuid NOT NULL REFERENCES "chatbots"("id") ON DELETE cascade,
    "question" text NOT NULL,
    "frequency" integer DEFAULT 1 NOT NULL,
    "status" varchar(50) DEFAULT 'pending' NOT NULL,
    "resolved_answer" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "unanswered_questions_company_bot_idx" ON "unanswered_questions" ("company_id", "chatbot_id");

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE "knowledge_qa_overrides" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_qa_overrides_tenant_isolation" ON "knowledge_qa_overrides";
CREATE POLICY "knowledge_qa_overrides_tenant_isolation" ON "knowledge_qa_overrides"
    AS RESTRICTIVE
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

ALTER TABLE "unanswered_questions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unanswered_questions_tenant_isolation" ON "unanswered_questions";
CREATE POLICY "unanswered_questions_tenant_isolation" ON "unanswered_questions"
    AS RESTRICTIVE
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
