import type { VoiceProvider, VoiceSessionOptions, VoiceSessionResult } from './voice-provider.interface.js';
import { pino } from 'pino';

const logger = pino({ name: 'mock-voice-provider', level: process.env.LOG_LEVEL ?? 'info' });

export class MockVoiceProvider implements VoiceProvider {
  async createSession(options: VoiceSessionOptions): Promise<VoiceSessionResult> {
    const sessionId = `vsession_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const projectName = options.projectName || 'Prestige Sanctuary';
    const contactName = options.contactName || 'there';

    // Mandatory AI disclosure at call start (PDF requirement: The AI states at the start that it is an AI assistant)
    const discloseAiText = `Namaste ${contactName}! I am PropBot's AI assistant calling on behalf of ${projectName}. I am here to help answer questions regarding our residences, floor plans, and to schedule a private site visit preview. Would you like to hear about our available units, or shall I transfer you directly to one of our senior property consultants?`;

    logger.info({ sessionId, companyId: options.companyId, leadId: options.leadId }, 'Created mock voice session with mandatory AI disclosure');

    return {
      sessionId,
      agentName: 'PropBot AI Voice Assistant',
      discloseAiText,
      sessionUrl: `https://voice.propbot.io/session/${sessionId}`,
    };
  }

  async endSession(sessionId: string): Promise<void> {
    logger.info({ sessionId }, 'Ended mock voice session');
  }
}
