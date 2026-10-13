import React from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { ProjectItem } from '@propbot/shared';

interface ProjectCardProps {
  project: ProjectItem;
  onClick: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  const heroImage = project.gallery?.[0] || null;

  const statusBadge =
    project.status === 'ready_to_move'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
      : project.status === 'new_launch'
        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300'
        : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300';

  const bhkSet = Array.from(new Set(project.floorPlans?.map(f => f.bhk) || []));

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
    >
      <div>
        {/* Hero Image or Fallback */}
        <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          {heroImage ? (
            <img
              src={heroImage}
              alt={project.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Building2 className="h-10 w-10 stroke-1" />
              <span className="text-xs font-medium mt-1">Luxury Development</span>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 left-3">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}
            >
              {project.status.replace('_', ' ')}
            </span>
          </div>

          {/* Available Units Badge */}
          <div className="absolute top-3 right-3 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
            {project.availableUnitsCount ?? 0} Units Available
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-1">
              <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition-colors">
                {project.name}
              </h3>
              {project.reraNo && (
                <span
                  title={`RERA: ${project.reraNo}`}
                  className="flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0"
                >
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> RERA
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              By {project.builderName}
            </p>
          </div>

          {/* Location & Possession */}
          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{project.location}</span>
            </div>
            {project.possessionDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Possession: {project.possessionDate}</span>
              </div>
            )}
          </div>

          {/* BHK Configurations */}
          {bhkSet.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {bhkSet.map(bhk => (
                <span
                  key={bhk}
                  className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-900"
                >
                  {bhk} BHK
                </span>
              ))}
            </div>
          )}

          {/* USPs Preview */}
          {project.usps && project.usps.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.usps.slice(0, 2).map((usp, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"
                >
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                  <span className="truncate max-w-[130px]">{usp}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Price & Details CTA */}
      <div className="flex items-center justify-between border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400">Starting From</span>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {project.pricingDetails?.startingPrice
              ? `₹${(project.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr`
              : 'Price on Request'}
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform dark:text-blue-400">
          <span>Manage</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};
