import React, { useState } from 'react';
import { X, Building2, MapPin, IndianRupee, Tag, Sparkles, Image, ChevronRight, ChevronLeft } from 'lucide-react';
import { useCreateProject } from '../../services/inventory.service.js';
import { ProjectMediaFields, EMPTY_MEDIA, mediaToPayload, validateMedia, type ProjectMediaValue } from './ProjectMediaFields.js';
import type { ProjectStatus } from '@propbot/shared';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');
  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setInput('');
  };
  return (
    <div className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 min-h-[42px] flex flex-wrap gap-1.5">
      {value.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-blue-400 hover:text-red-500 transition-colors leading-none">×</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-xs text-slate-700 dark:text-white placeholder:text-slate-400 outline-none"
      />
    </div>
  );
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string; color: string }[] = [
  { value: 'new_launch', label: 'New Launch', color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700' },
  { value: 'under_construction', label: 'Under Construction', color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700' },
  { value: 'ready_to_move', label: 'Ready to Move', color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700' },
  { value: 'completed', label: 'Completed', color: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600' },
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'basic' | 'media'>('basic');
  const [name, setName] = useState('');
  const [builderName, setBuilderName] = useState('');
  const [reraNo, setReraNo] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('under_construction');
  const [possessionDate, setPossessionDate] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [overview, setOverview] = useState('');
  const [usps, setUsps] = useState<string[]>(['Metro adjacent', 'Zero pre-EMI', 'High rental yield']);
  const [amenities, setAmenities] = useState<string[]>(['Swimming Pool', 'Clubhouse', 'Tennis Court', 'Landscaped Gardens']);
  const [gallery, setGallery] = useState('');
  const [media, setMedia] = useState<ProjectMediaValue>(EMPTY_MEDIA);

  const createProjectMutation = useCreateProject();

  if (!isOpen) return null;

  const canNext = name.trim() && builderName.trim() && location.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canNext) return;
    if (Object.keys(validateMedia(media)).length > 0) return;
    const galleryUrls = gallery.split('\n').map(s => s.trim()).filter(Boolean);
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
      gallery: galleryUrls,
      ...mediaToPayload(media),
      pricingDetails: { startingPrice: startingPrice ? parseFloat(startingPrice) : undefined },
    });
    onClose();
    onSuccess?.();
  };

  const inputCls = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors';
  const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add New Project</h3>
              <p className="text-xs text-slate-500">Register property to your agency portfolio</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 shrink-0">
          {[
            { key: 'basic', label: 'Basic Info', icon: MapPin },
            { key: 'media', label: 'Media & Details', icon: Image },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as 'basic' | 'media')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {tab === 'basic' && (
              <div className="space-y-4">
                {/* Project + Builder */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Project Name *</label>
                    <input required type="text" placeholder="e.g. Skyline Residences" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Builder / Developer *</label>
                    <input required type="text" placeholder="e.g. Aurora Developers" value={builderName} onChange={e => setBuilderName(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Location + RERA */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Location *</label>
                    <input required type="text" placeholder="e.g. Indiranagar, Bengaluru" value={location} onChange={e => setLocation(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>RERA No.</label>
                    <input type="text" placeholder="e.g. PRM/KA/RERA/1251/..." value={reraNo} onChange={e => setReraNo(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Status pills */}
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${status === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-blue-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Possession + Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Possession Date</label>
                    <input type="text" placeholder="e.g. Dec 2026" value={possessionDate} onChange={e => setPossessionDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Starting Price (₹)</label>
                    <div className="relative mt-1">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input type="number" placeholder="e.g. 15000000" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 focus:outline-none transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Overview */}
                <div>
                  <label className={labelCls}>Overview / Marketing Summary</label>
                  <textarea rows={3} value={overview} onChange={e => setOverview(e.target.value)} placeholder="High-end residential enclave featuring modern architecture and lake views..." className={inputCls + ' resize-none'} />
                </div>

                {/* USPs */}
                <div>
                  <label className={labelCls + ' flex items-center gap-1'}>
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Key USPs
                    <span className="ml-1 text-slate-400 normal-case font-normal">(Enter karo ya comma lagao)</span>
                  </label>
                  <TagInput value={usps} onChange={setUsps} placeholder="Metro adjacent, Zero pre-EMI..." />
                </div>

                {/* Amenities */}
                <div>
                  <label className={labelCls + ' flex items-center gap-1'}>
                    <Tag className="h-3 w-3 text-green-500" />
                    Amenities
                    <span className="ml-1 text-slate-400 normal-case font-normal">(Enter karo ya comma lagao)</span>
                  </label>
                  <TagInput value={amenities} onChange={setAmenities} placeholder="Swimming Pool, Clubhouse..." />
                </div>
              </div>
            )}

            {tab === 'media' && (
              <div className="space-y-5">
                {/* Gallery */}
                <div>
                  <label className={labelCls}>Gallery Image URLs</label>
                  <p className="text-xs text-slate-400 mb-1">Ek URL per line daalo</p>
                  <textarea
                    rows={4}
                    value={gallery}
                    onChange={e => setGallery(e.target.value)}
                    placeholder={"https://images.unsplash.com/photo-1...\nhttps://images.unsplash.com/photo-2..."}
                    className={inputCls + ' resize-none font-mono'}
                  />
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                  <ProjectMediaFields value={media} onChange={setMedia} errors={validateMedia(media)} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900 rounded-b-2xl">
            {tab === 'basic' ? (
              <>
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setTab('media')}
                  disabled={!canNext}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  Next: Media
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setTab('basic')} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending || !canNext}
                  className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {createProjectMutation.isPending ? 'Saving...' : 'Create Project ✓'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
