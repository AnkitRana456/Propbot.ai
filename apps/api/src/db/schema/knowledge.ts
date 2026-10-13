import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { companies } from './companies.js';
import { chatbots } from './chatbots.js';

// Custom type for PostgreSQL pgvector extension
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return typeof value === 'string' ? JSON.parse(value) : value;
  },
});

// Custom type for PostgreSQL tsvector
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // 'text' | 'file' | 'url' | 'qa' | 'property'
    sourceUrl: text('source_url'),
    filePath: text('file_path'),
    status: varchar('status', { length: 50 }).notNull().default('queued'), // 'queued' | 'processing' | 'ready' | 'failed'
    errorMessage: text('error_message'),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    chunkCount: integer('chunk_count').notNull().default(0),
    byteSize: integer('byte_size').notNull().default(0),
    lastTrainedAt: timestamp('last_trained_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('knowledge_sources_company_bot_idx').on(table.companyId, table.chatbotId)],
);

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    tsv: tsvector('tsv'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('knowledge_chunks_company_bot_idx').on(table.companyId, table.chatbotId),
    index('knowledge_chunks_source_idx').on(table.sourceId),
  ],
);

export const knowledgeQaOverrides = pgTable(
  'knowledge_qa_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    source: varchar('source', { length: 50 }).notNull().default('correction'), // 'correction' | 'manual'
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('knowledge_qa_overrides_company_bot_idx').on(table.companyId, table.chatbotId)],
);

export const unansweredQuestions = pgTable(
  'unanswered_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    chatbotId: uuid('chatbot_id')
      .notNull()
      .references(() => chatbots.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    frequency: integer('frequency').notNull().default(1),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'resolved' | 'ignored'
    resolvedAnswer: text('resolved_answer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('unanswered_questions_company_bot_idx').on(table.companyId, table.chatbotId)],
);
