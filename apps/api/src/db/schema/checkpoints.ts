import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { domainEvents } from './events.js';

export const eventConsumerCheckpoints = pgTable(
  'event_consumer_checkpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => domainEvents.id, { onDelete: 'cascade' }),
    consumerName: varchar('consumer_name', { length: 100 }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('event_consumer_checkpoint_uniq_idx').on(table.eventId, table.consumerName),
    index('event_consumer_checkpoint_consumer_idx').on(table.consumerName, table.processedAt),
  ],
);
