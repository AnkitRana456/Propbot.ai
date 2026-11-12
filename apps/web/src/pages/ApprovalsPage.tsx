import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader.js';
import { ToolApproval } from '../components/approvals/ToolApproval.js';

/** Actions the AI holds for a human yes (payment links, discounts, WhatsApp replies, MCP writes), one at a time. */
export const ApprovalsPage: React.FC = () => (
  <div>
    <PageHeader
      title="Approvals"
      description="Anything sensitive the AI wants to do waits here for a yes: payment links, discounts, price quotes, WhatsApp replies and changes from outside agents."
      meta={
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-accent" />
          Tier 2 guardrails
        </span>
      }
    />
    <ToolApproval />
  </div>
);

export default ApprovalsPage;
