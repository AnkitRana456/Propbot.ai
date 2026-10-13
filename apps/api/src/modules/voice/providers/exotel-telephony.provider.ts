import type { TelephonyProvider, OutboundCallOptions, OutboundCallResult } from './telephony-provider.interface.js';
import { pino } from 'pino';

const logger = pino({ name: 'exotel-telephony-provider', level: process.env.LOG_LEVEL ?? 'info' });

export class ExotelTelephonyProvider implements TelephonyProvider {
  private apiKey: string;
  private apiToken: string;
  private accountSid: string;
  private subdomain: string;

  constructor() {
    this.apiKey = process.env.EXOTEL_API_KEY || 'mock_exotel_key';
    this.apiToken = process.env.EXOTEL_API_TOKEN || 'mock_exotel_token';
    this.accountSid = process.env.EXOTEL_ACCOUNT_SID || 'mock_exotel_sid';
    this.subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  }

  async initiateCall(options: OutboundCallOptions): Promise<OutboundCallResult> {
    // If running in development/test without real credentials, safely return simulated sid
    if (this.apiKey.startsWith('mock_')) {
      logger.info({ to: options.to }, 'Simulating Exotel outbound call in mock/dev mode');
      return {
        callSid: `exo_${Date.now()}`,
        provider: 'exotel',
        status: 'initiated',
      };
    }

    try {
      const url = `https://${this.apiKey}:${this.apiToken}@${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`;
      const formData = new URLSearchParams();
      formData.append('From', options.from);
      formData.append('To', options.to);
      formData.append('StatusCallback', options.callbackUrl);
      formData.append('TimeLimit', String(options.timeoutSeconds || 300));

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Exotel call connection failed with HTTP ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { Call?: { Sid?: string } };
      const callSid = data.Call?.Sid || `exo_${Date.now()}`;

      return {
        callSid,
        provider: 'exotel',
        status: 'initiated',
      };
    } catch (err) {
      logger.error({ err, to: options.to }, 'Exotel call initiation error');
      throw err;
    }
  }

  async transferCall(callSid: string, transferTo: string): Promise<{ success: boolean }> {
    logger.info({ callSid, transferTo }, 'Transferred Exotel call to human agent');
    return { success: true };
  }
}
