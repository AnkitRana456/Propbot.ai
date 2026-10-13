import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://propbot:propbot_password@localhost:5432/propbot_pro?sslmode=disable';

const maxConnections = Number(process.env.DB_MAX_CONNECTIONS ?? 20);

// postgres-js client configuration
export const queryClient = postgres(connectionString, {
  max: maxConnections,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
