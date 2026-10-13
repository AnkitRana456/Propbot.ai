import type { TelephonyProvider, OutboundCallOptions, OutboundCallResult } from './telephony-provider.interface.js';
import { pino } from 'pino';

const logger = pino({ name: 'mock-telephony-provider', level: process.env.LOG_LEVEL ?? 'info' });

export class MockTelephonyProvider implements TelephonyProvider {
  async initiateCall(options: OutboundCallOptions): Promise<OutboundCallResult> {
    const callSid = `call_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logger.info(
      { callSid, to: options.to, from: options.from, companyId: options.companyId },
      'Mock telephony call initiated successfully',
    );

    return {
      callSid,
      provider: 'mock_telephony',
      status: 'initiated',
      details: {
        to: options.to,
        from: options.from,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async transferCall(callSid: string, transferTo: string): Promise<{ success: boolean }> {
    logger.info({ callSid, transferTo }, 'Transferred call to human agent');
    return { success: true };
  }

  async terminateCall(callSid: string): Promise<{ success: boolean }> {
    logger.info({ callSid }, 'Terminated call');
    return { success: true };
  }
}
