// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  fireLeadConversion,
  sanitizeCustomScript,
  runSandboxedCustomScript,
  LEAD_FORM_BODY_SELECTOR,
  type WidgetTrackingConfig,
} from '../src/tracking.js';

const cfg = (over: Partial<WidgetTrackingConfig> = {}): WidgetTrackingConfig => ({
  gtmEnabled: true,
  googleAds: { conversionId: 'AW-123456789', conversionLabel: 'AbC-d_123', currency: 'INR', value: 1 },
  metaPixelId: '1234567890',
  taboolaEnabled: true,
  customScript: '',
  ...over,
});

const lead = {
  name: 'Asha',
  phone: '+919876543210',
  email: 'Asha@Example.com',
  chatbotId: 'bot-1',
  conversationId: 'conv-1',
  source: 'chat',
  utmParams: { utm_source: 'google', utm_agencypartner: 'acme' },
};

function freshWin() {
  const w = window as unknown as Record<string, unknown>;
  delete w.dataLayer;
  delete w.gtag;
  delete w.fbq;
  delete w._tfa;
  return window as never;
}

describe('fireLeadConversion', () => {
  it('fires every channel: dataLayer event, synthetic submit, Google Ads, Meta Lead, Taboola', async () => {
    const win = freshWin();
    const gtag = vi.fn();
    const fbq = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    (window as unknown as Record<string, unknown>).fbq = fbq;

    const host = document.createElement('div');
    host.innerHTML = '<div class="propbot-lead-form-body"></div>';
    document.body.appendChild(host);
    const body = host.querySelector(LEAD_FORM_BODY_SELECTOR)!;
    const submitSeen = vi.fn();
    document.addEventListener('submit', submitSeen); // like GTM's native Form Submission trigger

    const fired = await fireLeadConversion(cfg(), lead, body, win);

    expect(fired).toEqual(['gtm_datalayer', 'gtm_submit_event', 'google_ads', 'meta_lead', 'taboola']);

    const dl = (window as unknown as { dataLayer: Record<string, unknown>[] }).dataLayer;
    expect(dl[0]).toMatchObject({
      event: 'propbot_lead_submit',
      propbot_chatbot_id: 'bot-1',
      utm_source: 'google',
      utm_agencypartner: 'acme',
      currency: 'INR',
      value: 1,
    });
    // no raw PII in the dataLayer
    expect(JSON.stringify(dl)).not.toMatch(/9876543210|Example\.com|Asha/);

    expect(submitSeen).toHaveBeenCalledTimes(1);
    expect(submitSeen.mock.calls[0]![0].target).toBe(body);

    expect(gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({
      send_to: 'AW-123456789/AbC-d_123',
      currency: 'INR',
      value: 1,
    }));

    const metaLead = fbq.mock.calls.find(c => c[0] === 'track');
    expect(metaLead?.[1]).toBe('Lead');
    const setCall = fbq.mock.calls.find(c => c[0] === 'set');
    expect(setCall?.[2].em).toMatch(/^[0-9a-f]{64}$/); // hashed, never raw
    expect(JSON.stringify(fbq.mock.calls)).not.toMatch(/Example\.com/i);

    expect((window as unknown as { _tfa: unknown[] })._tfa).toContainEqual({ notify: 'event', name: 'lead_capture' });
    document.removeEventListener('submit', submitSeen);
  });

  it('a missing or throwing pixel never breaks the others or the form', async () => {
    const win = freshWin();
    (window as unknown as Record<string, unknown>).gtag = () => {
      throw new Error('gtag exploded');
    };
    // fbq not defined at all
    const fired = await fireLeadConversion(cfg(), lead, null, win);
    expect(fired).toContain('gtm_datalayer');
    expect(fired).toContain('taboola');
    expect(fired).not.toContain('google_ads');
    expect(fired).not.toContain('meta_lead');
  });

  it('does nothing without config and skips Google Ads without ID/label (nothing hardcoded)', async () => {
    const win = freshWin();
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;
    expect(await fireLeadConversion(undefined, lead, null, win)).toEqual([]);
    await fireLeadConversion(cfg({ googleAds: { conversionId: '', conversionLabel: '', currency: 'INR', value: 1 } }), lead, null, win);
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe('custom pixel sandbox', () => {
  it('strips event handlers, javascript: URLs and nested iframes/forms but keeps the script', () => {
    const clean = sanitizeCustomScript(
      '<script>window.px=1</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a><iframe src="//evil"></iframe><form action="//evil"></form>',
    );
    expect(clean).toContain('<script>window.px=1</script>');
    expect(clean).not.toMatch(/onerror|javascript:|<iframe|<form/i);
  });

  it('runs inside an opaque-origin sandboxed iframe (allow-scripts only)', () => {
    const ok = runSandboxedCustomScript('<script>1+1</script>', document);
    expect(ok).toBe(true);
    const frame = document.querySelector('iframe[sandbox]') as HTMLIFrameElement;
    expect(frame).toBeTruthy();
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.srcdoc).toContain('1+1');
    expect(runSandboxedCustomScript('   ', document)).toBe(false);
  });
});
