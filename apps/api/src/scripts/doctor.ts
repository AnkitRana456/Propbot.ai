import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically locate .env from cwd or monorepo root
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

interface CheckResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'MISSING' | 'WARN';
  message: string;
  hint?: string;
}

const results: CheckResult[] = [];

async function checkPostgresAndVector(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    results.push({
      component: 'PostgreSQL Database',
      status: 'MISSING',
      message: 'DATABASE_URL is not defined in .env',
      hint: 'Configure DATABASE_URL in .env',
    });
    results.push({
      component: 'pgvector Extension',
      status: 'MISSING',
      message: 'Cannot check pgvector without database connection',
    });
    return;
  }

  let sql: postgres.Sql | null = null;
  try {
    sql = postgres(dbUrl, { connect_timeout: 3, max: 1 });
    const [dbTest] = await sql`SELECT current_database() as db_name, version() as pg_version`;
    results.push({
      component: 'PostgreSQL Database',
      status: 'PASS',
      message: `Connected to database '${dbTest?.db_name}'`,
    });

    const [vecExt] = await sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
    if (vecExt) {
      results.push({
        component: 'pgvector Extension',
        status: 'PASS',
        message: `Installed (v${vecExt.extversion})`,
      });
    } else {
      results.push({
        component: 'pgvector Extension',
        status: 'FAIL',
        message: 'Extension "vector" is not installed in database',
        hint: 'Run "CREATE EXTENSION IF NOT EXISTS vector;" in PostgreSQL',
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({
      component: 'PostgreSQL Database',
      status: 'FAIL',
      message: `Connection failed: ${errorMsg}`,
      hint: 'Verify PostgreSQL is running and credentials in DATABASE_URL are correct',
    });
    results.push({
      component: 'pgvector Extension',
      status: 'FAIL',
      message: 'Check blocked by database connection failure',
    });
  } finally {
    if (sql) {
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
}

async function checkRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  let host = 'localhost';
  let port = 6379;
  try {
    const parsed = new URL(redisUrl);
    host = parsed.hostname || 'localhost';
    port = Number(parsed.port) || 6379;
  } catch {
    // fallback defaults
  }

  await new Promise<void>(resolve => {
    const socket = net.createConnection({ host, port, timeout: 2000 }, () => {
      results.push({
        component: 'Redis & BullMQ',
        status: 'PASS',
        message: `Reachable at ${host}:${port}`,
      });
      socket.end();
      resolve();
    });

    socket.on('error', (err) => {
      results.push({
        component: 'Redis & BullMQ',
        status: 'FAIL',
        message: `Unreachable at ${host}:${port} (${err.message})`,
        hint: 'Start Redis service or docker compose up -d redis',
      });
      resolve();
    });

    socket.on('timeout', () => {
      socket.destroy();
      results.push({
        component: 'Redis & BullMQ',
        status: 'FAIL',
        message: `Connection timed out at ${host}:${port}`,
        hint: 'Verify Redis is listening on port 6379',
      });
      resolve();
    });
  });
}

async function checkLlmProvider(): Promise<void> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openaiKey && !anthropicKey && !geminiKey) {
    results.push({
      component: 'LLM Provider (Live Call)',
      status: 'MISSING',
      message: 'No LLM API keys set (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY)',
      hint: 'Run pnpm setup:keys in Phase R3',
    });
    return;
  }

  if (openaiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${openaiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        results.push({
          component: 'LLM Provider (OpenAI)',
          status: 'PASS',
          message: 'Authentication successful (API reachable)',
        });
      } else {
        results.push({
          component: 'LLM Provider (OpenAI)',
          status: 'FAIL',
          message: `HTTP ${res.status}: Invalid key or quota exceeded`,
          hint: 'Verify OPENAI_API_KEY validity at platform.openai.com',
        });
      }
    } catch (err: unknown) {
      results.push({
        component: 'LLM Provider (OpenAI)',
        status: 'FAIL',
        message: `Connection timed out or failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);
      if (res.ok) {
        results.push({
          component: 'LLM Provider (Google Gemini)',
          status: 'PASS',
          message: 'Authentication successful (Gemini 1.5/2.0 API reachable)',
        });
      } else {
        const errData = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        const errMsg = errData.error?.message || `HTTP ${res.status}`;
        results.push({
          component: 'LLM Provider (Google Gemini)',
          status: 'FAIL',
          message: `${errMsg.slice(0, 50)}`,
          hint: 'Verify GEMINI_API_KEY at aistudio.google.com',
        });
      }
    } catch (err: unknown) {
      results.push({
        component: 'LLM Provider (Google Gemini)',
        status: 'FAIL',
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (anthropicKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        results.push({
          component: 'LLM Provider (Anthropic)',
          status: 'PASS',
          message: 'Authentication successful (Claude reachable)',
        });
      } else {
        results.push({
          component: 'LLM Provider (Anthropic)',
          status: 'FAIL',
          message: `HTTP ${res.status}: Invalid key or unauthorized`,
          hint: 'Verify ANTHROPIC_API_KEY at console.anthropic.com',
        });
      }
    } catch (err: unknown) {
      results.push({
        component: 'LLM Provider (Anthropic)',
        status: 'FAIL',
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}

async function checkEmbeddingProvider(): Promise<void> {
  const embeddingKey =
    process.env.EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!embeddingKey) {
    results.push({
      component: 'Embedding Provider',
      status: 'MISSING',
      message: 'No embedding API key found',
      hint: 'Configure OPENAI_API_KEY or GEMINI_API_KEY in .env',
    });
    return;
  }

  const providerDesc = process.env.EMBEDDING_API_KEY
    ? 'Custom Embedding Key'
    : process.env.OPENAI_API_KEY
      ? 'OpenAI (text-embedding-3-small)'
      : 'Google GenAI (text-embedding-004)';

  results.push({
    component: 'Embedding Provider',
    status: 'PASS',
    message: `${providerDesc} active`,
  });
}

function checkMetaWhatsapp(): void {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    results.push({
      component: 'Meta WhatsApp Cloud API',
      status: 'MISSING',
      message: 'META_WHATSAPP_TOKEN or PHONE_NUMBER_ID is missing',
      hint: 'Configure in Phase R3 / Meta developer console',
    });
  } else {
    results.push({
      component: 'Meta WhatsApp Cloud API',
      status: 'PASS',
      message: 'Token and Phone Number ID present',
    });
  }
}

function checkStorageAndSmtp(): void {
  const r2Key = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  if (!r2Key) {
    results.push({
      component: 'Object Storage (Brochures / R2)',
      status: 'MISSING',
      message: 'No storage credentials configured',
      hint: 'Required for brochure and floor plan uploads (Phase 5/19)',
    });
  } else {
    results.push({
      component: 'Object Storage (Brochures / R2)',
      status: 'PASS',
      message: 'Storage credentials configured',
    });
  }

  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    results.push({
      component: 'Email / SMTP Service',
      status: 'MISSING',
      message: 'SMTP_HOST not set (Email notifications disabled)',
      hint: 'Configure SMTP_HOST and credentials in .env for email alerts',
    });
  } else {
    results.push({
      component: 'Email / SMTP Service',
      status: 'PASS',
      message: `Configured for ${smtpHost}`,
    });
  }
}

async function runDoctor(): Promise<void> {
  console.log('\n===============================================================');
  console.log('             PROPBOT PRO — SYSTEM DIAGNOSTICS (DOCTOR)         ');
  console.log('===============================================================\n');

  await checkPostgresAndVector();
  await checkRedis();
  await checkLlmProvider();
  await checkEmbeddingProvider();
  checkMetaWhatsapp();
  checkStorageAndSmtp();

  console.log('┌──────────────────────────────────────┬─────────┬────────────────────────────────────────────────────────┐');
  console.log('│ Component                            │ Status  │ Details                                                │');
  console.log('├──────────────────────────────────────┼─────────┼────────────────────────────────────────────────────────┤');

  let hasFailures = false;

  for (const r of results) {
    const compPadded = r.component.padEnd(36);
    let statusFormatted = r.status.padEnd(7);
    if (r.status === 'PASS') {
      statusFormatted = '\x1b[32mPASS   \x1b[0m';
    } else if (r.status === 'FAIL') {
      statusFormatted = '\x1b[31mFAIL   \x1b[0m';
      hasFailures = true;
    } else if (r.status === 'MISSING') {
      statusFormatted = '\x1b[33mMISSING\x1b[0m';
    } else if (r.status === 'WARN') {
      statusFormatted = '\x1b[33mWARN   \x1b[0m';
    }

    const msg = r.message.length > 54 ? r.message.slice(0, 51) + '...' : r.message;
    const msgPadded = msg.padEnd(54);
    console.log(`│ ${compPadded} │ ${statusFormatted} │ ${msgPadded} │`);
    if (r.hint && (r.status === 'FAIL' || r.status === 'MISSING')) {
      const hintMsg = `↳ Hint: ${r.hint}`;
      const hintTrunc = (hintMsg.length > 54 ? hintMsg.slice(0, 51) + '...' : hintMsg).padEnd(54);
      console.log(`│ ${' '.padEnd(36)} │         │ \x1b[90m${hintTrunc}\x1b[0m │`);
    }
  }

  console.log('└──────────────────────────────────────┴─────────┴────────────────────────────────────────────────────────┘\n');

  if (hasFailures) {
    console.log('\x1b[31m[!] Critical infrastructure components failed. Address failures above.\x1b[0m\n');
  } else {
    console.log('\x1b[32m[✓] Baseline infrastructure operational. Configure MISSING keys via Phase R3.\x1b[0m\n');
  }
}

runDoctor().catch(err => {
  console.error('Fatal doctor execution error:', err);
  process.exit(1);
});
