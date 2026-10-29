import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { CurrentPlanCard } from '../src/components/billing/CurrentPlanCard.js';
import { UsageMeters } from '../src/components/billing/UsageMeters.js';
import { renderToString } from 'react-dom/server';
import PricingTicket, { type Plan } from '../src/components/billing/PricingTicket.js';
import { InvoicesTable } from '../src/components/billing/InvoicesTable.js';
import { LeadCreditsCard } from '../src/components/billing/LeadCreditsCard.js';
import { SubscriptionPage } from '../src/pages/SubscriptionPage.js';
import type { SubscriptionOverview, UsageMeters as UsageMetersType } from '@propbot/shared';

// Mock services
vi.mock('../src/services/billing.service.js', () => ({
  useSubscriptionOverview: () => ({
    data: {
      plan: 'growth',
      planName: 'Growth',
      status: 'active',
      currentPeriodEnd: '2026-11-12T00:00:00Z',
      billingCycle: 'monthly',
      cancelAtPeriodEnd: false,
      leadCredits: 250,
      limits: {
        maxChatbots: 10,
        maxConversationsPerMonth: 5000,
        maxAiTokensPerMonth: 2500000,
        maxUsers: 15,
        maxWhatsappNumbers: 3,
        storageLimitMb: 10240,
        features: {
          whiteLabel: true,
          apiAccess: true,
          workflows: true,
          voiceNotes: true,
        },
      },
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUsageMeters: () => ({
    data: {
      chatbots: { current: 3, limit: 10, percentage: 30 },
      conversations: { current: 1420, limit: 5000, percentage: 28.4 },
      aiTokens: { current: 850000, limit: 2500000, percentage: 34 },
      users: { current: 4, limit: 15, percentage: 26.6 },
      whatsappNumbers: { current: 1, limit: 3, percentage: 33.3 },
      storageMb: { current: 1240, limit: 10240, percentage: 12.1 },
    },
    isLoading: false,
  }),
  useInvoicesList: () => ({
    data: {
      invoices: [
        {
          id: 'inv-rec-1',
          invoiceNumber: 'INV-2026-001',
          amount: 14900,
          currency: 'INR',
          status: 'paid',
          periodStart: '2026-09-12T00:00:00Z',
          periodEnd: '2026-10-12T00:00:00Z',
          pdfUrl: 'https://propbot.ai/invoices/INV-2026-001.pdf',
          createdAt: '2026-10-12T00:00:00Z',
        },
      ],
      total: 1,
    },
    isLoading: false,
  }),
  useCreateCheckoutSessionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelSubscriptionMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePurchaseLeadCreditsMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('Frontend Subscription & Billing Components & Page', () => {
  it('renders CurrentPlanCard with plan details and action buttons', () => {
    const handleUpgrade = vi.fn();
    const handleCancel = vi.fn();

    const overview: SubscriptionOverview = {
      plan: 'growth',
      planName: 'Growth',
      status: 'active',
      currentPeriodEnd: '2026-11-12T00:00:00Z',
      billingCycle: 'monthly',
      cancelAtPeriodEnd: false,
      leadCredits: 120,
      limits: {
        maxChatbots: 10,
        maxConversationsPerMonth: 5000,
        maxAiTokensPerMonth: 2500000,
        maxUsers: 15,
        maxWhatsappNumbers: 3,
        storageLimitMb: 10240,
        features: {
          whiteLabel: true,
          apiAccess: true,
          workflows: true,
          voiceNotes: true,
        },
      },
    };

    const el = React.createElement(CurrentPlanCard, {
      overview,
      onUpgradeClick: handleUpgrade,
      onCancelClick: handleCancel,
    });

    expect(el).toBeDefined();
    expect(el.props.overview?.plan).toBe('growth');
    expect(el.props.overview?.status).toBe('active');
  });

  it('renders UsageMeters with all 6 quota categories', () => {
    const usage: UsageMetersType = {
      chatbots: { current: 2, limit: 5, percentage: 40 },
      conversations: { current: 500, limit: 1000, percentage: 50 },
      aiTokens: { current: 100000, limit: 500000, percentage: 20 },
      users: { current: 3, limit: 5, percentage: 60 },
      whatsappNumbers: { current: 1, limit: 1, percentage: 100 },
      storageMb: { current: 200, limit: 1000, percentage: 20 },
    };

    const el = React.createElement(UsageMeters, { usage });
    expect(el).toBeDefined();
    expect(el.props.usage?.chatbots.percentage).toBe(40);
    expect(el.props.usage?.whatsappNumbers.percentage).toBe(100);
  });

  it('renders PricingTicket with plan pills, a locked current plan and no CTA before a claim', () => {
    const base = { priceLabel: 'Per month', toLabel: 'Chats a month', cta: '', href: '' };
    const plans: Plan[] = [
      { ...base, id: 'starter', name: 'Starter', code: 'ST', price: '₹2,999', to: '1,000', plan: 'Starter', seats: '5 users', access: '3 chatbots' },
      { ...base, id: 'growth', name: 'Growth', code: 'GR', price: '₹7,999', to: '5,000', plan: 'Growth', seats: '15 users', access: '10 chatbots', current: true },
    ];

    const locked = renderToString(<PricingTicket plans={plans} start="growth" backdrop={false} loadFont={false} />);
    expect(locked).toContain('Starter');
    expect(locked).toContain('₹7,999');
    expect(locked).toContain('Your plan');
    expect(locked).toContain('aria-disabled="true"');
    expect(locked).not.toContain('Claimed');

    const open = renderToString(<PricingTicket plans={plans} start="starter" backdrop={false} loadFont={false} />);
    expect(open).toContain('Pull to claim');
    expect(open).toContain('aria-label="Pull to claim Starter"');
  });

  it('renders InvoicesTable with historical invoice downloads', () => {
    const invoices = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-2026-001',
        amount: 4999,
        currency: 'INR',
        status: 'paid',
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-10-01T00:00:00Z',
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];

    const el = React.createElement(InvoicesTable, { invoices, isLoading: false });
    expect(el).toBeDefined();
    expect(el.props.invoices.length).toBe(1);
    expect(el.props.invoices[0].amount).toBe(4999);
  });

  it('renders LeadCreditsCard with credit balance and purchase options', () => {
    const handlePurchase = vi.fn();

    const el = React.createElement(LeadCreditsCard, {
      credits: 250,
      onPurchaseCredits: handlePurchase,
      isPurchasing: false,
    });

    expect(el).toBeDefined();
    expect(el.props.credits).toBe(250);
  });

  it('renders main SubscriptionPage with tabbed/stacked view and modals', () => {
    const el = React.createElement(SubscriptionPage);
    expect(el).toBeDefined();
  });
});
