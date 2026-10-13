export interface PlanLimits {
  chatbots: number;
  conversationsPerMonth: number;
  aiTokensPerMonth: number;
  users: number;
  whatsappNumbers: number;
  storageMb: number;
  features: {
    whiteLabel: boolean;
    apiAccess: boolean;
    workflows: boolean;
    voice: boolean;
  };
}

export interface SubscriptionPlanDefinition {
  id: 'trial' | 'starter' | 'growth' | 'enterprise';
  name: string;
  tagline: string;
  priceInrMonthly: number;
  priceInrAnnually: number;
  limits: PlanLimits;
  highlight?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanDefinition> = {
  trial: {
    id: 'trial',
    name: 'Free Trial',
    tagline: 'Experience AI-powered conversion for real estate',
    priceInrMonthly: 0,
    priceInrAnnually: 0,
    limits: {
      chatbots: 1,
      conversationsPerMonth: 100,
      aiTokensPerMonth: 250_000,
      users: 2,
      whatsappNumbers: 0,
      storageMb: 100,
      features: {
        whiteLabel: false,
        apiAccess: false,
        workflows: false,
        voice: false,
      },
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'Ideal for independent brokers and single-project developers',
    priceInrMonthly: 2999,
    priceInrAnnually: 29990,
    limits: {
      chatbots: 3,
      conversationsPerMonth: 1000,
      aiTokensPerMonth: 2_500_000,
      users: 5,
      whatsappNumbers: 1,
      storageMb: 1000,
      features: {
        whiteLabel: false,
        apiAccess: true,
        workflows: false,
        voice: false,
      },
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Scale multiple projects with white-label and WhatsApp automation',
    priceInrMonthly: 7999,
    priceInrAnnually: 79990,
    highlight: true,
    limits: {
      chatbots: 10,
      conversationsPerMonth: 5000,
      aiTokensPerMonth: 10_000_000,
      users: 15,
      whatsappNumbers: 2,
      storageMb: 10_000,
      features: {
        whiteLabel: true,
        apiAccess: true,
        workflows: true,
        voice: false,
      },
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Unlimited capacity for premier developers and agency resellers',
    priceInrMonthly: 19999,
    priceInrAnnually: 199990,
    limits: {
      chatbots: 999,
      conversationsPerMonth: 50_000,
      aiTokensPerMonth: 100_000_000,
      users: 999,
      whatsappNumbers: 10,
      storageMb: 100_000,
      features: {
        whiteLabel: true,
        apiAccess: true,
        workflows: true,
        voice: true,
      },
    },
  },
};
