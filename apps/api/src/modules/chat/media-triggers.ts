/**
 * Real-estate media triggers (spec section 6). Pure functions: given the visitor's message (and whether
 * it is the first one) decide which media kinds to show; given a project's media, build the items.
 *
 *  - First message: highlight photos (if the project has any)
 *  - Floor plans:   "2bhk", "3bhk", "carpet area", "floor plan", "layout", ...
 *  - Master plan:   "master plan", "site plan", "project layout", ...
 *  - Location map:  "location", "directions", "where", "how to reach" -> embedded Google Maps iframe
 */

export type MediaKind = 'highlight_photos' | 'floor_plan' | 'master_plan' | 'location_map';

export interface MediaItem {
  kind: MediaKind;
  title: string;
  /** Images (https only). */
  urls?: string[];
  /** Whitelisted Google Maps embed URL, rendered by the widget as an iframe. */
  embedUrl?: string;
  caption?: string;
}

export interface MediaProject {
  name: string;
  location?: string;
  highlightPhotos: string[];
  gallery: string[];
  floorPlans: Array<{ title: string; bhk: number; carpetAreaSqft?: number; planUrl: string }>;
  masterPlanUrl: string | null;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
}

const MASTER_PLAN = [/\bmaster\s*-?\s*plan\b/i, /\bsite\s*-?\s*plan\b/i, /\bproject\s+layout\b/i, /\bsite\s+layout\b/i, /\blayout\s+plan\s+of\s+(the\s+)?(project|township|site)\b/i];
const FLOOR_PLAN = [
  /\b[1-9]\s*-?\s*bhk\b/i,
  /\bcarpet\s+area\b/i,
  /\bsuper\s+(built\s*-?\s*up\s+)?area\b/i,
  /\bfloor\s*-?\s*plans?\b/i,
  /\bunit\s+plans?\b/i,
  /\blayouts?\b/i,
];
const LOCATION = [/\blocation\b/i, /\bdirections?\b/i, /\bwhere\b/i, /\bhow\s+to\s+reach\b/i, /\bgoogle\s+maps?\b/i];

const anyMatch = (patterns: RegExp[], text: string) => patterns.some(p => p.test(text));

export function detectMediaKinds(message: string, isFirstMessage: boolean): MediaKind[] {
  const kinds: MediaKind[] = [];
  if (isFirstMessage) kinds.push('highlight_photos');

  const wantsMaster = anyMatch(MASTER_PLAN, message);
  // "project layout" is a master-plan request; it must not also fire the generic "layout" floor-plan trigger
  const withoutMasterPhrases = message.replace(/\bproject\s+layout\b|\bsite\s+layout\b/gi, ' ');
  const wantsFloor = anyMatch(FLOOR_PLAN, withoutMasterPhrases);
  if (wantsFloor) kinds.push('floor_plan');
  if (wantsMaster) kinds.push('master_plan');
  if (anyMatch(LOCATION, message)) kinds.push('location_map');
  return kinds;
}

const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u);

/** Only Google Maps embeds are allowed into the widget iframe. */
export function buildMapEmbedUrl(project: Pick<MediaProject, 'mapUrl' | 'latitude' | 'longitude'>): string | null {
  const { mapUrl, latitude, longitude } = project;
  if (isHttps(mapUrl) && /^https:\/\/www\.google\.com\/maps\/embed\?/i.test(mapUrl)) return mapUrl;
  if (latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `https://www.google.com/maps?q=${latitude},${longitude}&output=embed`;
  }
  return null;
}

/** BHK count mentioned in the message ("3 bhk" -> 3) so the right floor plan is shown first. */
export function requestedBhk(message: string): number | null {
  const m = /\b([1-9])\s*-?\s*bhk\b/i.exec(message);
  return m ? Number(m[1]) : null;
}

export function buildMediaItems(kinds: MediaKind[], project: MediaProject, message: string): MediaItem[] {
  const items: MediaItem[] = [];
  for (const kind of kinds) {
    if (kind === 'highlight_photos') {
      // Dedicated highlight photos win; otherwise the first gallery images
      const source = project.highlightPhotos.length ? project.highlightPhotos : project.gallery.slice(0, 3);
      const urls = source.filter(isHttps).slice(0, 5);
      if (urls.length) items.push({ kind, title: `${project.name} highlights`, urls });
    } else if (kind === 'floor_plan') {
      const bhk = requestedBhk(message);
      const plans = project.floorPlans.filter(p => isHttps(p.planUrl));
      const matching = bhk ? plans.filter(p => p.bhk === bhk) : [];
      const chosen = (matching.length ? matching : plans).slice(0, 4);
      if (chosen.length) {
        items.push({
          kind,
          title: bhk && matching.length ? `${bhk} BHK floor plans` : 'Floor plans',
          urls: chosen.map(p => p.planUrl),
          caption: chosen
            .map(p => `${p.title}${p.carpetAreaSqft ? ` (${p.carpetAreaSqft} sq ft carpet)` : ''}`)
            .join(' | '),
        });
      }
    } else if (kind === 'master_plan') {
      if (isHttps(project.masterPlanUrl)) items.push({ kind, title: `${project.name} master plan`, urls: [project.masterPlanUrl] });
    } else if (kind === 'location_map') {
      const embedUrl = buildMapEmbedUrl(project);
      if (embedUrl) items.push({ kind, title: `${project.name} location`, embedUrl });
    }
  }
  return items;
}
