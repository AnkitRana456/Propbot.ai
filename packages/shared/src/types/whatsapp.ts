import type { BuyerDna } from './leads.js';

export interface WhatsAppInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'image' | 'document' | 'audio' | 'location';
  text?: { body: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  image?: { id: string; mime_type?: string; sha256?: string };
  document?: { id: string; filename?: string; mime_type?: string };
  audio?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
}

export interface WhatsAppStatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface WhatsAppWebhookChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppStatusUpdate[];
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: WhatsAppWebhookChangeValue;
      field: string;
    }>;
  }>;
}

export interface WhatsAppConversationItem {
  id: string;
  companyId: string;
  chatbotId: string;
  chatbotName?: string;
  contactId: string | null;
  leadId: string | null;
  channel: string;
  status: 'bot' | 'agent' | 'needs_human' | 'closed';
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  visitorPhone: string;
  visitorName: string;
  lastMessageSnippet: string;
  lastMessageAt: string;
  unreadCount: number;
  aiPaused: boolean;
  serviceWindowExpired: boolean;
  serviceWindowRemainingHours: number;
  sentiment: string | null;
  intentScore: number;
  intentLabel: string;
  buyerDna: BuyerDna;
}

export interface WhatsAppMessageItem {
  id: string;
  conversationId: string;
  senderType: 'visitor' | 'bot' | 'agent' | 'system';
  senderName?: string;
  content: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  tokensUsed?: number;
  latencyMs?: number;
  isGuardedHold?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WhatsAppConversationDetail extends WhatsAppConversationItem {
  messages: WhatsAppMessageItem[];
}
