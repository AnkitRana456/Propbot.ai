import React, { useMemo, useState } from 'react';
import { Download, Plus, Rows3, Search, Upload, Users, X } from 'lucide-react';
import type { LeadItemResponse, LeadStatus } from '@propbot/shared';
import { useLeads, useUpdateLead, useUpdateLeadStatus } from '../../services/leads.service.js';
import { useBulkUpdateStatus } from '../../services/crm.service.js';
import { DataGrid, type Density, type GridColumn } from './DataGrid.js';
import { StatusBadge, statusInfo } from '../ui/StatusBadge.js';
import { Button } from '../ui/Button.js';
import { EmptyState } from '../common/EmptyState.js';
import { LeadDetailDrawer } from '../leads/LeadDetailDrawer.js';
import { AssignAgentModal } from './AssignAgentModal.js';
import { LostReasonModal } from './LostReasonModal.js';
import { AddLeadModal } from './AddLeadModal.js';
import { ImportLeadsModal } from './ImportLeadsModal.js';
import { downloadCsv, formatDateTime, formatInr, parseInr, timeAgo, toLocalInput } from '../../lib/format.js';

const STATUS_OPTIONS: Array<{ value: LeadStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'site_visit_scheduled', label: 'Site visit' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'booked', label: 'Booked' },
  { value: 'lost', label: 'Lost' },
];

const sourceLabel = (source: string): string => {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (s === 'messenger' || s.includes('messenger')) return 'Messenger';
  if (s === 'instagram' || s.includes('instagram')) return 'Instagram';
  if (s.includes('form')) return 'Form';
  if (s.includes('chat') || s.includes('widget') || s.includes('web')) return 'Web chatbot';
  return source ? source.replace(/[_-]/g, ' ') : 'Direct';
};

const DENSITY_KEY = 'propbot_grid_density';

interface LeadsTableProps {
  /** Pre-filter the list, e.g. the Clients view shows booked and converted leads only. */
  statuses?: LeadStatus[];
  /** Noun for headings and empty states. */
  noun?: { singular: string; plural: string };
  allowAdd?: boolean;
}

/** The shared leads / clients grid: inline edit, status pills, bulk actions, CSV export and a detail drawer. */
export const LeadsTable: React.FC<LeadsTableProps> = ({ statuses, noun = { singular: 'lead', plural: 'leads' }, allowAdd = true }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<LeadItemResponse | null>(null);
  const [assignFor, setAssignFor] = useState<string | undefined>();
  const [assignBulk, setAssignBulk] = useState(false);
  const [lostFor, setLostFor] = useState<LeadItemResponse | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [density, setDensity] = useState<Density>(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  const query = useLeads({ status: statusFilter === 'all' ? undefined : statusFilter, search: search.trim() || undefined, limit: 200 });
  const updateLead = useUpdateLead();
  const updateStatus = useUpdateLeadStatus();
  const bulkStatus = useBulkUpdateStatus();

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return statuses ? items.filter(l => statuses.includes(l.status)) : items;
  }, [query.data, statuses]);

  const setDensityPersist = (d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* storage unavailable */
    }
  };

  const columns: Array<GridColumn<LeadItemResponse>> = [
    {
      key: 'name',
      label: `${noun.singular[0]!.toUpperCase()}${noun.singular.slice(1)} name`,
      width: 190,
      sortValue: l => l.name.toLowerCase(),
      render: l => (
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{l.name}</span>
          <button type="button" tabIndex={-1} onClick={e => (e.stopPropagation(), setOpen(l))} className="shrink-0 rounded px-1.5 text-xs font-semibold text-accent hover:bg-accent-soft" aria-label={`Open ${l.name}`}>
            Open
          </button>
        </span>
      ),
      edit: {
        initial: l => l.name,
        validate: v => (v.trim() ? null : 'Name is required'),
        save: async (l, v) => void (await updateLead.mutateAsync({ leadId: l.id, patch: { name: v.trim() } })),
        ariaLabel: 'Edit lead name',
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      width: 140,
      sortValue: l => l.phone,
      render: l => <span className="tabular-nums">{l.phone || '—'}</span>,
      edit: {
        type: 'tel',
        initial: l => l.phone,
        validate: v => (v.replace(/\D/g, '').length >= 7 ? null : 'Enter a valid phone number'),
        save: async (l, v) => void (await updateLead.mutateAsync({ leadId: l.id, patch: { phone: v.trim() } })),
      },
    },
    {
      key: 'interest',
      label: 'Property interest',
      width: 170,
      sortValue: l => l.buyerDna?.localities?.[0] ?? null,
      render: l => {
        const parts = [l.buyerDna?.bhk?.[0], l.buyerDna?.localities?.[0]].filter(Boolean);
        return <span className="block truncate text-text-muted">{parts.length ? parts.join(' · ') : '—'}</span>;
      },
    },
    {
      key: 'budget',
      label: 'Budget',
      width: 110,
      align: 'right',
      sortValue: l => l.buyerDna?.budgetMax ?? null,
      render: l => <span className="tabular-nums">{formatInr(l.buyerDna?.budgetMax)}</span>,
      edit: {
        initial: l => (l.buyerDna?.budgetMax ? formatInr(l.buyerDna.budgetMax).replace('₹', '') : ''),
        placeholder: 'e.g. 1.2 Cr or 85 L',
        validate: v => (v.trim() === '' || parseInr(v) !== null ? null : 'Use a number like 85 L or 1.2 Cr'),
        save: async (l, v) => void (await updateLead.mutateAsync({ leadId: l.id, patch: { budgetMax: v.trim() === '' ? null : parseInr(v) } })),
        ariaLabel: 'Edit budget in rupees',
      },
    },
    {
      key: 'source',
      label: 'Source',
      width: 120,
      sortValue: l => sourceLabel(l.source),
      render: l => <span className="text-text-muted">{sourceLabel(l.source)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      sortValue: l => statusInfo(l.status).label,
      render: l => <StatusBadge status={l.status} />,
      menu: (l, close) => (
        <ul role="menu" aria-label={`Change status for ${l.name}`}>
          {STATUS_OPTIONS.map(o => (
            <li key={o.value} role="none">
              <button
                role="menuitem"
                type="button"
                autoFocus={o.value === l.status}
                onClick={() => {
                  close();
                  if (o.value === l.status) return;
                  if (o.value === 'lost') setLostFor(l);
                  else updateStatus.mutate({ leadId: l.id, status: o.value });
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
              >
                <StatusBadge status={o.value} />
                {o.value === l.status && <span className="text-xs text-text-muted">Current</span>}
              </button>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'agent',
      label: 'Assigned agent',
      width: 150,
      sortValue: l => l.assignedAgentName?.toLowerCase() ?? null,
      render: l => <span className={l.assignedAgentName ? '' : 'text-text-muted'}>{l.assignedAgentName || 'Unassigned'}</span>,
      menu: (l, close) => (
        <div className="p-1">
          <button type="button" autoFocus onClick={() => (close(), setAssignFor(l.id))} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2">
            {l.assignedAgentName ? 'Reassign…' : 'Assign an agent…'}
          </button>
        </div>
      ),
    },
    {
      key: 'intent',
      label: 'Intent',
      width: 90,
      align: 'right' as const,
      sortValue: l => l.intentScore ?? null,
      render: l => {
        const score = l.intentScore;
        if (score === undefined || score === null) return <span className="text-text-muted">—</span>;
        const isHot = score >= 70;
        const isWarm = score >= 35;
        const color = isHot ? 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' : isWarm ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30' : 'text-text-muted bg-surface-2';
        const label = isHot ? '🔥' : isWarm ? '⚡' : '❄️';
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
            {label} {score}%
          </span>
        );
      },
    },
    {
      key: 'last',
      label: 'Last contact',
      width: 120,
      sortValue: l => new Date(l.updatedAt).getTime(),
      render: l => <span className="text-text-muted" title={formatDateTime(l.updatedAt)}>{timeAgo(l.updatedAt)}</span>,
    },
    {
      key: 'followup',
      label: 'Next follow-up',
      width: 160,
      sortValue: l => (l.nextFollowUpAt ? new Date(l.nextFollowUpAt).getTime() : null),
      render: l => {
        const overdue = l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < Date.now();
        return <span className={overdue ? 'font-medium text-danger' : l.nextFollowUpAt ? '' : 'text-text-muted'}>{formatDateTime(l.nextFollowUpAt)}</span>;
      },
      edit: {
        type: 'datetime-local',
        initial: l => toLocalInput(l.nextFollowUpAt),
        validate: v => (v === '' || !Number.isNaN(new Date(v).getTime()) ? null : 'Pick a valid date'),
        save: async (l, v) => void (await updateLead.mutateAsync({ leadId: l.id, patch: { nextFollowUpAt: v ? new Date(v).toISOString() : null } })),
        ariaLabel: 'Edit next follow-up',
      },
    },
  ];

  const exportCsv = () => {
    const chosen = selected.length ? rows.filter(r => selected.includes(r.id)) : rows;
    downloadCsv(
      `${noun.plural}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Phone', 'Email', 'Property interest', 'Budget (INR)', 'Source', 'Status', 'Assigned agent', 'Last contact', 'Next follow-up'],
      chosen.map(l => [
        l.name,
        l.phone,
        l.email ?? '',
        [l.buyerDna?.bhk?.[0], l.buyerDna?.localities?.[0]].filter(Boolean).join(' '),
        l.buyerDna?.budgetMax ?? '',
        sourceLabel(l.source),
        statusInfo(l.status).label,
        l.assignedAgentName ?? '',
        l.updatedAt,
        l.nextFollowUpAt ?? '',
      ]),
    );
  };

  const applyBulk = async (status: LeadStatus) => {
    if (status === 'lost') return; // a reason is needed per lead; use the row menu
    await bulkStatus.mutateAsync({ leadIds: selected, status });
    setSelected([]);
  };

  const filterOptions = statuses ? STATUS_OPTIONS.filter(o => statuses.includes(o.value)) : STATUS_OPTIONS;

  return (
    <section aria-label={`${noun.plural} table`} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${noun.plural}…`}
            aria-label={`Search ${noun.plural}`}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <label className="sr-only" htmlFor="grid-status-filter">Filter by status</label>
        <select
          id="grid-status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | LeadStatus)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="all">All statuses</option>
          {filterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDensityPersist(density === 'compact' ? 'comfortable' : 'compact')} leftIcon={<Rows3 className="h-4 w-4" />} aria-pressed={density === 'compact'}>
            {density === 'compact' ? 'Compact' : 'Comfortable'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0} leftIcon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
          {allowAdd && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImporting(true)} leftIcon={<Upload className="h-4 w-4" />}>
                Import CSV
              </Button>
              <Button size="sm" onClick={() => setAdding(true)} leftIcon={<Plus className="h-4 w-4" />}>
                Add {noun.singular}
              </Button>
            </>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
          <span className="font-semibold text-text">{selected.length} selected</span>
          <label className="sr-only" htmlFor="bulk-status">Set status for selected</label>
          <select id="bulk-status" value="" onChange={e => e.target.value && void applyBulk(e.target.value as LeadStatus)} className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text">
            <option value="">Set status…</option>
            {STATUS_OPTIONS.filter(o => o.value !== 'lost').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setAssignBulk(true)}>Assign agent</Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])} leftIcon={<X className="h-4 w-4" />}>Clear</Button>
        </div>
      )}

      <p className="text-xs text-text-muted" id="grid-hint">
        Arrow keys move between cells. Enter or F2 edits, Esc cancels. Click a status to change it.
      </p>

      <DataGrid
        label={`${noun.plural} table`}
        columns={columns}
        rows={rows}
        getId={l => l.id}
        selectedIds={selected}
        onSelectionChange={setSelected}
        onOpenRow={setOpen}
        density={density}
        loading={query.isLoading}
        error={query.isError ? query.error.message : null}
        onRetry={() => void query.refetch()}
        defaultSort={{ key: 'last', dir: 'desc' }}
        empty={
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title={search || statusFilter !== 'all' ? `No ${noun.plural} match` : `No ${noun.plural} yet`}
            description={search || statusFilter !== 'all' ? 'Try a different search or clear the status filter.' : `New ${noun.plural} appear here as soon as your chatbot or forms capture them.`}
          />
        }
      />

      <LeadDetailDrawer lead={open} isOpen={Boolean(open)} onClose={() => setOpen(null)} />

      <AssignAgentModal
        isOpen={Boolean(assignFor) || assignBulk}
        leadId={assignFor}
        leadIds={assignBulk ? selected : undefined}
        onClose={() => {
          setAssignFor(undefined);
          setAssignBulk(false);
        }}
      />

      {lostFor && (
        <LostReasonModal
          isOpen
          leadName={lostFor.name}
          onClose={() => setLostFor(null)}
          onConfirm={reason => {
            updateStatus.mutate({ leadId: lostFor.id, status: 'lost', lostReason: reason });
            setLostFor(null);
          }}
        />
      )}

      {adding && <AddLeadModal isOpen onClose={() => setAdding(false)} />}
      <ImportLeadsModal isOpen={importing} onClose={() => setImporting(false)} />
    </section>
  );
};

export default LeadsTable;
