import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://propbot:propbot_password@localhost:5432/propbot_pro?sslmode=disable',
  },
  verbose: true,
  strict: true,
});
