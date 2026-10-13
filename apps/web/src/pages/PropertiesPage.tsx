import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  SlidersHorizontal,
  Home,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  ArrowRight,
  Scale,
} from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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
      {/* Top Banner Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Property Inventory
            </h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
              Live Stock
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage projects, individual units, specifications, brochures, and buyer shortlist rooms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedForCompare.length > 0 && (
            <button
              onClick={() => setIsCompareOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-amber-600 transition-all"
            >
              <Scale className="w-4 h-4" />
              Compare ({selectedForCompare.length})
            </button>
          )}

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-hover transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Projects</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats.totalProjects}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Available Units</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats.availableUnits} <span className="text-xs font-normal text-slate-400">/ {stats.totalUnits} total</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Under Construction</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats.underConstCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="rounded-xl bg-purple-50 p-3 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ready to Move</p>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {stats.readyCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by project name, builder, or locality..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Statuses</option>
              <option value="under_construction">Under Construction</option>
              <option value="ready_to_move">Ready To Move</option>
              <option value="new_launch">New Launch</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === 'grid'
                ? 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg border transition-colors ${
              viewMode === 'table'
                ? 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12 text-slate-400" />}
          title="No properties found"
          description={
            search || statusFilter !== 'all'
              ? 'Try modifying your search query or status filter.'
              : 'Start by creating your first property development project to populate your inventory.'
          }
          actionLabel="Add First Project"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <ProjectCard
                project={project}
                onClick={() => navigate(`/properties/${project.id}`)}
              />
              <div className="mt-2 flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedForCompare.includes(project.id)}
                    onChange={() => handleToggleCompare(project.id)}
                    className="rounded border-slate-300 text-primary focus:ring-primary/20"
                  />
                  Compare
                </label>
                <button
                  onClick={() => navigate(`/properties/${project.id}`)}
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  Manage Units
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 w-10">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="px-4 py-3">Project / Builder</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Starting Price</th>
                <th className="px-4 py-3">Units Available</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/properties/${project.id}`)}
                >
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(project.id)}
                      onChange={() => handleToggleCompare(project.id)}
                      className="rounded border-slate-300 text-primary focus:ring-primary/20"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {project.name}
                    </div>
                    <div className="text-xs text-slate-500">{project.builderName}</div>
                  </td>
                  <td className="px-4 py-3.5">{project.location}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-900 dark:text-white font-semibold">
                    {project.pricingDetails?.startingPrice
                      ? project.pricingDetails.startingPrice >= 10000000
                        ? `₹${(project.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr`
                        : `₹${(project.pricingDetails.startingPrice / 100000).toFixed(2)} L`
                      : 'On Request'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-emerald-600 font-semibold">
                      {project.availableUnitsCount || 0}
                    </span>{' '}
                    / {project.totalUnitsCount || 0}
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/properties/${project.id}`)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
