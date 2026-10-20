import { SsrfGuard } from '../webhooks/ssrf-guard.js';
import { ApiError } from '../../utils/api-error.js';

/** Replaces {{key}} with the input value. JSON mode escapes values so they cannot break out of a JSON string. */
export function renderTemplate(template: string, values: Record<string, unknown>, mode: 'text' | 'json' | 'url' = 'text'): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_m, key: string) => {
    const raw = values[key];
    const s = raw === undefined || raw === null ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    if (mode === 'url') return encodeURIComponent(s);
    if (mode === 'json') return JSON.stringify(s).slice(1, -1);
    return s;
  });
}

/** Dot-path lookup (`data.items.0.price`). Returns undefined for anything missing; never throws. */
export function pickPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export interface ApiToolRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  responseMapping: Record<string, string>;
  authMode: 'none' | 'bearer' | 'header';
  authHeaderName: string;
  timeoutMs: number;
}

const MAX_RESPONSE_BYTES = 256 * 1024;
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding']);

/** Performs the HTTP call of an API tool. SSRF-guarded, https only (http allowed solely for localhost in tests). */
export async function executeApiTool(
  cfg: ApiToolRequest,
  input: Record<string, unknown>,
  secret: string | null,
  opts: { allowLocalForTesting?: boolean } = {},
): Promise<{ status: number; output: Record<string, unknown>; raw: unknown }> {
  const url = renderTemplate(cfg.url, input, 'url');
  if (!opts.allowLocalForTesting && !url.startsWith('https://')) {
    throw new ApiError(400, 'TOOL_URL_INSECURE', 'API tools must use an https:// URL.');
  }
  SsrfGuard.assertSafeUrl(url, opts.allowLocalForTesting);

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.headers)) {
    if (FORBIDDEN_HEADERS.has(k.toLowerCase())) continue;
    headers[k] = renderTemplate(v, input).replace(/[\r\n]/g, ' ');
  }
  if (secret && cfg.authMode === 'bearer') headers.Authorization = `Bearer ${secret}`;
  if (secret && cfg.authMode === 'header') headers[cfg.authHeaderName] = secret;

  const hasBody = cfg.method !== 'GET' && cfg.body.trim().length > 0;
  const body = hasBody ? renderTemplate(cfg.body, input, 'json') : undefined;
  if (hasBody && !Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method: cfg.method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  if (res.status >= 300 && res.status < 400) {
    throw new ApiError(502, 'TOOL_REDIRECT_BLOCKED', 'The tool endpoint tried to redirect; redirects are not followed.');
  }
  const text = (await res.text()).slice(0, MAX_RESPONSE_BYTES);
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* plain text response */
  }
  const output: Record<string, unknown> = {};
  const entries = Object.entries(cfg.responseMapping);
  if (entries.length === 0) output.response = raw;
  for (const [name, path] of entries) output[name] = pickPath(raw, path);
  if (!res.ok) throw new ApiError(502, 'TOOL_HTTP_ERROR', `The endpoint answered HTTP ${res.status}.`, { output });
  return { status: res.status, output, raw };
}
