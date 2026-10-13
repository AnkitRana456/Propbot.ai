import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://propbot:propbot_password@localhost:5432/propbot_pro?sslmode=disable';

async function runMigrations() {
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.info('Running database migrations from:', path.join(__dirname, 'migrations'));

  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, 'migrations'),
    });
    console.info('Migrations applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
