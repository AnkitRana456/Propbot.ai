import { describe, it, expect, beforeEach } from 'vitest';
import {
  conversionTrackingService,
  mockPixelProvider,
} from '../../src/modules/integrations/conversion-tracking.service.js';

describe('Ad Conversion Tracking & Strict Consent Mode Guard', () => {
  const companyId = '99999999-9999-9999-9999-999999999914';

  beforeEach(() => {
    mockPixelProvider.clear();
  });

  it('Conversion pixel event is strictly dropped when consent is NOT given', async () => {
    const res = await conversionTrackingService.trackConversion(companyId, {
      eventName: 'Lead',
      leadId: '00000000-0000-0000-0000-000000000001',
      consentGiven: false, // User declined tracking cookies/consent
      metadata: { value: 15000000, currency: 'INR' },
    });

    expect(res.fired).toBe(false);
    expect(res.reason).toBe('CONSENT_DENIED');

    // Verify no event was dispatched or recorded
    const events = mockPixelProvider.getEvents();
    expect(events.length).toBe(0);
  });

  it('Conversion pixel event fires and dispatches when consent IS given', async () => {
    const res = await conversionTrackingService.trackConversion(companyId, {
      eventName: 'Schedule',
      leadId: '00000000-0000-0000-0000-000000000002',
      consentGiven: true, // User accepted consent
      metadata: { appointmentType: 'site_visit' },
    });

    expect(res.fired).toBe(true);
    expect(res.eventId).toBeDefined();

    // Verify event was recorded by mock provider
    const events = mockPixelProvider.getEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.eventName).toBe('Schedule');
    expect(events[0]?.leadId).toBe('00000000-0000-0000-0000-000000000002');
  });
});
