import React, { useState } from 'react';
import { Inbox, Search } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Skeleton, STATUS_KEYS, StatusBadge, TabPanel, Tabs, ThemeToggle, useToast } from '../components/ui/index.js';

const SWATCHES = ['bg', 'surface', 'surface-2', 'surface-3', 'border', 'text', 'text-muted', 'accent', 'accent-soft', 'brass', 'success', 'warning', 'danger'] as const;
const STATUS_SAMPLES = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'negotiation', 'converted', 'lost'];

/** Every component, in one theme. Rendered twice (light and dark) side by side. */
const Specimen: React.FC<{ theme: 'light' | 'dark' }> = ({ theme }) => {
  const [tab, setTab] = useState('one');
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <div data-theme={theme} className={`${theme === 'dark' ? 'dark ' : ''}rounded-2xl border border-border bg-bg p-5 text-text`} data-testid={`specimen-${theme}`}>
      <h2 className="mb-4 text-lg font-bold capitalize">{theme} theme</h2>

      <section aria-label={`${theme} colours`} className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Colours</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {SWATCHES.map(s => (
            <div key={s} className="text-[11px]">
              <div className="h-10 rounded-lg border border-border" style={{ background: `var(--${s})` }} />
              <p className="mt-1 text-text-muted">{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={`${theme} status pills`} className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Lead status</h3>
        <div className="flex flex-wrap gap-2">{STATUS_SAMPLES.map(s => <StatusBadge key={s} status={s} />)}</div>
        <p className="mt-2 text-[11px] text-text-muted">{STATUS_KEYS.length} colour pairs, each at least 4.5:1.</p>
      </section>

      <section aria-label={`${theme} buttons`} className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Buttons and badges</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button isLoading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="blue">Brand</Badge>
          <Badge variant="mint">Active</Badge>
          <Badge variant="gold">Pending</Badge>
          <Badge variant="rose">Failed</Badge>
          <Badge variant="slate">Neutral</Badge>
        </div>
      </section>

      <section aria-label={`${theme} form fields`} className="mb-6 grid gap-3 sm:grid-cols-2">
        <Input label="Lead name" placeholder="Asha Rao" leftIcon={<Search className="h-4 w-4" />} hint="As the buyer introduced themselves" />
        <Input label="Phone" defaultValue="12345" error="Enter a valid 10-digit mobile number" />
        <Select label="Source" defaultValue="web">
          <option value="web">Web chatbot</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="form">Form</option>
        </Select>
        <Input label="Disabled" disabled defaultValue="Read only" />
      </section>

      <section aria-label={`${theme} cards`} className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card className="p-4"><p className="text-xs text-text-muted">New leads today</p><p className="text-2xl font-bold">24</p></Card>
        <Card variant="elevated" hoverEffect className="p-4"><p className="text-xs text-text-muted">Site visits booked</p><p className="text-2xl font-bold">9</p></Card>
      </section>

      <section aria-label={`${theme} tabs`} className="mb-6">
        <Tabs label={`${theme} sample tabs`} value={tab} onChange={setTab} tabs={[{ id: 'one', label: 'Leads' }, { id: 'two', label: 'Clients', count: 12 }, { id: 'three', label: 'Archived' }]} />
        <TabPanel id="one" value={tab} className="pt-3 text-sm text-text-muted">Leads panel</TabPanel>
        <TabPanel id="two" value={tab} className="pt-3 text-sm text-text-muted">Clients panel</TabPanel>
        <TabPanel id="three" value={tab} className="pt-3 text-sm text-text-muted">Archived panel</TabPanel>
      </section>

      <section aria-label={`${theme} feedback`} className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Modal, toast, loading, empty</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => toast.success('Lead saved')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not save. Try again.')}>Error toast</Button>
        </div>
        <div className="mt-3 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
        <div className="mt-3 rounded-xl border border-dashed border-border"><EmptyState icon={<Inbox className="h-7 w-7" />} title="No leads yet" description="Leads from your chatbot and WhatsApp appear here." actionLabel="Add a lead" onAction={() => toast.info('Add lead clicked')} /></div>
        <Modal open={open} onClose={() => setOpen(false)} title="Archive this lead?" description="You can restore it from the Archived tab." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}>Archive</Button></>}>
          <Input label="Reason" placeholder="Optional" />
        </Modal>
      </section>
    </div>
  );
};

export const StyleguidePage: React.FC = () => (
  <main className="mx-auto max-w-[1400px] bg-bg p-4 text-text sm:p-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Style guide</h1>
        <p className="text-sm text-text-muted">Every shared component in both themes. Colours, radii and spacing come from <code>src/styles/tokens.css</code>.</p>
      </div>
      <ThemeToggle />
    </header>
    <div className="grid gap-6 xl:grid-cols-2">
      <Specimen theme="light" />
      <Specimen theme="dark" />
    </div>
  </main>
);
