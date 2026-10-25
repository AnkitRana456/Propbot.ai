import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { useCreateProject } from '../../services/inventory.service.js';
import { ProjectMediaFields, EMPTY_MEDIA, mediaToPayload, validateMedia, type ProjectMediaValue } from './ProjectMediaFields.js';
import type { ProjectStatus } from '@propbot/shared';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [reraNo, setReraNo] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('under_construction');
  const [possessionDate, setPossessionDate] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [overview, setOverview] = useState('');
  const [uspsText, setUspsText] = useState('Metro adjacent, Zero pre-EMI, High rental yield');
  const [amenitiesText, setAmenitiesText] = useState('Infinity Swimming Pool, Modern Clubhouse, Tennis Court, Landscaped Gardens, 24/7 Security');
  const [galleryText, setGalleryText] = useState('');
  const [media, setMedia] = useState<ProjectMediaValue>(EMPTY_MEDIA);

  const createProjectMutation = useCreateProject();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !builderName.trim() || !location.trim()) return;
    if (Object.keys(validateMedia(media)).length > 0) return; // errors are shown inline

    const usps = uspsText.split(',').map(s => s.trim()).filter(Boolean);
    const amenities = amenitiesText.split(',').map(s => s.trim()).filter(Boolean);
    const gallery = galleryText.split(',').map(s => s.trim()).filter(Boolean);
    const priceNum = startingPrice ? parseFloat(startingPrice) : undefined;

    await createProjectMutation.mutateAsync({
      name: name.trim(),
      builderName: builderName.trim(),
      reraNo: reraNo.trim() || undefined,
      location: location.trim(),
      status,
      possessionDate: possessionDate.trim() || undefined,
      overview: overview.trim() || undefined,
      usps,
      amenities,
      gallery,
      ...mediaToPayload(media),
      pricingDetails: {
        startingPrice: priceNum,
      },
    });

    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Add Residential Project
            </h3>
            <p className="text-xs text-slate-500">Register new development to active agency portfolio</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Project Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Skyline Residences"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Builder / Developer *</label>
              <input
                required
                type="text"
                placeholder="e.g. Aurora Developers"
                value={builderName}
                onChange={e => setBuilderName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Location / Locality *</label>
              <input
                required
                type="text"
                placeholder="e.g. Indiranagar, Bengaluru"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">RERA Registration No.</label>
              <input
                type="text"
                placeholder="e.g. PRM/KA/RERA/1251/..."
                value={reraNo}
                onChange={e => setReraNo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ProjectStatus)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              >
                <option value="under_construction">Under Construction</option>
                <option value="ready_to_move">Ready to Move</option>
                <option value="new_launch">New Launch</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Possession Date</label>
              <input
                type="text"
                placeholder="e.g. Dec 2026"
                value={possessionDate}
                onChange={e => setPossessionDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Starting Price (₹)</label>
              <input
                type="number"
                placeholder="e.g. 15000000"
                value={startingPrice}
                onChange={e => setStartingPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Overview / Marketing Summary</label>
            <textarea
              rows={2}
              value={overview}
              onChange={e => setOverview(e.target.value)}
              placeholder="High-end residential enclave featuring modern architecture and lake views..."
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Key USPs (Comma-separated)</label>
            <input
              type="text"
              value={uspsText}
              onChange={e => setUspsText(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amenities (Comma-separated)</label>
            <input
              type="text"
              value={amenitiesText}
              onChange={e => setAmenitiesText(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Gallery Image URLs (Comma-separated)</label>
            <input
              type="text"
              placeholder="https://images.unsplash.com/..., https://..."
              value={galleryText}
              onChange={e => setGalleryText(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-3 text-xs font-bold text-slate-900 dark:text-white">Chat media (optional)</p>
            <ProjectMediaFields value={media} onChange={setMedia} errors={validateMedia(media)} />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProjectMutation.isPending}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {createProjectMutation.isPending ? 'Saving...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
