/**
 * Zero-dependency HTML sanitizer for PropBot Widget.
 * Sanitizes markdown and AI-generated outputs before inserting into Shadow DOM.
 * Strips script tags, active event handlers (onerror, onclick, etc.), javascript: URIs,
 * and dangerous elements (iframe, object, embed).
 */

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'ul',
]);

const ALLOWED_ATTRS = new Set(['href', 'title', 'target', 'rel', 'class', 'style']);

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  // 1. Remove dangerous script and iframe blocks entirely
  let clean = dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');

  // 2. Strip inline event handlers (onerror, onload, onclick, etc.)
  clean = clean.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3. Strip javascript: and data: URI schemes in href or src
  clean = clean.replace(/\b(href|src)\s*=\s*(["'])\s*(javascript|data):/gi, '$1=$2#blocked-');

  // 4. Tag and attribute whitelist filtering
  clean = clean.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName, attrs) => {
    const lowerTag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) {
      // Disallowed tag: escape it safely
      return `&lt;${match.slice(1, -1)}&gt;`;
    }

    if (match.startsWith('</')) {
      return `</${lowerTag}>`;
    }

    // Filter attributes on allowed tags
    const sanitizedAttrs: string[] = [];
    const attrRegex = /([a-z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1]!.toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      if (ALLOWED_ATTRS.has(attrName)) {
        // Enforce safe external link attributes
        if (attrName === 'href' && !attrValue.startsWith('http') && !attrValue.startsWith('/')) {
          continue;
        }
        sanitizedAttrs.push(`${attrName}="${attrValue.replace(/"/g, '&quot;')}"`);
      }
    }

    const attrString = sanitizedAttrs.length > 0 ? ' ' + sanitizedAttrs.join(' ') : '';
    return `<${lowerTag}${attrString}>`;
  });

  return clean;
}
