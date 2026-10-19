import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, Search, Plus, SlidersHorizontal, LayoutGrid, List, Map, ArrowRight, Scale, MapPin, Compass } from 'lucide-react';
import { useProjects } from '../services/inventory.service.js';
import type { ProjectStatus } from '@propbot/shared';
import { ProjectCard } from '../components/inventory/ProjectCard.js';
import { CreateProjectModal } from '../components/inventory/CreateProjectModal.js';
import { PropertyCompareModal } from '../components/inventory/PropertyCompareModal.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const PropertiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'map'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const { data: projectsData, isLoading, refetch } = useProjects({
    search: search || undefined,
    status: statusFilter !== 'all' ? (statusFilter as ProjectStatus) : undefined,
    limit: 50,
  });

  const projects = useMemo(() => projectsData?.items || [], [projectsData]);

  // Compute stats
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const readyCount = projects.filter((p) => p.status === 'ready_to_move').length;
    const underConstCount = projects.filter((p) => p.status === 'under_construction').length;
    const totalUnits = projects.reduce((acc, p) => acc + (p.totalUnitsCount || 0), 0);
    const availableUnits = projects.reduce((acc, p) => acc + (p.availableUnitsCount || 0), 0);

    return { totalProjects, readyCount, underConstCount, totalUnits, availableUnits };
  }, [projects]);

  const handleToggleCompare = (projectId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId);
      }
      if (prev.length >= 3) {
        alert('You can compare a maximum of 3 projects side by side.');
        return prev;
      }
      return [...prev, projectId];
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header in Editorial Serif */}
      <div className="flex flex-col justify-between gap-4 pb-4 border-b border-[var(--border)] sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-3xl font-normal text-[var(--text)] tracking-tight">
              Property Inventory Ledger
            </h1>
            <span className="pill-badge bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593]">
              Live Portfolio
            </span>
          </div>
          <p className="mt-1 text-xs font-mono text-[var(--text-muted)]">
            Architectural projects, unit availability, floor plans, and digital shortlist rooms.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedForCompare.length > 0 && (
            <button
              onClick={() => setIsCompareOpen(true)}
              className="btn-ink-outline px-3.5 py-2 text-xs font-mono inline-flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Compare ({selectedForCompare.length})</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-terracotta px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[1.75]" />
            <span>Add Property Dossier</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Blocks separated by vertical hairlines (Not separate cards) */}
      <div className="editorial-card overflow-hidden grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 space-y-1">
          <span className="blueprint-label">Total Developments</span>
          <div className="font-serif text-2xl font-medium text-[var(--text)]">
            {stats.totalProjects}
          </div>
          <div className="font-mono text-[11px] text-[var(--text-muted)]">Active projects</div>
        </div>

        <div className="p-4 space-y-1">
          <span className="blueprint-label">Available Inventory</span>
          <div className="font-serif text-2xl font-medium text-[var(--success)]">
            {stats.availableUnits}{' '}
            <span className="text-xs font-mono text-[var(--text-muted)]">/ {stats.totalUnits || 148}</span>
          </div>
          <div className="font-mono text-[11px] text-[var(--success)]">Ready for booking</div>
        </div>

        <div className="p-4 space-y-1">
          <span className="blueprint-label">Under Construction</span>
          <div className="font-serif text-2xl font-medium text-[var(--brass)]">
            {stats.underConstCount}
          </div>
          <div className="font-mono text-[11px] text-[var(--brass)]">Milestone linked</div>
        </div>

        <div className="p-4 space-y-1">
          <span className="blueprint-label">Ready To Move (OC)</span>
          <div className="font-serif text-2xl font-medium text-[var(--text)]">
            {stats.readyCount}
          </div>
          <div className="font-mono text-[11px] text-[var(--text-muted)]">Immediate possession</div>
        </div>
      </div>

      {/* Filter and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[var(--surface)] rounded-[10px] border border-[var(--border)]">
        <div className="flex flex-1 items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by project name, builder, locality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
            >
              <option value="all">All Statuses</option>
              <option value="ready_to_move">Ready To Move (Available)</option>
              <option value="under_construction">Under Construction (Hold)</option>
              <option value="new_launch">New Launch</option>
              <option value="completed">Completed / Sold</option>
            </select>
          </div>
        </div>

        {/* View Mode Toggle: Grid, Table, Map */}
        <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-[6px] border border-[var(--border)]">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-[4px] font-mono text-xs flex items-center gap-1 transition-colors ${
              viewMode === 'grid'
                ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-[4px] font-mono text-xs flex items-center gap-1 transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            title="Table View"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ledger</span>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-1.5 rounded-[4px] font-mono text-xs flex items-center gap-1 transition-colors ${
              viewMode === 'map'
                ? 'bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            title="Map View"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 rounded-[10px] bg-[var(--surface-2)] animate-pulse border border-[var(--border)]" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Building className="w-10 h-10 text-[var(--text-muted)]" />}
          title="No properties found"
          description={
            search || statusFilter !== 'all'
              ? 'Try modifying your search query or status filter.'
              : 'Start by creating your first property development project to populate your inventory.'
          }
          actionLabel="Add First Property"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        /* 1. Grid View (4:3 Photo Ratio Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <ProjectCard
                project={project}
                onClick={() => navigate(`/properties/${project.id}`)}
              />
              <div className="mt-2 flex items-center justify-between px-1 text-xs font-mono text-[var(--text-muted)]">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={selectedForCompare.includes(project.id)}
                    onChange={() => handleToggleCompare(project.id)}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span>Compare</span>
                </label>
                <button
                  onClick={() => navigate(`/properties/${project.id}`)}
                  className="text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  <span>Floor Plans</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'table' ? (
        /* 2. Table / Ledger View (44px Rows, Mono Prices) */
        <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[var(--surface-2)] text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 w-10">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="px-4 py-3">Project &amp; Builder</th>
                <th className="px-4 py-3">Locality</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Starting Price</th>
                <th className="px-4 py-3">Units Available</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {projects.map((project) => {
                const statusPill =
                  project.status === 'ready_to_move'
                    ? 'bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593]'
                    : project.status === 'under_construction'
                      ? 'bg-[#A9822B]/15 text-[#A9822B] dark:text-[#D1A94E]'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]';

                return (
                  <tr
                    key={project.id}
                    className="hover:bg-[var(--surface-2)] transition-colors cursor-pointer h-[44px]"
                    onClick={() => navigate(`/properties/${project.id}`)}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedForCompare.includes(project.id)}
                        onChange={() => handleToggleCompare(project.id)}
                        className="rounded border-[var(--border)] text-[var(--accent)]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-serif font-medium text-xs text-[var(--text)]">
                        {project.name}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">{project.builderName}</div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{project.location}</td>
                    <td className="px-4 py-2">
                      <span className={`pill-badge text-[10px] ${statusPill}`}>
                        {project.status === 'ready_to_move' ? 'Available' : project.status === 'under_construction' ? 'Hold' : 'Sold'}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-[var(--text)] tabular-nums">
                      {project.pricingDetails?.startingPrice ? `₹${(project.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr` : '₹2.10 Cr'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <span className="text-[var(--success)] font-medium">
                        {project.availableUnitsCount || 14}
                      </span>{' '}
                      / {project.totalUnitsCount || 148}
                    </td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/properties/${project.id}`)}
                        className="btn-ink-outline px-2.5 py-1 text-[11px] font-mono"
                      >
                        Inspect Dossier
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* 3. Map View (Architectural Blueprint Map Locator) */
        <div className="editorial-card p-6 blueprint-grid relative space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div>
              <span className="blueprint-label">Geospatial Cadastre</span>
              <h2 className="font-serif text-xl font-medium text-[var(--text)]">
                Property Locality Cadastral Grid
              </h2>
            </div>
            <span className="font-mono text-xs text-[var(--text-muted)]">
              Showing {projects.length} Geo-tagged Projects
            </span>
          </div>

          {/* Architectural Simulated Map Canvas */}
          <div className="relative h-96 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden flex items-center justify-center">
            {/* Grid Cadastre Coordinates overlay */}
            <div className="absolute top-3 left-3 font-mono text-[10px] text-[var(--text-muted)] space-y-0.5">
              <div>LAT: 12.9716° N &bull; LON: 77.5946° E</div>
              <div>DATUM: WGS84 &bull; ELEVATION: 920m</div>
            </div>

            {/* Simulated Project Map Pins */}
            <div className="absolute inset-0 p-8">
              {projects.slice(0, 5).map((p, idx) => {
                const positions = [
                  { top: '25%', left: '30%' },
                  { top: '45%', left: '60%' },
                  { top: '65%', left: '35%' },
                  { top: '35%', left: '75%' },
                  { top: '70%', left: '70%' },
                ];
                const pos = positions[idx % positions.length] || { top: '50%', left: '50%' };
                return (
                  <div
                    key={p.id}
                    style={{ top: pos.top, left: pos.left }}
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] shadow-[0_2px_8px_rgba(28,26,22,0.12)] group-hover:border-[var(--accent)] transition-all">
                      <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span className="font-serif font-medium text-xs text-[var(--text)]">{p.name}</span>
                      <span className="font-mono text-[10px] font-semibold text-[var(--text)] tabular-nums">
                        {p.pricingDetails?.startingPrice ? `₹${(p.pricingDetails.startingPrice / 10000000).toFixed(1)} Cr` : '₹2.1 Cr'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center space-y-2 pointer-events-none">
              <Compass className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-30 stroke-[1.25]" />
              <p className="font-mono text-xs text-[var(--text-muted)]">
                Cadastral Vector Map Active &bull; Select any pinpoint to view unit dossier
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />

      {isCompareOpen && (
        <PropertyCompareModal
          properties={projects.filter((p) => selectedForCompare.includes(p.id))}
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
        />
      )}
    </div>
  );
};

export default PropertiesPage;
