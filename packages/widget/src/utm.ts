/**
 * Attribution capture. UTM values are read from the landing URL on first load and cached in
 * sessionStorage so they survive in-site navigation; later URL values do not overwrite earlier ones
 * unless the visitor arrives with a new campaign.
 */
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_sub_source',
  'utm_agencypartner',
] as const;

const STORAGE_KEY = 'propbot_utm';

function readStore(): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function captureUtmParams(search: string = window.location.search): Record<string, string> {
  const params = new URLSearchParams(search);
  const fresh: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v && v.trim()) fresh[key] = v.trim().slice(0, 200);
  }
  // Storage may be unavailable (privacy mode); attribution then simply is not persisted.
  const stored = readStore();
  const merged = Object.keys(fresh).length > 0 ? { ...stored, ...fresh } : stored;
  if (Object.keys(fresh).length > 0) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }
  return merged;
}
