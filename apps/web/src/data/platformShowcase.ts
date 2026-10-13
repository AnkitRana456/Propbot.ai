export interface ShowcaseClient {
  id: string;
  name: string;
  category: 'Developers' | 'Brokerages' | 'Residential' | 'Commercial' | 'Property Consultants';
  tagline: string;
  description: string;
  logoText: string;
  website: string;
  featured: boolean;
  status: 'active' | 'demo';
}

export interface TransformationMetric {
  value: string;
  label: string;
  context: string;
}

export interface ShowcaseFeature {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  bulletPoints: string[];
  visualType: 'chat' | 'dna' | 'shortlist' | 'crm' | 'whatsapp' | 'rag' | 'handoff';
  status: 'available' | 'planned';
}

export interface HowItWorksStep {
  step: string;
  title: string;
  subtitle: string;
  description: string;
  metric: string;
}

export interface AudienceCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  exampleWorkflow: string;
  features: string[];
}

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export interface PlaceholderTestimonial {
  id: string;
  title: string;
  message: string;
  statusText: string;
  readyToPublish: boolean;
}

// =========================================================================
// 1. Fictional Showcase Clients & Developers (Replaceable Data Structure)
// =========================================================================
export const SHOWCASE_CLIENTS: ShowcaseClient[] = [
  {
    id: 'client-1',
    name: 'Skyline Habitat',
    category: 'Developers',
    tagline: 'Modern Integrated Townships',
    description: 'Leading residential township builder across Bangalore & Hyderabad with 12+ RERA-registered developments.',
    logoText: 'SKYLINE HABITAT',
    website: 'https://example.com/skyline-habitat',
    featured: true,
    status: 'demo',
  },
  {
    id: 'client-2',
    name: 'UrbanNest Developers',
    category: 'Developers',
    tagline: 'Sustainable Luxury Residences',
    description: 'Specialists in IGBC Gold certified luxury high-rises and private villa communities.',
    logoText: 'URBANNEST',
    website: 'https://example.com/urbannest',
    featured: true,
    status: 'demo',
  },
  {
    id: 'client-3',
    name: 'Greenstone Realty',
    category: 'Brokerages',
    tagline: 'Premier Channel Partner Network',
    description: 'Top-tier brokerage network managing exclusive builder inventory and NRI real-estate portfolio investments.',
    logoText: 'GREENSTONE',
    website: 'https://example.com/greenstone',
    featured: true,
    status: 'demo',
  },
  {
    id: 'client-4',
    name: 'PrimeSquare Properties',
    category: 'Residential',
    tagline: 'Curated Urban Condominiums',
    description: 'Boutique residential developers focused on tech-corridor luxury living and high rental yields.',
    logoText: 'PRIMESQUARE',
    website: 'https://example.com/primesquare',
    featured: true,
    status: 'demo',
  },
  {
    id: 'client-5',
    name: 'Horizon Estates',
    category: 'Property Consultants',
    tagline: 'Strategic Real-Estate Advisory',
    description: 'Advisory firm assisting first-time and luxury homebuyers through unbiased algorithmic property recommendations.',
    logoText: 'HORIZON ESTATES',
    website: 'https://example.com/horizon',
    featured: false,
    status: 'demo',
  },
  {
    id: 'client-6',
    name: 'BluePeak Homes',
    category: 'Developers',
    tagline: 'Affordable & Upper-Mid Housing',
    description: 'Fast-growing infrastructure developer deploying smart homes in high-growth suburban corridors.',
    logoText: 'BLUEPEAK',
    website: 'https://example.com/bluepeak',
    featured: false,
    status: 'demo',
  },
  {
    id: 'client-7',
    name: 'Oakline Developers',
    category: 'Commercial',
    tagline: 'Grade-A Commercial & Retail',
    description: 'Premium tech park and boutique co-working commercial real-estate developers.',
    logoText: 'OAKLINE',
    website: 'https://example.com/oakline',
    featured: false,
    status: 'demo',
  },
  {
    id: 'client-8',
    name: 'Elevate Spaces',
    category: 'Property Consultants',
    tagline: 'Next-Gen Proptech Brokerage',
    description: 'Technology-first brokerage team converting digital footfall into qualified physical project walk-throughs.',
    logoText: 'ELEVATE SPACES',
    website: 'https://example.com/elevate',
    featured: false,
    status: 'demo',
  },
];

// =========================================================================
// 2. Transformation Statistics (Realistic Operational Target Metrics)
// =========================================================================
export const TRANSFORMATION_METRICS: TransformationMetric[] = [
  {
    value: '+35%',
    label: 'Site Visit Conversion',
    context: 'Direct increase in verified property walk-throughs booked via conversational WhatsApp qualification.',
  },
  {
    value: '< 90s',
    label: 'Lead Engagement SLA',
    context: 'Instant AI response and Buyer DNA profile construction 24/7 across website and messaging channels.',
  },
  {
    value: '80%',
    label: 'Autonomous Qualification',
    context: 'Budget, BHK preference, possession timeline, and intent score calculated without manual calling.',
  },
  {
    value: '100%',
    label: 'RERA Grounded Answers',
    context: 'Zero price hallucinations; every response cites authorized project brochures and builder disclosures.',
  },
];

// =========================================================================
// 3. Platform Capabilities & Feature Showcase
// =========================================================================
export const SHOWCASE_FEATURES: ShowcaseFeature[] = [
  {
    id: 'feature-chatbot',
    badge: 'CONVERSATIONAL AI',
    title: 'Real-Estate AI Concierge Grounded in Verified Inventory',
    subtitle: 'Answer property questions 24/7 without hallucinating prices or inventory status.',
    description:
      'Unlike generic chat widgets, PropBot Pro ingests your official RERA brochures, pricing sheets, and masterplans. The AI engages home-seekers in natural bilingual dialogue, answers floorplan inquiries, explains payment plans, and guides high-intent buyers toward booking a physical tour.',
    bulletPoints: [
      'Grounded RAG retrieves exact carpet area, amenities, and possession timelines.',
      'Understands colloquial Indian English and Hindi terms (e.g., "lake facing 3BHK", "possession kab milega").',
      'Configurable brand voice, primary colors, and automated visitor qualification triggers.',
    ],
    visualType: 'chat',
    status: 'available',
  },
  {
    id: 'feature-buyer-dna',
    badge: 'LIVE INTENT & BUYER DNA',
    title: 'Transform Anonymous Clicks Into Actionable Buyer DNA',
    subtitle: 'Every conversation produces a structured profile and 0–100 Live Intent score.',
    description:
      'Stop making agents dial cold web forms. PropBot Pro continuously evaluates budget ranges, preferred localities, BHK configurations, purchasing timelines, and loan requirements directly from the buyer’s dialogue.',
    bulletPoints: [
      'Real-time Intent Scoring (0–100) calibrated on budget match, verified phone, and visit interest.',
      'Live Buyer DNA cards detailing budget brackets, timeline urgency, and investment purpose.',
      'Instant Hot-Lead Brief delivered directly to assigned senior sales agents.',
    ],
    visualType: 'dna',
    status: 'available',
  },
  {
    id: 'feature-shortlist-room',
    badge: 'DIGITAL CLIENT EXPERIENCE',
    title: 'Interactive Shortlist Rooms for High-Intent Buyers',
    subtitle: 'A private, branded digital room replacing static PDF email attachments.',
    description:
      'Empower buyers with an interactive Shortlist Room generated instantly based on their unique preferences. Visitors explore matched units, compare floor areas, view pricing breakdowns, and vote on favorites with family members.',
    bulletPoints: [
      'Tokenized private link delivered via SMS or WhatsApp with zero password friction.',
      'Tracks visitor dwell time, brochure downloads, and unit re-visits in real time.',
      'Alerts agents the moment an inactive prospect re-opens their shortlisted units.',
    ],
    visualType: 'shortlist',
    status: 'available',
  },
  {
    id: 'feature-crm',
    badge: 'REAL ESTATE CRM',
    title: 'Built-in Real-Estate Pipeline with Intelligent Routing',
    subtitle: 'Streamlined Kanban stages designed specifically for developer sales cycles.',
    description:
      'From First Inquiry to Site Visit, Negotiation, and Token Booking, track every deal in a unified multi-tenant CRM. Leads are automatically assigned based on agent capacity, project specialization, and language requirements.',
    bulletPoints: [
      '8 dedicated stages: New, Contacted, Qualified, Site Visit Scheduled, Done, Negotiation, Converted, Lost.',
      'Complete visitor activity timeline merging web chat, WhatsApp messages, and phone calls.',
      'Strict multi-tenant Row-Level Security ensuring zero data leakage across brokerages.',
    ],
    visualType: 'crm',
    status: 'available',
  },
  {
    id: 'feature-whatsapp',
    badge: 'OMNICHANNEL ENGAGEMENT',
    title: 'WhatsApp Business Cloud Integration & Automated Follow-Ups',
    subtitle: 'Connect buyers on the channel where 90% of real-estate decisions happen in India.',
    description:
      'Deploy an official WhatsApp AI bot with Meta Cloud API integration. Send verified gate passes for site visits, deliver RERA-compliant project brochures, and automate re-engagement campaigns within approved 24-hour customer windows.',
    bulletPoints: [
      'Automated site-visit location pin, QR pass, and reminder dispatches.',
      'RERA-compliant campaign builder with opt-out mechanisms and frequency caps.',
      'Instant agent takeover: human agents seamlessly jump into conversations from the dashboard.',
    ],
    visualType: 'whatsapp',
    status: 'available',
  },
  {
    id: 'feature-safety',
    badge: 'AI GOVERNANCE & SAFETY',
    title: 'Guarded AI Action Engine with Tiered Human Approval',
    subtitle: 'Enterprise-grade safeguards ensuring AI never over-promises discounts or terms.',
    description:
      'PropBot Pro enforces a strict three-tier action governance model (T0, T1, T2). While informational answers and brochure dispatches occur autonomously, any commercial commitments such as price discounts, token waivers, or legal promises require human manager sign-off.',
    bulletPoints: [
      'Tier 2 approval queue: manager review required for token discounts and payment waivers.',
      'Instant global AI Kill-Switch allows company admins to pause autonomous actions in one click.',
      'Full cryptographic audit logging tracking every proposed, approved, and executed action.',
    ],
    visualType: 'handoff',
    status: 'available',
  },
];

// =========================================================================
// 4. How It Works (4-Step Visual Journey)
// =========================================================================
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: '01',
    title: 'Connect & Ingest',
    subtitle: 'Upload Project Knowledge & Inventory',
    description: 'Add your RERA brochure, unit price sheets, masterplans, and FAQs. PropBot Pro indexes the inventory into a verified semantic knowledge base.',
    metric: 'Under 10 mins setup',
  },
  {
    step: '02',
    title: 'Engage 24/7',
    subtitle: 'Conversational Web & WhatsApp Concierge',
    description: 'Deploy the AI chatbot to your property landing pages, portals, and WhatsApp numbers to greet every prospective buyer instantly.',
    metric: 'Zero wait time',
  },
  {
    step: '03',
    title: 'Qualify & Score',
    subtitle: 'Live Buyer DNA & Intent Assessment',
    description: 'The AI extracts budget, BHK preference, location, and purchase timeline, calculating a calibrated 0–100 Live Intent score.',
    metric: '80% autonomous',
  },
  {
    step: '04',
    title: 'Convert & Tour',
    subtitle: 'Site-Visit Booking & Agent Handoff',
    description: 'The buyer is guided to schedule a physical tour. The lead is assigned to a sales advisor complete with a synthesized handoff brief.',
    metric: '3X faster closing',
  },
];

// =========================================================================
// 5. Who It's For (Audience Matrix)
// =========================================================================
export const AUDIENCE_CARDS: AudienceCard[] = [
  {
    id: 'aud-developers',
    title: 'Real Estate Developers & Builders',
    subtitle: 'For high-volume pre-launch & ready inventory',
    description: 'Capture 24/7 demand across project microsites, qualify inquiries without ballooning call centers, and deliver booked site visits to your sales gallery.',
    exampleWorkflow: 'Pre-launch WhatsApp campaign -> AI qualification -> Guarded token booking link.',
    features: ['Multi-project inventory management', 'RERA compliance disclaimers', 'T2 discount approval queues'],
  },
  {
    id: 'aud-brokerages',
    title: 'Brokerages & Channel Partners',
    subtitle: 'For sales teams managing multi-developer portfolios',
    description: 'Arm your team with an AI co-pilot that matches buyer requirements to inventory across different builders and routes qualified buyers to senior agents.',
    exampleWorkflow: 'Portal inquiry -> Buyer DNA extraction -> Interactive Shortlist Room delivery.',
    features: ['Smart Shortlist Rooms', 'Agent assignment routing', 'Lead duplicate prevention'],
  },
  {
    id: 'aud-consultants',
    title: 'Luxury Property Consultants',
    subtitle: 'For bespoke advisory & HNI clientele',
    description: 'Deliver white-glove digital touchpoints with tailored villa shortlists, scheduled concierge calls, and privacy-first multi-tenant security.',
    exampleWorkflow: 'Web inquiry -> Voice AI callback -> VIP weekend villa tour scheduling.',
    features: ['High-value buyer DNA tags', 'Private tokenized portals', 'Telephony call logging'],
  },
  {
    id: 'aud-commercial',
    title: 'Commercial & Retail Real Estate',
    subtitle: 'For office spaces, tech parks & retail leasing',
    description: 'Qualify corporate tenants on square footage requirements, lease terms, and fit-out specifications with grounded document retrieval.',
    exampleWorkflow: 'Floorplan inquiry -> Tenant DNA capture -> Commercial leasing manager alert.',
    features: ['Carpet vs super area clarity', 'Gated RFP brochure tracking', 'Custom field filters'],
  },
];

// =========================================================================
// 6. Interactive Demo Mock Data (Tabbed Preview)
// =========================================================================
export const DEMO_PREVIEW_DATA = {
  chat: {
    buyerName: 'Amit Patel',
    buyerPhone: '+91 98200 •••••',
    project: 'Prestige Lakeside Habitat',
    messages: [
      { sender: 'bot', text: 'Namaste! Welcome to Prestige Lakeside Habitat. Are you looking for a residence for personal stay or investment?' },
      { sender: 'user', text: 'Looking for a 3BHK flat in Whitefield. What are the starting prices and RERA carpet areas for Tower B?' },
      { sender: 'bot', text: 'In Tower B, 3BHK units feature 1,850 sq.ft. carpet area starting at ₹2.10 Cr all-inclusive. All units overlook Varthur Lake with RERA registration PRM/KA/RERA/1251/446/PR/171015/000452. Would you like to reserve a VIP site visit this Saturday at 11:00 AM?' },
      { sender: 'user', text: 'Yes, Saturday 11 AM works! Please confirm.' },
      { sender: 'bot', text: 'Confirmed! Senior Advisor Rahul Sharma will receive you at the Experience Center clubhouse on Saturday at 11:00 AM.' },
    ],
  },
  dna: {
    buyerName: 'Amit Patel',
    intentScore: 94,
    intentLabel: 'HOT LEAD',
    verifiedPhone: true,
    budgetRange: '₹2.10 Cr – ₹2.65 Cr',
    bhk: '3BHK / 3BHK Luxury',
    preferredLocality: 'Whitefield, Bangalore',
    timeline: 'Immediate (Within 30 Days)',
    purpose: 'Personal Residence (Lake Facing)',
    scoreBreakdown: [
      { reason: 'Budget matches Tower B-802', delta: '+25' },
      { reason: 'Verified phone & WhatsApp authorization', delta: '+20' },
      { reason: 'Confirmed physical site visit for Saturday', delta: '+35' },
      { reason: 'Ready-to-move requirement without loan contingency', delta: '+14' },
    ],
  },
  shortlist: {
    roomTitle: 'Curated 3BHK Shortlist for Amit Patel',
    views: 7,
    dwellTime: '8 mins 40 secs',
    units: [
      {
        unit: 'Tower B - 802',
        bhk: '3BHK Lake Facing',
        carpet: '1,850 Sq.Ft.',
        price: '₹2.10 Cr',
        match: '98% Match',
        status: 'Available',
      },
      {
        unit: 'Tower B - 1401',
        bhk: '3BHK Luxury Penthouse',
        carpet: '2,150 Sq.Ft.',
        price: '₹2.65 Cr',
        match: '92% Match',
        status: 'Available',
      },
      {
        unit: 'Villa Palm - 12',
        bhk: '4BHK Private Villa',
        carpet: '4,200 Sq.Ft.',
        price: '₹5.80 Cr',
        match: '85% Match',
        status: 'Available',
      },
    ],
  },
  crm: {
    stages: [
      { name: 'New Inquiries', count: 12, highlight: 'Aarav Sharma (₹1.5Cr)' },
      { name: 'Contacted & AI Bot', count: 10, highlight: 'Deepa Sundaram (2BHK)' },
      { name: 'Qualified (Buyer DNA)', count: 14, highlight: 'Siddharth Rao (92% Intent)' },
      { name: 'Site Visit Booked', count: 8, highlight: 'Amit Patel (Sat 11 AM)' },
      { name: 'Negotiation / Token', count: 6, highlight: 'Rajesh Nambiar (Tower B-802)' },
      { name: 'Converted / Booked', count: 5, highlight: 'Pooja Hegde (Token Received)' },
    ],
  },
};

// =========================================================================
// 7. Neutral Case Study & Testimonial Placeholders (Strictly Compliant)
// =========================================================================
export const PLACEHOLDER_TESTIMONIALS: PlaceholderTestimonial[] = [
  {
    id: 'placeholder-1',
    title: 'Verified Developer Case Study',
    message: 'Customer story and verified conversion metrics coming soon. Real estate teams can add their benchmark results here.',
    statusText: 'Placeholder — Replace with your client story',
    readyToPublish: false,
  },
  {
    id: 'placeholder-2',
    title: 'Channel Partner Success Spotlight',
    message: 'Add your first verified case study highlighting lead velocity and WhatsApp site-visit booking outcomes.',
    statusText: 'Placeholder — Replace with approved partner quote',
    readyToPublish: false,
  },
  {
    id: 'placeholder-3',
    title: 'Independent Review Spotlight',
    message: 'Replace this sample card with customer feedback from your active property developers or brokerage admins.',
    statusText: 'Placeholder — Verified testimonial slot',
    readyToPublish: false,
  },
];

// =========================================================================
// 8. Frequently Asked Questions
// =========================================================================
export const SHOWCASE_FAQS: FaqItem[] = [
  {
    category: 'Accuracy & RERA',
    question: 'How does PropBot Pro prevent the AI from hallucinating real estate prices or false availability?',
    answer: 'PropBot Pro uses a strict Retrieval-Augmented Generation (RAG) architecture over your authorized documents. The AI is structurally constrained to only quote prices, payment plans, and floor specs found in your uploaded builder inventory. If a query falls outside verified knowledge, it politely offers an advisor callback instead of guessing.',
  },
  {
    category: 'WhatsApp',
    question: 'Can PropBot Pro connect directly with our official WhatsApp Business Cloud number?',
    answer: 'Yes. PropBot Pro integrates with the Meta WhatsApp Cloud API. Conversations flow seamlessly into your CRM, and verified WhatsApp templates are used for site visit reminders, gate passes, and RERA-compliant brochures within Meta guidelines.',
  },
  {
    category: 'Security & Multi-Tenancy',
    question: 'How is data protected across different builder projects or brokerage tenants?',
    answer: 'Every database record is isolated using PostgreSQL Row-Level Security (RLS) enforced via tenant-guard tokens. It is architecturally impossible for one company or builder to access another tenant’s leads, inventory, or conversation transcripts.',
  },
  {
    category: 'Human Governance',
    question: 'Can the AI make financial commitments or offer discounts on property bookings?',
    answer: 'Never autonomously. PropBot Pro features a Tiered Action Governance engine (T0, T1, T2). Sensitive actions—such as offering a builder discount, waiving club fees, or generating payment links—are placed into a human approval queue requiring sales manager authorization.',
  },
  {
    category: 'Implementation',
    question: 'How quickly can our real estate team go live?',
    answer: 'Typically in less than one business day. Simply upload your project brochures or connect your inventory spreadsheet, configure your brand colors, and embed the chat widget or connect your WhatsApp webhook.',
  },
];
