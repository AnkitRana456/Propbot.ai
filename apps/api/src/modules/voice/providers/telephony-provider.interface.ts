export interface OutboundCallOptions {
  companyId: string;
  leadId: string;
  to: string;
  from: string;
  callbackUrl: string;
  timeoutSeconds?: number;
  customParameters?: Record<string, string>;
}

export interface OutboundCallResult {
  callSid: string;
  provider: 'exotel' | 'twilio' | 'mock_telephony';
  status: 'queued' | 'initiated';
  details?: Record<string, unknown>;
}

export interface TelephonyProvider {
  initiateCall(options: OutboundCallOptions): Promise<OutboundCallResult>;
  transferCall?(callSid: string, transferTo: string): Promise<{ success: boolean }>;
  terminateCall?(callSid: string): Promise<{ success: boolean }>;
}
