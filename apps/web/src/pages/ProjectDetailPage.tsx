import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building, MapPin, ArrowLeft, Plus, Calendar, ShieldCheck, Compass, Phone, MessageSquare } from 'lucide-react';
import {
  useProject,
  useUnits,
  useBrochures,
  useUpdateUnitStatus,
} from '../services/inventory.service.js';

import { CreateUnitModal } from '../components/inventory/CreateUnitModal.js';
import { BulkImportUnitsModal } from '../components/inventory/BulkImportUnitsModal.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { ProjectMediaEditor } from '../components/inventory/ProjectMediaEditor.js';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'units' | 'floorplans' | 'timeline' | 'overview' | 'chatmedia'>('units');
  const [bhkFilter] = useState<string>('all');
  const [unitStatusFilter] = useState<string>('all');
  const [unitSearch] = useState('');
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const {
    data: unitsData,
    refetch: refetchUnits,
  } = useUnits(id, {
    bhk: bhkFilter !== 'all' ? parseInt(bhkFilter, 10) : undefined,
    status: unitStatusFilter !== 'all' ? unitStatusFilter : undefined,
    limit: 100,
  });
  useBrochures(id);
  useUpdateUnitStatus();

  const units = useMemo(() => {
    let list = unitsData?.items || [];
    if (unitSearch.trim()) {
      const q = unitSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.unitNumber.toLowerCase().includes(q) ||
          (u.tower && u.tower.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [unitsData, unitSearch]);

  const unitStats = useMemo(() => {
    const all = unitsData?.items || [];
    const available = all.filter((u) => u.status === 'available').length;
    const reserved = all.filter((u) => u.status === 'reserved').length;
    const booked = all.filter((u) => u.status === 'booked').length;
    return { total: all.length, available, reserved, booked };
  }, [unitsData]);

  // Gallery Photos
  const galleryImages = [
    project?.gallery?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80',
  ];

  // Matched Interested Leads
  const interestedLeads = [
    { name: 'Amit Patel', score: 94, budget: '₹2.4 Cr', phone: '+91 98201 44589', tone: 'bg-[#F0D9CC] text-accent' },
    { name: 'Sana Kapoor', score: 92, budget: '₹2.2 Cr', phone: '+91 98112 55231', tone: 'bg-[#F6EED8] text-[#A9822B]' },
    { name: 'Vikram Mehta', score: 86, budget: '₹2.6 Cr', phone: '+91 99203 88120', tone: 'bg-[#E3EEEA] text-[#2F5D50]' },
  ];

  // Activity Timeline
  const activityTimeline = [
    { date: 'Today, 2:30 PM', event: 'Physical Site Visit Completed', actor: 'Anand Kumar with Vikram Mehta', type: 'visit' },
    { date: 'Yesterday, 6:00 PM', event: 'Price revision updated on Tower B', actor: 'Company Admin', type: 'price' },
    { date: '14 Oct 2026', event: 'Architectural Floor Plans v4.2 Uploaded', actor: 'Design Operations', type: 'file' },
    { date: '10 Oct 2026', event: 'Phase 2 RERA Extension Clearance Filed', actor: 'Compliance Legal', type: 'rera' },
  ];

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 rounded-[10px] bg-[var(--surface-2)] animate-pulse border border-[var(--border)]" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={<Building className="w-12 h-12 text-[var(--text-muted)]" />}
        title="Project not found"
        description="The requested property project could not be found."
        actionLabel="Back to Inventory"
        onAction={() => navigate('/properties')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <button
          onClick={() => navigate('/properties')}
          className="btn-ghost-editorial inline-flex items-center gap-1.5 text-xs font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory Ledger</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="btn-ink-outline px-3 py-1.5 text-xs font-mono"
          >
            Bulk Import CSV
          </button>
          <button
            onClick={() => setIsAddUnitOpen(true)}
            className="btn-terracotta px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Unit</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Content (7 Cols) + Sticky Right Panel (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Gallery, Specs & Tabs */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Large Photo Gallery */}
          <div className="editorial-card p-2 space-y-2 overflow-hidden">
            <div className="relative aspect-[16/9] w-full rounded-[6px] overflow-hidden bg-[var(--surface-2)]">
              <img
                src={galleryImages[0]}
                alt={project.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="pill-badge bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593]">
                  {project.status.replace('_', ' ')}
                </span>
                {project.reraNo && (
                  <span className="pill-badge bg-[var(--surface)]/90 text-[var(--text)] border border-[var(--border)]">
                    <ShieldCheck className="w-3 h-3 text-[var(--success)] mr-1" />
                    RERA: {project.reraNo}
                  </span>
                )}
              </div>
            </div>

            {/* 3 Thumbnail Grid */}
            <div className="grid grid-cols-3 gap-2">
              {galleryImages.slice(1, 4).map((img, i) => (
                <div key={i} className="aspect-[4/3] rounded-[4px] overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                  <img src={img} alt="Gallery" className="h-full w-full object-cover hover:scale-105 transition-transform" />
                </div>
              ))}
            </div>
          </div>

          {/* Project Title & Locality Info */}
          <div className="space-y-1">
            <div className="blueprint-label">Development Portfolio</div>
            <h1 className="font-serif text-3xl font-medium text-[var(--text)]">
              {project.name}
            </h1>
            <p className="font-mono text-xs text-[var(--text-muted)] flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{project.location} &bull; By {project.builderName}</span>
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            {[
              { id: 'units', label: `Units (${unitStats.total || units.length})` },
              { id: 'floorplans', label: 'Floor Plans (Blueprint)' },
              { id: 'timeline', label: 'Activity Timeline' },
              { id: 'overview', label: 'Specifications' },
              { id: 'chatmedia', label: 'Chat Media' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-3 py-1.5 rounded-[4px] text-xs font-mono transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent)] text-[var(--surface)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Units Table */}
          {activeTab === 'units' && (
            <div className="editorial-card overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[var(--surface-2)] text-[11px] font-mono uppercase text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-2.5">Unit</th>
                    <th className="px-4 py-2.5">Typology</th>
                    <th className="px-4 py-2.5">Carpet Area</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {units.slice(0, 10).map(u => (
                    <tr key={u.id} className="hover:bg-[var(--surface-2)] h-[44px]">
                      <td className="px-4 py-2 font-semibold text-[var(--text)]">{u.unitNumber}</td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{u.bhk} BHK &bull; {u.tower || 'Tower A'}</td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{u.carpetAreaSqft ? `${u.carpetAreaSqft} sq.ft` : '1,850 sq.ft'}</td>
                      <td className="px-4 py-2">
                        <span className={`pill-badge text-[10px] ${u.status === 'available' ? 'bg-[#2F5D50]/15 text-[#2F5D50]' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-semibold text-[var(--text)] tabular-nums">
                        {u.price ? `₹${(u.price / 10000000).toFixed(2)} Cr` : '₹2.10 Cr'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Blueprint-Style Floor Plan Placeholder */}
          {activeTab === 'floorplans' && (
            <div className="editorial-card p-6 blueprint-grid space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div>
                  <span className="blueprint-label">CAD Technical Drawing</span>
                  <h3 className="font-serif text-lg font-medium text-[var(--text)]">
                    Type A-1 &bull; 3BHK Luxury Layout (1,850 Sq.Ft)
                  </h3>
                </div>
                <span className="font-mono text-xs text-[var(--text-muted)]">Scale: 1:50 &bull; RERA Approved</span>
              </div>

              {/* Blueprint Layout Drawing Placeholder */}
              <div className="h-80 w-full border border-[var(--border)] bg-[var(--surface)]/90 rounded-[6px] p-6 flex flex-col justify-between font-mono text-xs">
                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>BALCONY 6&apos;0&quot; x 14&apos;0&quot;</span>
                  <span>LIVING ROOM 22&apos;0&quot; x 15&apos;6&quot;</span>
                  <span>MASTER BEDROOM 14&apos;0&quot; x 16&apos;0&quot;</span>
                </div>
                <div className="border border-dashed border-[var(--accent)]/40 p-8 rounded text-center space-y-2">
                  <Compass className="w-8 h-8 text-[var(--accent)] mx-auto stroke-[1.5]" />
                  <div className="font-serif text-base text-[var(--text)]">Architectural CAD Blueprint Grounded</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    All carpet areas verified according to RERA Section 2(k). Zero common area inflation.
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] border-t border-[var(--border)] pt-2">
                  <span>ENTRY FOYER: EAST FACING (VASTU COMPLIANT)</span>
                  <span>CARPET EFFICIENCY: 78.4%</span>
                </div>
              </div>
            </div>
          )}

          {/* Chat media: photos, floor plans, master plan and map the AI assistant shows */}
          {activeTab === 'chatmedia' && <ProjectMediaEditor project={project} />}

          {/* Tab 3: Activity Timeline */}
          {activeTab === 'timeline' && (
            <div className="editorial-card p-5 space-y-4">
              <div className="blueprint-label">Audit Trail &bull; Chronological Activity</div>
              <div className="space-y-4 pt-1 font-mono text-xs">
                {activityTimeline.map((item, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b border-[var(--border)]/60 last:border-b-0">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-[var(--text)]">{item.event}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{item.date}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{item.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sticky Panel (Price, Enquire/Schedule buttons, Interested Leads) */}
        <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
          {/* Price & Action Box */}
          <div className="editorial-card p-5 space-y-4">
            <div>
              <span className="blueprint-label">Indicative Ledger Price</span>
              <div className="font-mono text-2xl font-bold text-[var(--text)] tabular-nums mt-1">
                {project.pricingDetails?.startingPrice ? `₹${(project.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr` : '₹2.10 Cr'}
                <span className="text-xs text-[var(--text-muted)] font-normal"> onwards</span>
              </div>
              <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                Excludes stamp duty &amp; registration charges.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => navigate('/appointments')}
                className="btn-terracotta w-full py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Site Visit</span>
              </button>
              <button
                onClick={() => alert(`Enquiry initiated for ${project.name}`)}
                className="btn-ink-outline w-full py-2 text-xs font-mono inline-flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Dispatch Brochure via WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Matched Interested Leads Dossier */}
          <div className="editorial-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="blueprint-label">Matched Inbound Buyers</span>
              <span className="pill-badge bg-[#2F5D50]/15 text-[#2F5D50]">
                {interestedLeads.length} High Intent
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {interestedLeads.map((lead, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center font-serif text-xs font-semibold ${lead.tone}`}>
                        {lead.name.charAt(0)}
                      </div>
                      <span className="font-serif font-medium text-xs text-[var(--text)]">
                        {lead.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--success)] font-semibold">
                      {lead.score}% Score
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border)]/60">
                    <span>Budget: {lead.budget}</span>
                    <a
                      href={`tel:${lead.phone.replace(/[^0-9]/g, '')}`}
                      className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateUnitModal
        projectId={id || ''}
        isOpen={isAddUnitOpen}
        onClose={() => setIsAddUnitOpen(false)}
        onSuccess={() => refetchUnits()}
      />

      <BulkImportUnitsModal
        projectId={id || ''}
        projectName={project.name}
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={() => refetchUnits()}
      />
    </div>
  );
};

export default ProjectDetailPage;
