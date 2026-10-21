import React, { useState } from 'react';
import { BarChart3, LayoutGrid, List } from 'lucide-react';
import type { LeadItemResponse } from '@propbot/shared';
import { PageHeader } from '../components/layout/PageHeader.js';
import { LeadsTable } from '../components/crm/LeadsTable.js';
import { LeadsKanbanBoard } from '../components/crm/LeadsKanbanBoard.js';
import { CrmReportsDrawer } from '../components/crm/CrmReportsDrawer.js';
import { LeadDetailDrawer } from '../components/leads/LeadDetailDrawer.js';
import { Button } from '../components/ui/Button.js';

export const LeadsPage: React.FC = () => {
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [reportsOpen, setReportsOpen] = useState(false);
  const [kanbanLead, setKanbanLead] = useState<LeadItemResponse | null>(null);

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Every enquiry from your chatbot, WhatsApp and forms. Click a cell to select it, then press Enter to edit."
        action={
          <>
            <div role="group" aria-label="View" className="flex rounded-lg border border-border bg-surface p-0.5">
              {([['table', 'Table', List], ['kanban', 'Board', LayoutGrid]] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === id ? 'bg-accent-soft text-accent' : 'text-text-muted hover:text-text'}`}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setReportsOpen(true)} leftIcon={<BarChart3 className="h-4 w-4" />}>
              Reports
            </Button>
          </>
        }
      />

      {view === 'table' ? <LeadsTable /> : <LeadsKanbanBoard onSelectLead={setKanbanLead} />}

      <LeadDetailDrawer lead={kanbanLead} isOpen={Boolean(kanbanLead)} onClose={() => setKanbanLead(null)} />
      <CrmReportsDrawer isOpen={reportsOpen} onClose={() => setReportsOpen(false)} />
    </div>
  );
};

export default LeadsPage;
