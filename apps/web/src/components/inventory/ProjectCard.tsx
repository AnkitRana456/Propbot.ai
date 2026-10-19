import React from 'react';
import {
  MapPin,
  Home,
  Maximize2,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import type { ProjectItem, ProjectStatus } from '@propbot/shared';

interface ProjectCardProps {
  project: ProjectItem;
  onClick: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  const heroImage = project.gallery?.[0] || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';

  // Status mapping as requested: Available = pine, Hold = brass, Sold = muted
  const statusConfig: Record<ProjectStatus, { label: string; style: string }> = {
    ready_to_move: { label: 'Available', style: 'bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593]' },
    under_construction: { label: 'Hold / Under Const.', style: 'bg-[#A9822B]/15 text-[#A9822B] dark:text-[#D1A94E]' },
    new_launch: { label: 'Available (Launch)', style: 'bg-[#2F5D50]/15 text-[#2F5D50] dark:text-[#6FA593]' },
    completed: { label: 'Sold / Completed', style: 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]' },
  };

  const currentStatus = statusConfig[project.status] || {
    label: 'Sold',
    style: 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]',
  };

  // Price calculation
  const priceDisplay = project.pricingDetails?.startingPrice
    ? `₹${(project.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr`
    : '₹2.10 Cr';

  const sqftDisplay = project.floorPlans?.[0]?.carpetAreaSqft
    ? `${project.floorPlans[0].carpetAreaSqft} sq.ft`
    : '1,850 sq.ft';

  const bhkSet = Array.from(new Set(project.floorPlans?.map(f => f.bhk) || [3]));
  const bhkDisplay = bhkSet.slice(0, 2).map(b => `${b} BHK`).join(', ') || '3 BHK';

  return (
    <div
      onClick={onClick}
      className="editorial-card group overflow-hidden cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* 4:3 Image-first Photo Ratio */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-2)]">
          <img
            src={heroImage}
            alt={project.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
          />

          {/* Status Tag: Available = pine, Hold = brass, Sold = muted */}
          <div className="absolute top-3 left-3">
            <span className={`pill-badge ${currentStatus.style}`}>
              {currentStatus.label}
            </span>
          </div>

          {/* Available Units Ledger Pill */}
          <div className="absolute top-3 right-3 rounded-full bg-[var(--surface)]/90 px-2 py-0.5 text-[10px] font-mono font-medium text-[var(--text)] border border-[var(--border)]">
            {project.availableUnitsCount ?? 14} Units Left
          </div>
        </div>

        {/* Content Details */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-1">
              <h3 className="font-serif text-base font-medium text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                {project.name}
              </h3>
              {project.reraNo && (
                <span
                  title={`RERA: ${project.reraNo}`}
                  className="flex items-center gap-0.5 rounded-[4px] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.2 text-[9px] font-mono text-[var(--text-muted)] shrink-0"
                >
                  <ShieldCheck className="h-3 w-3 text-[var(--success)]" /> RERA
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-1 mt-1 truncate">
              <MapPin className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
              <span>{project.location} &bull; By {project.builderName}</span>
            </p>
          </div>

          {/* BHK / sqft / floor in small icon-label pairs */}
          <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--border)] text-[11px] font-mono text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              <Home className="h-3 w-3 text-[var(--accent)]" />
              <span className="truncate">{bhkDisplay}</span>
            </div>
            <div className="flex items-center gap-1">
              <Maximize2 className="h-3 w-3 text-[var(--brass)]" />
              <span className="truncate">{sqftDisplay}</span>
            </div>
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3 text-[var(--text-muted)]" />
              <span>Fl 4–18</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Ledger Footer: Price in JetBrains Mono */}
      <div className="px-4 pb-4 pt-1 flex items-center justify-between font-mono">
        <div>
          <span className="text-[10px] uppercase text-[var(--text-muted)] block">From</span>
          <span className="text-sm font-semibold text-[var(--text)] tabular-nums">
            {priceDisplay}
          </span>
        </div>
        <span className="text-xs font-mono text-[var(--accent)] group-hover:underline">
          View Dossier &rarr;
        </span>
      </div>
    </div>
  );
};

export default ProjectCard;
