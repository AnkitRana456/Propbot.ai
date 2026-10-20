import DOMPurify from 'dompurify';

/**
 * Conversion tracking fired when a lead is saved (spec section 4).
 *
 * Every channel is isolated in its own try/catch and only runs when the host page has actually
 * loaded that pixel, so a missing or broken pixel can never break the lead form.
 */

export interface WidgetTrackingConfig {
  gtmEnabled: boolean;
  googleAds: { conversionId: string; conversionLabel: string; currency: string; value: number };
  metaPixelId: string;
  taboolaEnabled: boolean;
  customScript: string;
}

export interface LeadConversionData {
  name: string;
  phone: string;
  email?: string;
  chatbotId?: string;
  conversationId?: string | null;
  source?: string;
  utmParams?: Record<string, string>;
  pageUrl?: string;
}

type AnyWin = Window &
  typeof globalThis & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _tfa?: unknown[];
  };

export const LEAD_FORM_BODY_SELECTOR = '.propbot-lead-form-body';

async function sha256Hex(value: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/** Returns which channels fired, which is also handy for tests and debugging. */
export async function fireLeadConversion(
  cfg: WidgetTrackingConfig | undefined,
  lead: LeadConversionData,
  formBody: Element | null,
  win: AnyWin = window as AnyWin,
): Promise<string[]> {
  const fired: string[] = [];
  if (!cfg) return fired;

  const eventId = `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const { currency, value } = cfg.googleAds;

  // 1. GTM dataLayer event (no direct identifiers: name / phone / email are not pushed)
  if (cfg.gtmEnabled) {
    try {
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push({
        event: 'propbot_lead_submit',
        propbot_event_id: eventId,
        propbot_chatbot_id: lead.chatbotId ?? '',
        propbot_conversation_id: lead.conversationId ?? '',
        propbot_lead_source: lead.source ?? 'chat',
        propbot_has_email: Boolean(lead.email),
        propbot_page_url: lead.pageUrl ?? '',
        ...(lead.utmParams ?? {}),
        value,
        currency,
      });
      fired.push('gtm_datalayer');
    } catch {
      /* never break the form */
    }

    // 2. Synthetic native submit event. The widget form is a React-style handler that calls
    //    preventDefault, so GTM's "Form Submission" trigger never sees a real submit; dispatching
    //    one (composed, so it crosses the shadow-DOM boundary) lets that trigger fire.
    try {
      if (formBody) {
        const evt = new Event('submit', { bubbles: true, cancelable: true, composed: true });
        formBody.dispatchEvent(evt);
        fired.push('gtm_submit_event');
      }
    } catch {
      /* ignore */
    }
  }

  // 3. Google Ads conversion (ID + label are per-chatbot config)
  try {
    const { conversionId, conversionLabel } = cfg.googleAds;
    if (conversionId && conversionLabel && typeof win.gtag === 'function') {
      win.gtag('event', 'conversion', {
        send_to: `${conversionId}/${conversionLabel}`,
        currency,
        value,
        transaction_id: eventId,
      });
      fired.push('google_ads');
    }
  } catch {
    /* ignore */
  }

  // 4. Meta Pixel "Lead" with hashed user data (advanced matching never receives raw PII)
  try {
    if (cfg.metaPixelId && typeof win.fbq === 'function') {
      const em = lead.email ? await sha256Hex(lead.email.trim().toLowerCase()) : null;
      const ph = await sha256Hex(lead.phone.replace(/\D/g, ''));
      const userData: Record<string, string> = {};
      if (em) userData.em = em;
      if (ph) userData.ph = ph;
      if (Object.keys(userData).length > 0) win.fbq('set', 'userData', userData);
      win.fbq(
        'track',
        'Lead',
        {
          content_name: lead.chatbotId ?? 'propbot',
          lead_source: lead.source ?? 'chat',
          currency,
          value,
        },
        { eventID: eventId },
      );
      fired.push('meta_lead');
    }
  } catch {
    /* ignore */
  }

  // 5. Taboola (the _tfa queue is safe to push to even before the Taboola script loads)
  try {
    if (cfg.taboolaEnabled) {
      win._tfa = win._tfa || [];
      win._tfa.push({ notify: 'event', name: 'lead_capture' });
      fired.push('taboola');
    }
  } catch {
    /* ignore */
  }

  // 6. Custom client script, sanitized and isolated
  try {
    if (cfg.customScript && cfg.customScript.trim() && runSandboxedCustomScript(cfg.customScript, win.document)) {
      fired.push('custom_script');
    }
  } catch {
    /* ignore */
  }

  return fired;
}

/** Sanitizes the snippet and runs it inside an opaque-origin sandboxed iframe. */
export function sanitizeCustomScript(html: string): string {
  // DOMPurify drops scripts by default; tracking snippets need them, so they are re-allowed here and
  // contained by the iframe sandbox. Event-handler attributes, javascript: URLs, iframes, objects,
  // embeds and forms are still stripped by DOMPurify.
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['script'],
    FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
    FORBID_ATTR: ['srcdoc'],
    FORCE_BODY: true, // a leading <script> would otherwise be parsed into <head> and dropped
  });
}

export function runSandboxedCustomScript(html: string, doc: Document): boolean {
  const clean = sanitizeCustomScript(html);
  if (!clean.trim()) return false;

  const frame = doc.createElement('iframe');
  // allow-scripts only: no allow-same-origin (so no access to the host page, cookies or storage),
  // no top navigation, no popups, no forms.
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`;
  (doc.body || doc.documentElement).appendChild(frame);
  setTimeout(() => frame.remove(), 30_000);
  return true;
}
