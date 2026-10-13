export interface VoiceSessionOptions {
  companyId: string;
  leadId: string;
  contactName?: string;
  projectName?: string;
  systemPrompt?: string;
  greetingText?: string;
  voiceId?: string;
}

export interface VoiceSessionResult {
  sessionId: string;
  agentName: string;
  discloseAiText: string;
  sessionUrl?: string;
  websocketUrl?: string;
}

export interface VoiceProvider {
  createSession(options: VoiceSessionOptions): Promise<VoiceSessionResult>;
  endSession?(sessionId: string): Promise<void>;
}
