import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Upload } from 'lucide-react';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { useLeads, useUpdateLead, useUpdateLeadStatus } from '../../services/leads.service.js';
import { useBulkUpdateStatus } from '../../services/crm.service.js';
import DataTable, { type DTColumn, type DTRow } from '../ui/DataTable.js';
import { statusInfo } from '../ui/StatusBadge.js';
import { Button } from '../ui/Button.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { LeadDetailDrawer } from '../leads/LeadDetailDrawer.js';
import { AssignAgentModal } from './AssignAgentModal.js';
import { LostReasonModal } from './LostReasonModal.js';
import { AddLeadModal } from './AddLeadModal.js';
import { ImportLeadsModal } from './ImportLeadsModal.js';
import { formatDateTime } from '../../lib/format.js';

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'site_visit_scheduled', label: 'Site visit' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booked', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
];

const STATUS_COLORS: Record<string, string> = {
  New: '#3d7be0',
  Contacted: '#8a4fd1',
  Qualified: '#1e9e8a',
  'Site visit': '#e0892b',
  Visited: '#b0782b',
  Negotiation: '#d6457a',
  Booked: '#22a861',
  Won: '#22a861',
  Lost: '#a3a29c',
};

const sourceLabel = (source: string): string => {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (s === 'messenger' || s.includes('messenger')) return 'Messenger';
  if (s === 'instagram' || s.includes('instagram')) return 'Instagram';
  if (s.includes('form')) return 'Form';
  if (s.includes('chat') || s.includes('widget') || s.includes('web')) return 'Web chatbot';
  return source ? source.replace(/[_-]/g, ' ') : 'Direct';
};

interface LeadsTableProps {
  /** Pre-filter the list, e.g. the Clients view shows booked and converted leads only. */
  statuses?: LeadStatus[];
  /** Noun for headings and empty states. */
  noun?: { singular: string; plural: string };
  allowAdd?: boolean;
}

/** The shared leads / clients table: search, filters, sort, inline edit, bulk status and assign, CSV export, detail drawer. */
export const LeadsTable: React.FC<LeadsTableProps> = ({ statuses, noun = { singular: 'lead', plural: 'leads' }, allowAdd = true }) => {
  const { theme } = useTheme();
  const [open, setOpen] = useState<LeadItemResponse | null>(null);
  const [assignFor, setAssignFor] = useState<string | undefined>();
  const [assignBulk, setAssignBulk] = useState<string[] | null>(null);
  const [lostFor, setLostFor] = useState<LeadItemResponse | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  // bumped to hand the table fresh rows when a local change must be thrown away (e.g. "Lost" cancelled)
  const [reset, setReset] = useState(0);

  const query = useLeads({ limit: 200 });
  const updateLead = useUpdateLead();
  const updateStatus = useUpdateLeadStatus();
  const bulkStatus = useBulkUpdateStatus();

  const leads = useMemo(() => {
    const items = query.data?.items ?? [];
    return statuses ? items.filter(l => statuses.includes(l.status)) : items;
  }, [query.data, statuses]);
  const byId = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

  const rows: DTRow[] = useMemo(
    () =>
      leads.map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone || '',
        interest: [l.buyerDna?.bhk?.[0], l.buyerDna?.localities?.[0]].filter(Boolean).join(' · ') || '—',
        budget: l.buyerDna?.budgetMax ?? 0,
        source: sourceLabel(l.source),
        status: statusInfo(l.status).label,
        agent: l.assignedAgentName || 'Unassigned',
        intent: l.intentScore ?? null,
        last: new Date(l.updatedAt).getTime(),
        followup: l.nextFollowUpAt ? new Date(l.nextFollowUpAt).getTime() : null,
      })),
    [leads, reset],
  );

  const filterOptions = statuses ? STATUS_OPTIONS.filter(o => statuses.includes(o.value)) : STATUS_OPTIONS;
  const Singular = `${noun.singular[0]!.toUpperCase()}${noun.singular.slice(1)}`;
  const columns: DTColumn[] = [
    { key: 'name', label: Singular, type: 'person', subKey: 'phone', width: 220, editable: true },
    { key: 'phone', label: 'Phone', type: 'text', width: 140, editable: true, hidden: true },
    { key: 'interest', label: 'Property interest', type: 'text', width: 170 },
    { key: 'budget', label: 'Budget', type: 'money', width: 130, editable: true },
    { key: 'source', label: 'Source', type: 'text', width: 120, filter: true },
    { key: 'status', label: 'Status', type: 'status', options: filterOptions.map(o => o.label), width: 140, editable: true },
    { key: 'agent', label: 'Assigned agent', type: 'text', width: 150, filter: true },
    { key: 'intent', label: 'Intent', type: 'number', width: 90 },
    { key: 'last', label: 'Last contact', type: 'ago', width: 130 },
    { key: 'followup', label: 'Next follow-up', type: 'date', width: 140 },
  ];

  const onEdit = (row: DTRow, key: string, value: unknown) => {
    const lead = byId.get(String(row.id));
    if (!lead) return;
    if (key === 'name') updateLead.mutate({ leadId: lead.id, patch: { name: String(value) } });
    else if (key === 'phone') updateLead.mutate({ leadId: lead.id, patch: { phone: String(value) } });
    else if (key === 'budget') updateLead.mutate({ leadId: lead.id, patch: { budgetMax: Number(value) || null } });
    else if (key === 'status') {
      const next = STATUS_OPTIONS.find(o => o.label === value)?.value;
      if (!next || next === lead.status) return;
      if (next === 'lost') setLostFor(lead); // a reason is required; the modal confirms or cancels
      else updateStatus.mutate({ leadId: lead.id, status: next });
    }
  };

  return (
    <section aria-label={`${noun.plural} table`} className="space-y-3">
      {query.isError && (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {query.error.message}
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>
        </div>
      )}

      <DataTable
        backdrop={false}
        loadFont={false}
        theme={theme}
        title={`${Singular}s`.replace(/ys$/, 'ies')}
        hideTitle
        toolbarEnd={
          allowAdd && (
            <>
              <button type="button" className="dtb-tb" onClick={() => setImporting(true)}>
                <Upload aria-hidden className="h-3.5 w-3.5" />Import
              </button>
              <button type="button" className="dtb-tb pri" onClick={() => setAdding(true)}>
                <Plus aria-hidden className="h-3.5 w-3.5" />Add {noun.singular}
              </button>
            </>
          )
        }
        rows={rows}
        columns={columns}
        loading={query.isLoading}
        pageSize={20}
        pageSizes={[10, 20, 50]}
        defaultSort={[{ key: 'last', dir: 1 }]}
        statusColors={STATUS_COLORS}
        onEdit={onEdit}
        labels={{
          search: `Search ${noun.plural}`,
          emptyTitle: leads.length ? `No ${noun.plural} match` : `No ${noun.plural} yet`,
          emptyText: leads.length ? 'Try fewer words or clear the filters.' : `New ${noun.plural} appear here as soon as your chatbot or forms capture them.`,
        }}
        bulkActions={(ids, clear) => (
          <>
            <label className="sr-only" htmlFor="bulk-status">Set status for selected</label>
            <select
              id="bulk-status"
              value=""
              onChange={e => {
                const status = e.target.value as LeadStatus;
                if (!status) return;
                void bulkStatus.mutateAsync({ leadIds: ids.map(String), status }).then(clear);
              }}
            >
              <option value="">Set status…</option>
              {STATUS_OPTIONS.filter(o => o.value !== 'lost').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" onClick={() => setAssignBulk(ids.map(String))}>Assign agent</button>
          </>
        )}
        detail={r => {
          const lead = byId.get(String(r.id));
          if (!lead) return null;
          return (
            // sticky + capped width keeps the panel in view even when the table is scrolled sideways
            <div className="dtb-facts sticky left-0 max-w-[min(100%,calc(100vw-340px))]">
              <dl><dt>Email</dt><dd>{lead.email || '—'}</dd></dl>
              <dl><dt>Assigned agent</dt><dd>{lead.assignedAgentName || 'Unassigned'}</dd></dl>
              <dl><dt>Next follow-up</dt><dd>{formatDateTime(lead.nextFollowUpAt)}</dd></dl>
              <dl><dt>Source</dt><dd>{sourceLabel(lead.source)}</dd></dl>
              <span className="acts">
                <button type="button" className="dtb-tb sm" onClick={() => setAssignFor(lead.id)}>{lead.assignedAgentName ? 'Reassign' : 'Assign agent'}</button>
                <button type="button" className="dtb-tb sm pri" onClick={() => setOpen(lead)}>Open full profile</button>
              </span>
            </div>
          );
        }}
      />

      {/* portalled: the page's animated wrapper would otherwise trap these fixed overlays inside it */}
      {createPortal(<>
      <LeadDetailDrawer lead={open} isOpen={Boolean(open)} onClose={() => setOpen(null)} />

      <AssignAgentModal
        isOpen={Boolean(assignFor) || Boolean(assignBulk)}
        leadId={assignFor}
        leadIds={assignBulk ?? undefined}
        onClose={() => {
          setAssignFor(undefined);
          setAssignBulk(null);
        }}
      />

      {lostFor && (
        <LostReasonModal
          isOpen
          leadName={lostFor.name}
          onClose={() => {
            setLostFor(null);
            setReset(n => n + 1);
          }}
          onConfirm={reason => {
            updateStatus.mutate({ leadId: lostFor.id, status: 'lost', lostReason: reason });
            setLostFor(null);
          }}
        />
      )}

      {adding && <AddLeadModal isOpen onClose={() => setAdding(false)} />}
      <ImportLeadsModal isOpen={importing} onClose={() => setImporting(false)} />
      </>, document.body)}
    </section>
  );
};

export default LeadsTable;
