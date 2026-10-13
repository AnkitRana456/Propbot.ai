import { voiceService, voiceLogger } from './voice.service.js';

export interface DomainEventPayload {
  id: string;
  companyId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export class VoiceCallbackConsumer {
  /**
   * Handles outbox events for automated lead callbacks.
   */
  async handleEvent(event: DomainEventPayload): Promise<void> {
    if (event.type !== 'lead_created' && event.type !== 'voice_callback_requested') {
      return;
    }

    const payload = event.payload;
    const leadId = (payload.leadId || payload.lead_id) as string | undefined;

    if (!leadId) {
      voiceLogger.warn(
        { eventId: event.id, companyId: event.companyId },
        'VoiceCallbackConsumer skipped: no leadId found in payload',
      );
      return;
    }

    voiceLogger.info(
      { leadId, companyId: event.companyId, eventType: event.type },
      'VoiceCallbackConsumer processing lead callback event',
    );

    try {
      const bypassCallingHours = Boolean(payload.bypassCallingHours);
      const customGreeting = typeof payload.greeting === 'string' ? payload.greeting : undefined;

      const result = await voiceService.initiateCallback(event.companyId, leadId, {
        bypassCallingHours,
        customGreeting,
      });

      voiceLogger.info(
        { leadId, companyId: event.companyId, status: result.status },
        'VoiceCallbackConsumer callback evaluation finished',
      );
    } catch (err) {
      voiceLogger.error(
        { err, leadId, companyId: event.companyId },
        'VoiceCallbackConsumer failed to initiate callback',
      );
      // We do not rethrow fatal error to avoid indefinitely wedging unrelated outbox consumers
    }
  }
}

export const voiceCallbackConsumer = new VoiceCallbackConsumer();
