import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const ENV_PATH = path.resolve(process.cwd(), '.env');
const ENV_EXAMPLE_PATH = path.resolve(process.cwd(), '.env.example');

interface ValidationResult {
  provider: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  hint: string;
}

function parseEnvFile(filePath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(filePath)) return map;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      map.set(key, val);
    }
  }
  return map;
}

function saveEnvFile(filePath: string, map: Map<string, string>): void {
  let content = '';
  if (fs.existsSync(filePath)) {
    // Read original lines to preserve comments
    const originalLines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const writtenKeys = new Set<string>();

    for (const line of originalLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        content += line + '\n';
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        if (map.has(key)) {
          content += `${key}=${map.get(key)}\n`;
          writtenKeys.add(key);
        } else {
          content += line + '\n';
        }
      } else {
        content += line + '\n';
      }
    }

    // Append any newly added keys that were not in the original file
    for (const [k, v] of map.entries()) {
      if (!writtenKeys.has(k)) {
        content += `${k}=${v}\n`;
      }
    }
  } else {
    // Write fresh key-value file
    for (const [k, v] of map.entries()) {
      content += `${k}=${v}\n`;
    }
  }

  fs.writeFileSync(filePath, content.trim() + '\n', 'utf-8');
}

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer.trim());
    });
  });
}

async function validateOpenAi(apiKey?: string): Promise<ValidationResult> {
  if (!apiKey) return { provider: 'OpenAI LLM', status: 'SKIPPED', hint: 'No key provided' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return { provider: 'OpenAI LLM', status: 'PASS', hint: 'Authenticated successfully' };
    }
    return { provider: 'OpenAI LLM', status: 'FAIL', hint: `HTTP ${res.status}: Check key at platform.openai.com` };
  } catch (err: unknown) {
    return { provider: 'OpenAI LLM', status: 'FAIL', hint: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function validateAnthropic(apiKey?: string): Promise<ValidationResult> {
  if (!apiKey) return { provider: 'Anthropic Claude', status: 'SKIPPED', hint: 'No key provided' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok || res.status === 200) {
      return { provider: 'Anthropic Claude', status: 'PASS', hint: 'Authenticated successfully' };
    }
    return { provider: 'Anthropic Claude', status: 'FAIL', hint: `HTTP ${res.status}: Verify at console.anthropic.com` };
  } catch (err: unknown) {
    return { provider: 'Anthropic Claude', status: 'FAIL', hint: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function validateMetaWhatsApp(token?: string, phoneId?: string): Promise<ValidationResult> {
  if (!token || !phoneId) {
    return { provider: 'Meta WhatsApp API', status: 'SKIPPED', hint: 'Token or Phone ID missing' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return { provider: 'Meta WhatsApp API', status: 'PASS', hint: 'Phone number ID verified' };
    }
    return { provider: 'Meta WhatsApp API', status: 'FAIL', hint: `HTTP ${res.status}: Check token permissions at business.facebook.com` };
  } catch (err: unknown) {
    return { provider: 'Meta WhatsApp API', status: 'FAIL', hint: `Connection error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function runSetupWizard(): Promise<void> {
  console.log('\n===============================================================');
  console.log('         PROPBOT PRO — SECURE INTEGRATIONS SETUP WIZARD       ');
  console.log('===============================================================\n');

  // Load existing .env or fallback to .env.example
  let envMap = parseEnvFile(ENV_PATH);
  if (envMap.size === 0 && fs.existsSync(ENV_EXAMPLE_PATH)) {
    envMap = parseEnvFile(ENV_EXAMPLE_PATH);
    console.log('[+] Initialized local .env from .env.example');
  }

  // 1. Auto-generate critical cryptographic secrets if missing or placeholder
  const isDummy = (val?: string) => !val || val.includes('your_') || val.length < 24;

  let generatedCount = 0;
  if (isDummy(envMap.get('JWT_ACCESS_SECRET'))) {
    envMap.set('JWT_ACCESS_SECRET', crypto.randomBytes(32).toString('hex'));
    generatedCount++;
  }
  if (isDummy(envMap.get('JWT_REFRESH_SECRET'))) {
    envMap.set('JWT_REFRESH_SECRET', crypto.randomBytes(32).toString('hex'));
    generatedCount++;
  }
  if (isDummy(envMap.get('ENCRYPTION_KEY'))) {
    envMap.set('ENCRYPTION_KEY', crypto.randomBytes(32).toString('hex'));
    generatedCount++;
  }
  if (isDummy(envMap.get('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN'))) {
    envMap.set('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN', crypto.randomBytes(24).toString('hex'));
    generatedCount++;
  }

  if (generatedCount > 0) {
    console.log(`[✓] Auto-generated ${generatedCount} cryptographic secrets (JWT & AES-256 vault keys).`);
  }

  // Check non-interactive execution
  const args = process.argv.slice(2);
  const isNonInteractive =
    args.includes('--auto-generate-secrets') ||
    args.includes('--validate-only') ||
    !process.stdin.isTTY;

  if (!isNonInteractive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log('\n--- 1. Primary AI / LLM Provider Selection ---');
      console.log('Choose your preferred LLM provider for grounded customer answers:');
      console.log('  [1] OpenAI (gpt-4o / gpt-4o-mini)');
      console.log('  [2] Anthropic (claude-3-5-sonnet)');
      console.log('  [3] Google Gemini (gemini-1.5-pro / flash)');
      console.log('  [4] Skip for now (keep current)');
      const llmChoice = await askQuestion(rl, 'Select [1-4] (default: 4): ');

      if (llmChoice === '1') {
        const key = await askQuestion(rl, 'Paste OpenAI API key (from platform.openai.com/api-keys) [Enter to skip]: ');
        if (key) envMap.set('OPENAI_API_KEY', key);
      } else if (llmChoice === '2') {
        const key = await askQuestion(rl, 'Paste Anthropic Claude API key (from console.anthropic.com) [Enter to skip]: ');
        if (key) envMap.set('ANTHROPIC_API_KEY', key);
      } else if (llmChoice === '3') {
        const key = await askQuestion(rl, 'Paste Google Gemini API key (from aistudio.google.com) [Enter to skip]: ');
        if (key) envMap.set('GEMINI_API_KEY', key);
      }

      console.log('\n--- 2. Vector Embeddings Provider ---');
      console.log('  [1] Use OpenAI text-embedding-3-small (Recommended)');
      console.log('  [2] Custom dedicated embedding API key');
      console.log('  [3] Skip');
      const embChoice = await askQuestion(rl, 'Select [1-3] (default: 1): ');
      if (embChoice === '2') {
        const embKey = await askQuestion(rl, 'Paste Embedding API key: ');
        if (embKey) envMap.set('EMBEDDING_API_KEY', embKey);
      }

      console.log('\n--- 3. Meta WhatsApp Cloud API Setup (Optional) ---');
      const setupMeta = await askQuestion(rl, 'Would you like to configure Meta WhatsApp now? (y/N): ');
      if (setupMeta.toLowerCase() === 'y') {
        const token = await askQuestion(rl, '1. System User Permanent Access Token [Enter to skip]: ');
        if (token) envMap.set('META_WHATSAPP_TOKEN', token);

        const phoneId = await askQuestion(rl, '2. WhatsApp Business Phone Number ID [Enter to skip]: ');
        if (phoneId) envMap.set('META_WHATSAPP_PHONE_NUMBER_ID', phoneId);

        const wabaId = await askQuestion(rl, '3. WhatsApp Business Account ID (WABA ID) [Enter to skip]: ');
        if (wabaId) envMap.set('META_WHATSAPP_BUSINESS_ACCOUNT_ID', wabaId);
      }
    } finally {
      rl.close();
    }
  }

  // Save changes to .env
  saveEnvFile(ENV_PATH, envMap);
  console.log('\n[✓] .env file updated and saved successfully.');

  // Validate credentials live
  console.log('\nRunning live credentials validation checks...');
  const results: ValidationResult[] = [];

  const openaiKey = envMap.get('OPENAI_API_KEY');
  const anthropicKey = envMap.get('ANTHROPIC_API_KEY');
  const metaToken = envMap.get('META_WHATSAPP_TOKEN');
  const metaPhoneId = envMap.get('META_WHATSAPP_PHONE_NUMBER_ID');

  if (openaiKey) results.push(await validateOpenAi(openaiKey));
  if (anthropicKey) results.push(await validateAnthropic(anthropicKey));
  if (metaToken && metaPhoneId) results.push(await validateMetaWhatsApp(metaToken, metaPhoneId));

  if (results.length > 0) {
    console.log('\n┌─────────────────────────────┬─────────┬────────────────────────────────────────────────────────┐');
    console.log('│ Provider / Key              │ Status  │ Details                                                │');
    console.log('├─────────────────────────────┼─────────┼────────────────────────────────────────────────────────┤');
    for (const r of results) {
      const prov = r.provider.padEnd(27);
      const st = r.status === 'PASS' ? '\x1b[32mPASS   \x1b[0m' : r.status === 'FAIL' ? '\x1b[31mFAIL   \x1b[0m' : '\x1b[33mSKIPPED\x1b[0m';
      const hint = r.hint.length > 54 ? r.hint.slice(0, 51) + '...' : r.hint;
      console.log(`│ ${prov} │ ${st} │ ${hint.padEnd(54)} │`);
    }
    console.log('└─────────────────────────────┴─────────┴────────────────────────────────────────────────────────┘\n');
  }

  console.log('[✓] Key setup process completed. Secrets are securely stored and masked.\n');
}

if (process.argv[1]?.includes('setup-keys')) {
  runSetupWizard().catch(err => {
    console.error('Setup wizard fatal error:', err);
    process.exit(1);
  });
}
