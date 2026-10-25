import {
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  Calendar,
  CreditCard,
  Flame,
  GitMerge,
  Hand,
  Inbox,
  Lightbulb,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  Plug,
  ShieldCheck,
  Sparkles,
  Timer,
  UserSearch,
  Users,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Everything the public site says about the product lives here, so the menus, sections and footer never disagree. */

export interface Product {
  id: string;
  name: string;
  /** One line for menus. */
  short: string;
  tagline: string;
  icon: LucideIcon;
  beta?: boolean;
  bullets: string[];
  image: { name: string; kind: 'browser' | 'phone'; alt: string };
}

export const PRODUCTS: Product[] = [
  {
    id: 'chatbot',
    name: 'AI Chatbot',
    short: 'Answers buyers on your site in seconds',
    tagline: 'A website assistant that answers like your best agent',
    icon: MessageCircle,
    bullets: [
      'Answers from your own documents, and says so when it does not know',
      'Brand colours, greeting and quick actions with a live preview',
      'Captures budget, BHK, locality and timeline in a natural chat',
      'Hands the chat to your team at any moment',
      'Replies in English and Hindi',
      'Proactive nudges on pricing and project pages',
    ],
    image: { name: 'chat', kind: 'phone', alt: 'A phone showing the chatbot booking a site visit' },
  },
  {
    id: 'crm',
    name: 'Leads CRM',
    short: 'Every enquiry scored and ready to call',
    tagline: 'Every enquiry, scored and ready for a call',
    icon: Users,
    bullets: [
      'Spreadsheet-style table with inline editing and keyboard shortcuts',
      'Board view from New to Booked',
      'Hot, warm and cold scoring with the reasons shown',
      'Buyer profile: budget, BHK, locality and timeline',
      'Duplicate detection and one-click merge',
      'Round-robin assignment, SLA alerts, CSV export and a full timeline',
    ],
    image: { name: 'kanban', kind: 'browser', alt: 'Pipeline board of buyers from New to Booked' },
  },
  {
    id: 'inbox',
    name: 'Shared Inbox',
    short: 'WhatsApp, Instagram and web chat in one place',
    tagline: 'Every channel in one inbox',
    icon: Inbox,
    bullets: [
      'Web chat, WhatsApp, Instagram and Messenger side by side',
      'Take over any chat, then hand it back to the AI',
      'Internal notes on every conversation',
      'WhatsApp message templates for follow-ups after 24 hours',
      'Lead sources for ads, portals, forms and CSV files',
      'Connection status for every channel',
    ],
    image: { name: 'inbox', kind: 'browser', alt: 'Shared inbox with a WhatsApp conversation' },
  },
  {
    id: 'voice',
    name: 'Voice Agents',
    short: 'AI phone agents that qualify leads',
    tagline: 'AI phone agents that qualify leads by voice',
    icon: PhoneCall,
    beta: true,
    bullets: [
      'Choose the voice, language and script',
      'Every call starts by saying it is an AI',
      'Calling windows, consent and do-not-disturb checks built in',
      'Try a call in your browser before you go live',
      'Transcripts, outcomes and call analytics',
      'Hands over to a person when the buyer asks',
    ],
    image: { name: 'voice', kind: 'browser', alt: 'A voice call transcript with consent checks and an outcome' },
  },
  {
    id: 'visits',
    name: 'Site Visits',
    short: 'Bookings that land on your calendar',
    tagline: 'Bookings that land on your calendar',
    icon: CalendarCheck,
    bullets: [
      'Real slots offered inside the chat',
      'Google Calendar sync',
      'Reminders for buyers and your team',
      'Reschedule, cancel and no-show tracking',
      'A short feedback survey after each visit',
      'A week calendar of every visit',
    ],
    image: { name: 'visits', kind: 'browser', alt: 'Week calendar of booked site visits' },
  },
  {
    id: 'analytics',
    name: 'Analytics',
    short: 'See what turns enquiries into bookings',
    tagline: 'See what turns enquiries into bookings',
    icon: BarChart3,
    bullets: [
      'Lead funnel from captured lead to booked unit',
      'Lead quality by source and campaign',
      'Demand by BHK, locality and budget',
      '30-day forecast and attribution models',
      'AI cost and quality panel',
      'CSV export of your numbers',
    ],
    image: { name: 'analytics', kind: 'browser', alt: 'Analytics with a funnel, weekly leads and sources' },
  },
  {
    id: 'flows',
    name: 'Flows and Automation',
    short: 'Follow-ups that run themselves',
    tagline: 'Follow-ups that run themselves',
    icon: Workflow,
    bullets: [
      'A visual flow builder with triggers, conditions and actions',
      'Nudges for quiet leads and reminders for no-shows',
      'Campaigns to segments of your leads',
      'Approvals before the AI promises anything sensitive',
      'Tools and webhooks to connect other systems',
      'A run history for every automation',
    ],
    image: { name: 'flows', kind: 'browser', alt: 'A flow with a trigger, a condition and actions' },
  },
  {
    id: 'payments',
    name: 'Payments and Billing',
    short: 'Booking tokens and GST invoices',
    tagline: 'Booking tokens and invoices without the paperwork',
    icon: CreditCard,
    bullets: [
      'Payment links for booking tokens',
      'Full or partial refunds with an audit trail',
      'GST invoices with the CGST, SGST and IGST split',
      'Prepaid credits for AI usage',
      'Plan billing through Stripe',
    ],
    image: { name: 'payments', kind: 'browser', alt: 'Payment links, AI credits and a GST invoice' },
  },
  {
    id: 'security',
    name: 'Teams and Security',
    short: 'Roles, audit trail and data controls',
    tagline: 'Control who sees what',
    icon: ShieldCheck,
    bullets: [
      'Roles for admins, managers, agents and viewers',
      'Teams and assignment rules',
      'An access log and audit trail',
      'Data export and deletion requests',
      'Channel tokens and API secrets stored encrypted',
      'A separate, isolated workspace for every agency',
    ],
    image: { name: 'security', kind: 'browser', alt: 'Team roles and an access log' },
  },
];

export interface Feature {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
  /** The product this feature belongs to. */
  product: string;
}

export const FEATURES: Feature[] = [
  { id: 'scoring', title: 'Lead scoring', body: 'Hot, warm or cold, with the reasons shown so your team trusts it.', icon: Flame, product: 'crm' },
  { id: 'profile', title: 'Buyer profile', body: 'Budget, BHK, locality and timeline, captured in the chat.', icon: UserSearch, product: 'crm' },
  { id: 'nextstep', title: 'Next best action', body: 'A suggested next step on every lead, such as call now or share a brochure.', icon: Lightbulb, product: 'crm' },
  { id: 'duplicates', title: 'Duplicate merge', body: 'The same buyer on WhatsApp and your website becomes one lead.', icon: GitMerge, product: 'crm' },
  { id: 'sla', title: 'SLA alerts and routing', body: 'Round-robin assignment and alerts when a follow-up runs late.', icon: Timer, product: 'crm' },
  { id: 'takeover', title: 'Human takeover', body: 'Step into any chat, then hand it back to the AI.', icon: Hand, product: 'inbox' },
  { id: 'grounded', title: 'Answers from your documents', body: 'Replies come from your brochures and price lists, not from guesses.', icon: BookOpenCheck, product: 'chatbot' },
  { id: 'booking', title: 'Visit booking and reminders', body: 'Slots offered in the chat, synced to your calendar, with reminders.', icon: CalendarClock, product: 'visits' },
  { id: 'templates', title: 'WhatsApp templates', body: 'Approved messages for follow-ups after the 24-hour window.', icon: MessageSquareText, product: 'inbox' },
  { id: 'sources', title: 'Lead sources', body: 'Bring in leads from ads, portals, forms and CSV files.', icon: Plug, product: 'inbox' },
  { id: 'approvals', title: 'Approval guardrails', body: 'Sensitive AI actions wait for a person to approve them.', icon: BadgeCheck, product: 'flows' },
  { id: 'api', title: 'Webhooks and API', body: 'Send leads and events to the other systems you use.', icon: Webhook, product: 'flows' },
];

export interface UseCase {
  id: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

export const USE_CASES: UseCase[] = [
  { id: 'answer', title: 'Answer instantly', body: 'Price, floor plans, possession dates and locality questions, answered from your own project data.', icon: MessageCircle },
  { id: 'qualify', title: 'Qualify buyers', body: 'Budget, BHK, timeline and loan status captured in a natural chat, then scored hot, warm or cold.', icon: Users },
  { id: 'book', title: 'Book site visits', body: 'Offers real slots from your calendar and confirms with a WhatsApp reminder.', icon: Calendar },
  { id: 'handoff', title: 'Hand off warm leads', body: 'Your agent gets the full chat, the buyer profile and a suggested next step.', icon: PhoneCall },
  { id: 'followup', title: 'Follow up automatically', body: 'Nudges quiet leads, reminds no-shows and re-engages old enquiries without extra work.', icon: Zap },
  { id: 'learn', title: 'Learn what sells', body: 'See which projects, sources and questions turn into bookings.', icon: Sparkles },
];

export const AUDIENCES = [
  { id: 'developers', title: 'Developers', body: 'Launch campaigns without a call-centre.' },
  { id: 'brokerages', title: 'Brokerages', body: 'Give every agent the same fast first reply.' },
  { id: 'partners', title: 'Channel partners', body: 'Capture and route enquiries across projects.' },
  { id: 'resale', title: 'Rental and resale', body: 'Match tenants and buyers to the right listing.' },
] as const;

/** Every in-page address the menus point to. */
export const SECTION_IDS = ['top', 'tour', 'showcase', 'explore', 'use-cases', 'features', 'built-for', 'how', 'pricing', 'faq', 'demo'] as const;

export const productHref = (id: string) => `#explore-${id}`;
export const featureHref = (id: string) => `#feat-${id}`;
export const useCaseHref = (id: string) => `#use-${id}`;
