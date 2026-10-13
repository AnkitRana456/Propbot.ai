import type { PixelEventInput } from '@propbot/shared';
import { pino } from 'pino';

const logger = pino({ name: 'conversion-tracking', level: process.env.LOG_LEVEL || 'info' });

export interface RecordedPixelEvent {
  companyId: string;
  eventName: string;
  leadId?: string;
  chatbotId?: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export class MockPixelProvider {
  private events: RecordedPixelEvent[] = [];

  record(event: RecordedPixelEvent): void {
    this.events.push(event);
  }

  getEvents(): RecordedPixelEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

export const mockPixelProvider = new MockPixelProvider();

export class ConversionTrackingService {
  /**
   * Tracks an ad conversion event (Meta Pixel / CAPI / Google Ads).
   * STRICT CONSENT GUARD: Only fires when consentGiven is explicitly true.
   */
  async trackConversion(
    companyId: string,
    input: PixelEventInput,
  ): Promise<{ fired: boolean; reason?: string; eventId?: string }> {
    if (!input.consentGiven) {
      logger.info(
        { companyId, eventName: input.eventName },
        'User consent NOT given. Conversion pixel event blocked by consent guard.',
      );
      return {
        fired: false,
        reason: 'CONSENT_DENIED',
      };
    }

    const eventId = `capi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const recordedEvent: RecordedPixelEvent = {
      companyId,
      eventName: input.eventName,
      leadId: input.leadId,
      chatbotId: input.chatbotId,
      timestamp: new Date().toISOString(),
      metadata: input.metadata || {},
    };

    mockPixelProvider.record(recordedEvent);
    logger.info(
      { companyId, eventName: input.eventName, eventId },
      'Conversion pixel event dispatched to Meta CAPI / Google Ads',
    );

    return {
      fired: true,
      eventId,
    };
  }
}

export const conversionTrackingService = new ConversionTrackingService();
