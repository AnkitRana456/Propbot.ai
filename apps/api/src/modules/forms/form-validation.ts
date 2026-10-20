import { validatePhone, type FormFieldInput } from '@propbot/shared';

export type FieldDef = Pick<FormFieldInput, 'key' | 'label' | 'type' | 'required' | 'options' | 'validation' | 'defaultValue'>;

export interface ValidationResult {
  /** Normalised values for the keys that passed. */
  values: Record<string, unknown>;
  /** Human-readable problems by field key. */
  errors: Record<string, string>;
}

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'haan', 'ha']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'nahi', 'nahin']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[,₹\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    return Number(cleaned);
  }
  return null;
}

function matchOption(options: string[], raw: string): string | null {
  const wanted = raw.trim().toLowerCase();
  return options.find(o => o.toLowerCase() === wanted) ?? null;
}

/** Validates and normalises one value. Returns the normalised value or an error message. */
export function coerceFieldValue(field: FieldDef, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const v = field.validation ?? {};
  const fail = (error: string) => ({ ok: false as const, error });

  switch (field.type) {
    case 'text':
    case 'longtext': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return fail(`${field.label} must be text.`);
      const s = String(raw).replace(CONTROL_CHARS, '').trim();
      const max = v.maxLength ?? (field.type === 'longtext' ? 5000 : 500);
      if (s.length > max) return fail(`${field.label} must be at most ${max} characters.`);
      if (v.minLength !== undefined && s.length < v.minLength) return fail(`${field.label} must be at least ${v.minLength} characters.`);
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(s.slice(0, 1000))) return fail(`${field.label} has an invalid format.`);
        } catch {
          /* an invalid admin pattern must not block data capture */
        }
      }
      return { ok: true, value: s };
    }
    case 'number':
    case 'currency': {
      const n = toNumber(raw);
      if (n === null) return fail(`${field.label} must be a number.`);
      if (field.type === 'currency' && n < 0) return fail(`${field.label} cannot be negative.`);
      if (v.min !== undefined && n < v.min) return fail(`${field.label} must be at least ${v.min}.`);
      if (v.max !== undefined && n > v.max) return fail(`${field.label} must be at most ${v.max}.`);
      return { ok: true, value: n };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      const s = String(raw).trim().toLowerCase();
      if (TRUE_WORDS.has(s)) return { ok: true, value: true };
      if (FALSE_WORDS.has(s)) return { ok: true, value: false };
      return fail(`${field.label} must be yes or no.`);
    }
    case 'select': {
      const hit = matchOption(field.options, String(raw));
      return hit ? { ok: true, value: hit } : fail(`${field.label} must be one of: ${field.options.join(', ')}.`);
    }
    case 'multiselect': {
      const items = Array.isArray(raw) ? raw : String(raw).split(',');
      const picked: string[] = [];
      for (const item of items) {
        const hit = matchOption(field.options, String(item));
        if (!hit) return fail(`${field.label} contains an unknown choice "${String(item).slice(0, 40)}".`);
        if (!picked.includes(hit)) picked.push(hit);
      }
      return { ok: true, value: picked };
    }
    case 'date': {
      const s = String(raw).trim();
      const d = /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s) : new Date(NaN);
      if (Number.isNaN(d.getTime())) return fail(`${field.label} must be a date (YYYY-MM-DD).`);
      return { ok: true, value: d.toISOString().slice(0, 10) };
    }
    case 'phone': {
      const res = validatePhone(String(raw));
      return res.valid && res.e164 ? { ok: true, value: res.e164 } : fail(`${field.label} must be a valid phone number.`);
    }
    case 'email': {
      const s = String(raw).trim().toLowerCase();
      return EMAIL.test(s) && s.length <= 255 ? { ok: true, value: s } : fail(`${field.label} must be a valid e-mail address.`);
    }
    case 'url': {
      const s = String(raw).trim();
      return /^https?:\/\/[^\s]+$/i.test(s) && s.length <= 2048 ? { ok: true, value: s } : fail(`${field.label} must be a valid http(s) URL.`);
    }
    default:
      return fail(`${field.label} has an unsupported type.`);
  }
}

/**
 * Validates `input` against the field list. Unknown keys are dropped (never stored).
 * With `partial: true` missing required fields are not errors (used while a chat is still collecting data).
 */
export function validateFormValues(
  fields: FieldDef[],
  input: Record<string, unknown>,
  opts: { partial?: boolean } = {},
): ValidationResult {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const raw = input[field.key];
    if (isEmpty(raw)) {
      if (!opts.partial && field.required && isEmpty(field.defaultValue)) errors[field.key] = `${field.label} is required.`;
      else if (!opts.partial && !isEmpty(field.defaultValue)) values[field.key] = field.defaultValue;
      continue;
    }
    const res = coerceFieldValue(field, raw);
    if (res.ok) values[field.key] = res.value;
    else errors[field.key] = res.error;
  }
  return { values, errors };
}

/** Real-estate starter attributes created for a company the first time it opens Forms. */
export const STARTER_BUYER_PROFILE: { key: string; name: string; description: string; fields: Array<Omit<FormFieldInput, 'validation'> & { validation?: FormFieldInput['validation'] }> } = {
  key: 'buyer_profile',
  name: 'Buyer profile',
  description: 'What a buyer is looking for. Agents ask for these in chat and store them on the lead.',
  fields: [
    { key: 'budget_max', label: 'Maximum budget (INR)', type: 'currency', required: false, options: [], collectInChat: true, position: 0, aiHint: 'Ask for the budget range; convert lakhs/crores to a plain rupee number (1 Cr = 10000000).' },
    { key: 'bhk', label: 'Preferred configuration', type: 'multiselect', required: false, options: ['1BHK', '2BHK', '3BHK', '4BHK', '5BHK+', 'Villa', 'Plot'], collectInChat: true, position: 1, aiHint: 'Ask which home sizes they want.' },
    { key: 'preferred_location', label: 'Preferred location', type: 'text', required: false, options: [], collectInChat: true, position: 2, aiHint: 'Ask which area or locality they prefer.' },
    { key: 'purpose', label: 'Purpose', type: 'select', required: false, options: ['End use', 'Investment', 'Second home'], collectInChat: true, position: 3, aiHint: 'Ask whether this is for living in, investment or a second home.' },
    { key: 'possession_timeline', label: 'Possession timeline', type: 'select', required: false, options: ['Ready to move', 'Within 6 months', '6-12 months', '1-2 years', 'Flexible'], collectInChat: true, position: 4, aiHint: 'Ask when they want to move in.' },
    { key: 'loan_needed', label: 'Home loan needed', type: 'boolean', required: false, options: [], collectInChat: true, position: 5, aiHint: 'Ask whether they will need a home loan.' },
    { key: 'site_visit_date', label: 'Preferred site visit date', type: 'date', required: false, options: [], collectInChat: true, position: 6, aiHint: 'Offer a site visit and ask for a preferred date.' },
  ],
};
