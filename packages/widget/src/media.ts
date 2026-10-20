/**
 * Renders the media the API attaches to a chat reply (highlight photos, floor plans, master plan,
 * location map). The API already filters to https URLs and Google Maps embeds; the widget re-validates
 * everything because it must never trust markup or URLs that arrive over the network.
 */
export interface WidgetMediaItem {
  kind: 'highlight_photos' | 'floor_plan' | 'master_plan' | 'location_map';
  title: string;
  urls?: string[];
  embedUrl?: string;
  caption?: string;
}

const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/i;
const MAPS_EMBED = /^https:\/\/www\.google\.com\/maps(\/embed)?\?[^\s"'<>]+$/i;

export const MEDIA_STYLES = `
  .propbot-media { display: flex; flex-direction: column; gap: 10px; margin: 6px 0 10px; max-width: 92%; }
  .propbot-media-card { background: rgba(127,127,127,0.08); border: 1px solid rgba(127,127,127,0.25); border-radius: 12px; padding: 8px; }
  .propbot-media-title { font-size: 12px; font-weight: 600; margin: 0 0 6px; opacity: 0.85; }
  .propbot-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
  .propbot-media-grid a { display: block; border-radius: 8px; overflow: hidden; line-height: 0; }
  .propbot-media-grid img { width: 100%; height: 78px; object-fit: cover; display: block; }
  .propbot-media-single img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 8px; background: #fff; }
  .propbot-media-caption { font-size: 11px; margin: 6px 0 0; opacity: 0.75; }
  .propbot-media-map { width: 100%; height: 190px; border: 0; border-radius: 8px; }
`;

export function isSafeImageUrl(u: unknown): u is string {
  return typeof u === 'string' && HTTPS_URL.test(u);
}

export function isSafeMapUrl(u: unknown): u is string {
  return typeof u === 'string' && MAPS_EMBED.test(u);
}

function imageLink(doc: Document, url: string, alt: string): HTMLAnchorElement {
  const a = doc.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const img = doc.createElement('img');
  img.src = url;
  img.alt = alt;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  a.appendChild(img);
  return a;
}

/** Returns a container with one card per renderable item, or null when nothing is renderable. */
export function renderMediaItems(items: unknown, doc: Document = document): HTMLElement | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const wrap = doc.createElement('div');
  wrap.className = 'propbot-media';

  for (const raw of items.slice(0, 4)) {
    const item = raw as Partial<WidgetMediaItem>;
    const title = typeof item.title === 'string' ? item.title.slice(0, 120) : '';
    const card = doc.createElement('div');
    card.className = 'propbot-media-card';
    card.setAttribute('data-kind', String(item.kind));

    if (item.kind === 'location_map') {
      if (!isSafeMapUrl(item.embedUrl)) continue;
      const iframe = doc.createElement('iframe');
      iframe.className = 'propbot-media-map';
      iframe.src = item.embedUrl;
      iframe.title = title || 'Project location';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer';
      // The map is a third-party page: scripts may run in its own origin, but it cannot navigate us,
      // open popups or submit forms
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.setAttribute('allowfullscreen', '');
      card.appendChild(iframe);
    } else if (item.kind === 'highlight_photos' || item.kind === 'floor_plan' || item.kind === 'master_plan') {
      const urls = (Array.isArray(item.urls) ? item.urls : []).filter(isSafeImageUrl).slice(0, 6);
      if (urls.length === 0) continue;
      const body = doc.createElement('div');
      body.className = urls.length === 1 ? 'propbot-media-single' : 'propbot-media-grid';
      for (const url of urls) body.appendChild(imageLink(doc, url, title));
      card.appendChild(body);
    } else {
      continue;
    }

    if (title) {
      const h = doc.createElement('p');
      h.className = 'propbot-media-title';
      h.textContent = title; // textContent: never innerHTML for server-provided strings
      card.insertBefore(h, card.firstChild);
    }
    if (typeof item.caption === 'string' && item.caption) {
      const c = doc.createElement('p');
      c.className = 'propbot-media-caption';
      c.textContent = item.caption.slice(0, 300);
      card.appendChild(c);
    }
    wrap.appendChild(card);
  }

  return wrap.childElementCount > 0 ? wrap : null;
}
