import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  MapPin,
  ArrowLeft,
  Plus,
  Upload,
  Calendar,
  FileText,
  ShieldCheck,
  Sparkles,
  Home,
  CheckCircle2,
  Search,
  Train,
  GraduationCap,
  Hospital,
} from 'lucide-react';
import {
  useProject,
  useUnits,
  useBrochures,
  useUpdateUnitStatus,
} from '../services/inventory.service.js';
import type { UnitItem, UnitStatus } from '@propbot/shared';
import { CreateUnitModal } from '../components/inventory/CreateUnitModal.js';
import { BulkImportUnitsModal } from '../components/inventory/BulkImportUnitsModal.js';
import { EmiCalculator } from '../components/inventory/EmiCalculator.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'units' | 'overview' | 'calculator'>('units');
  const [bhkFilter, setBhkFilter] = useState<string>('all');
  const [unitStatusFilter, setUnitStatusFilter] = useState<string>('all');
  const [unitSearch, setUnitSearch] = useState('');

  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const {
    data: unitsData,
    isLoading: unitsLoading,
    refetch: refetchUnits,
  } = useUnits(id, {
    bhk: bhkFilter !== 'all' ? parseInt(bhkFilter, 10) : undefined,
    status: unitStatusFilter !== 'all' ? unitStatusFilter : undefined,
    limit: 100,
  });
  const { data: brochures = [] } = useBrochures(id);
  const updateUnitStatusMutation = useUpdateUnitStatus();

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
    const sold = all.filter((u) => u.status === 'sold').length;
    return { total: all.length, available, reserved, booked, sold };
  }, [unitsData]);

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700" />
        <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={<Building2 className="w-12 h-12 text-slate-400" />}
        title="Project not found"
        description="The requested property project could not be found or you do not have permission to access it."
        actionLabel="Back to Inventory"
        onAction={() => navigate('/properties')}
      />
    );
  }

  const handleStatusChange = async (unit: UnitItem, newStatus: UnitStatus) => {
    if (!id) return;
    await updateUnitStatusMutation.mutateAsync({
      unitId: unit.id,
      projectId: id,
      status: newStatus,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/properties')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Properties
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-4 h-4 text-primary" />
            Bulk Import CSV
          </button>

          <button
            onClick={() => setIsAddUnitOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Unit
          </button>
        </div>
      </div>

      {/* Project Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {project.builderName}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {project.status.replace('_', ' ').toUpperCase()}
              </span>
              {project.reraNo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  RERA: {project.reraNo}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {project.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                {project.location}
              </span>
              {project.possessionDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Possession: {project.possessionDate}
                </span>
              )}
              {brochures.length > 0 && (
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  <FileText className="w-4 h-4" />
                  {brochures.length} Brochure(s) Attached
                </span>
              )}
            </div>
          </div>

          {/* Pricing Highlight Box */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 min-w-[220px] text-right">
            <p className="text-xs uppercase font-bold text-primary tracking-wider">Starting Price</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {project.pricingDetails?.startingPrice
                ? project.pricingDetails.startingPrice >= 10000000
                  ? `₹${(project.pricingDetails.startingPrice / 10000000).toFixed(2)} Cr*`
                  : `₹${(project.pricingDetails.startingPrice / 100000).toFixed(2)} L*`
                : 'On Request'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Total Units: <span className="font-semibold text-slate-800 dark:text-slate-200">{project.totalUnitsCount || 0}</span>
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('units')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeTab === 'units'
                ? 'bg-primary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            Units & Inventory ({unitStats.total})
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeTab === 'overview'
                ? 'bg-primary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            Specifications & Locality
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeTab === 'calculator'
                ? 'bg-primary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            Loan EMI Calculator
          </button>
        </div>
      </div>

      {/* Tab 1: Units Inventory */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          {/* Quick Unit Status Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Available
              </p>
              <p className="text-2xl font-bold text-emerald-950 dark:text-emerald-200 mt-1">
                {unitStats.available}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Reserved
              </p>
              <p className="text-2xl font-bold text-amber-950 dark:text-amber-200 mt-1">
                {unitStats.reserved}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Booked
              </p>
              <p className="text-2xl font-bold text-blue-950 dark:text-blue-200 mt-1">
                {unitStats.booked}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Sold
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {unitStats.sold}
              </p>
            </div>
          </div>

          {/* Unit Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-1 items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search unit # or tower..."
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={bhkFilter}
                onChange={(e) => setBhkFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
              >
                <option value="all">All BHK</option>
                <option value="1">1 BHK</option>
                <option value="2">2 BHK</option>
                <option value="3">3 BHK</option>
                <option value="4">4 BHK</option>
                <option value="5">5+ BHK</option>
              </select>

              <select
                value={unitStatusFilter}
                onChange={(e) => setUnitStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="booked">Booked</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          </div>

          {/* Units Table */}
          {unitsLoading ? (
            <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200 dark:border-slate-700" />
          ) : units.length === 0 ? (
            <EmptyState
              icon={<Home className="w-10 h-10 text-slate-400" />}
              title="No units found"
              description="Add single units or bulk import units from a CSV file."
              actionLabel="Add Unit"
              onAction={() => setIsAddUnitOpen(true)}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Unit Number</th>
                    <th className="px-4 py-3">Tower / Floor</th>
                    <th className="px-4 py-3">Configuration</th>
                    <th className="px-4 py-3">Area (Sq.Ft)</th>
                    <th className="px-4 py-3">Facing / Furnish</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {unit.unitNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        {unit.tower || 'Tower Main'}{' '}
                        {unit.floor !== null && unit.floor !== undefined && (
                          <span className="text-xs text-slate-400">({unit.floor}th floor)</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-primary-subtle text-primary">
                          {unit.bhk} BHK
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>{unit.carpetAreaSqft} sq.ft carpet</div>
                        {unit.superAreaSqft && (
                          <div className="text-xs text-slate-400">
                            {unit.superAreaSqft} sq.ft super
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {unit.facing || 'East'} • {unit.furnishing || 'Unfurnished'}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {unit.price >= 10000000
                          ? `₹${(unit.price / 10000000).toFixed(2)} Cr`
                          : `₹${(unit.price / 100000).toFixed(2)} L`}
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={unit.status}
                          onChange={(e) => handleStatusChange(unit, e.target.value as UnitStatus)}
                          disabled={updateUnitStatusMutation.isPending}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border outline-none cursor-pointer ${
                            unit.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : unit.status === 'reserved'
                              ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                              : unit.status === 'booked'
                              ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <option value="available">Available</option>
                          <option value="reserved">Reserved</option>
                          <option value="booked">Booked</option>
                          <option value="sold">Sold</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Specifications & Locality Insights */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Overview / Description */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Project Overview
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {project.overview || 'No detailed overview provided yet.'}
              </p>
            </div>

            {/* USPs & Highlights */}
            {project.usps && project.usps.length > 0 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Unique Selling Propositions (USPs)
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.usps.map((usp, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold"
                    >
                      ★ {usp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {project.amenities && project.amenities.length > 0 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  World-Class Amenities
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {project.amenities.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Locality & Payment Plans */}
          <div className="space-y-6">
            {/* Locality Insights */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Locality Proximity
              </h3>
              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    <Train className="w-4 h-4 text-blue-500" />
                    Metro / Connectivity
                  </div>
                  <p className="text-slate-500 pl-6">
                    {project.localityInsights?.metro || 'Upcoming Metro station within 1.5 km'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    <GraduationCap className="w-4 h-4 text-purple-500" />
                    Top Schools
                  </div>
                  <p className="text-slate-500 pl-6">
                    {project.localityInsights?.schools || 'Delhi Public School, The Heritage (10 mins)'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
                    <Hospital className="w-4 h-4 text-rose-500" />
                    Healthcare & Hospitals
                  </div>
                  <p className="text-slate-500 pl-6">
                    {project.localityInsights?.hospitals || 'Max Multi-specialty Hospital (7 mins)'}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Plans & Offers */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                Payment Plans & Offers
              </h3>
              <div className="space-y-2 text-xs">
                {project.paymentPlans && project.paymentPlans.length > 0 ? (
                  project.paymentPlans.map((plan, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-300"
                    >
                      {plan}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">Construction linked payment plan (CLP) available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Loan EMI Calculator */}
      {activeTab === 'calculator' && (
        <div className="max-w-3xl mx-auto">
          <EmiCalculator
            initialPrice={project.pricingDetails?.startingPrice || 10000000}
          />
        </div>
      )}

      {/* Modals */}
      {id && (
        <>
          <CreateUnitModal
            projectId={id}
            isOpen={isAddUnitOpen}
            onClose={() => setIsAddUnitOpen(false)}
            onSuccess={() => refetchUnits()}
          />

          <BulkImportUnitsModal
            projectId={id}
            projectName={project.name}
            isOpen={isBulkImportOpen}
            onClose={() => setIsBulkImportOpen(false)}
            onSuccess={() => refetchUnits()}
          />
        </>
      )}
    </div>
  );
};
