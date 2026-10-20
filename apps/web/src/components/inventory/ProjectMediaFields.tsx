import React from 'react';
import { Plus, Trash2, ImageOff } from 'lucide-react';

/** Editable "chat media" of a project: what the chatbot shows for first message / plans / map. */
export interface FloorPlanRow {
  title: string;
  bhk: string;
  carpetAreaSqft: string;
  planUrl: string;
}

export interface ProjectMediaValue {
  /** One URL per line (commas also accepted). */
  highlightPhotos: string;
  masterPlanUrl: string;
  mapUrl: string;
  latitude: string;
  longitude: string;
  floorPlans: FloorPlanRow[];
}

export const EMPTY_MEDIA: ProjectMediaValue = {
  highlightPhotos: '',
  masterPlanUrl: '',
  mapUrl: '',
  latitude: '',
  longitude: '',
  floorPlans: [],
};

interface ProjectLike {
  highlightPhotos?: string[];
  masterPlanUrl?: string | null;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  floorPlans?: Array<{ title: string; bhk: number; carpetAreaSqft: number; planUrl: string }>;
}

export function mediaFromProject(p: ProjectLike | undefined): ProjectMediaValue {
  if (!p) return EMPTY_MEDIA;
  return {
    highlightPhotos: (p.highlightPhotos ?? []).join('\n'),
    masterPlanUrl: p.masterPlanUrl ?? '',
    mapUrl: p.mapUrl ?? '',
    latitude: p.latitude != null ? String(p.latitude) : '',
    longitude: p.longitude != null ? String(p.longitude) : '',
    floorPlans: (p.floorPlans ?? []).map(f => ({
      title: f.title,
      bhk: String(f.bhk),
      carpetAreaSqft: String(f.carpetAreaSqft),
      planUrl: f.planUrl,
    })),
  };
}

const HTTPS = /^https:\/\/\S+$/i;
const splitUrls = (s: string) => s.split(/[\n,]+/).map(x => x.trim()).filter(Boolean);

export interface MediaErrors {
  highlightPhotos?: string;
  masterPlanUrl?: string;
  mapUrl?: string;
  coordinates?: string;
  floorPlans?: string;
}

/** Client-side checks mirroring what the chat will actually display (https images only, valid coordinates). */
export function validateMedia(v: ProjectMediaValue): MediaErrors {
  const errors: MediaErrors = {};
  const photos = splitUrls(v.highlightPhotos);
  if (photos.length > 10) errors.highlightPhotos = 'Use at most 10 highlight photos.';
  else if (photos.some(u => !HTTPS.test(u))) errors.highlightPhotos = 'Every photo URL must start with https://';
  if (v.masterPlanUrl.trim() && !HTTPS.test(v.masterPlanUrl.trim())) errors.masterPlanUrl = 'Master plan URL must start with https://';
  if (v.mapUrl.trim() && !/^https:\/\/www\.google\.com\/maps\/embed\?\S+$/i.test(v.mapUrl.trim())) {
    errors.mapUrl = 'Use a Google Maps "Embed a map" URL (https://www.google.com/maps/embed?...) or leave empty and set coordinates.';
  }
  const lat = v.latitude.trim();
  const lng = v.longitude.trim();
  if (lat || lng) {
    const la = Number(lat);
    const lo = Number(lng);
    if (!lat || !lng || !Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      errors.coordinates = 'Enter both latitude (-90 to 90) and longitude (-180 to 180).';
    }
  }
  for (const row of v.floorPlans) {
    if (!row.title.trim() || !(Number(row.bhk) >= 1) || !(Number(row.carpetAreaSqft) > 0) || !HTTPS.test(row.planUrl.trim())) {
      errors.floorPlans = 'Each floor plan needs a title, BHK (1+), carpet area (sq ft) and an https:// image URL.';
      break;
    }
  }
  return errors;
}

/** API payload; empty fields clear the value. */
export function mediaToPayload(v: ProjectMediaValue) {
  const hasCoords = v.latitude.trim() && v.longitude.trim();
  return {
    highlightPhotos: splitUrls(v.highlightPhotos),
    masterPlanUrl: v.masterPlanUrl.trim() || null,
    mapUrl: v.mapUrl.trim() || undefined,
    latitude: hasCoords ? Number(v.latitude) : undefined,
    longitude: hasCoords ? Number(v.longitude) : undefined,
    floorPlans: v.floorPlans.map(r => ({
      title: r.title.trim(),
      bhk: Math.round(Number(r.bhk)),
      carpetAreaSqft: Number(r.carpetAreaSqft),
      planUrl: r.planUrl.trim(),
    })),
  };
}

const inputCls =
  'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-white';
const labelCls = 'text-xs font-semibold text-slate-700 dark:text-slate-300';
const errCls = 'mt-1 text-[11px] text-rose-600';
const hintCls = 'mt-1 text-[11px] text-slate-500';

const Thumb: React.FC<{ url: string }> = ({ url }) =>
  HTTPS.test(url) ? (
    <img src={url} alt="" className="h-12 w-16 rounded-md object-cover border border-slate-200 dark:border-slate-700" loading="lazy" />
  ) : (
    <div className="flex h-12 w-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400">
      <ImageOff className="h-4 w-4" />
    </div>
  );

interface Props {
  value: ProjectMediaValue;
  onChange: (next: ProjectMediaValue) => void;
  errors?: MediaErrors;
}

export const ProjectMediaFields: React.FC<Props> = ({ value, onChange, errors = {} }) => {
  const set = <K extends keyof ProjectMediaValue>(key: K, v: ProjectMediaValue[K]) => onChange({ ...value, [key]: v });
  const photos = splitUrls(value.highlightPhotos);

  const updateRow = (i: number, patch: Partial<FloorPlanRow>) =>
    set('floorPlans', value.floorPlans.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Highlight photos (shown on the visitor&apos;s first chat message)</label>
        <textarea
          rows={3}
          placeholder={'https://cdn.example.com/hero-1.jpg\nhttps://cdn.example.com/clubhouse.jpg'}
          value={value.highlightPhotos}
          onChange={e => set('highlightPhotos', e.target.value)}
          className={inputCls}
        />
        {errors.highlightPhotos ? (
          <p className={errCls}>{errors.highlightPhotos}</p>
        ) : (
          <p className={hintCls}>One https:// URL per line, up to 10. If empty, the first gallery images are used.</p>
        )}
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.slice(0, 10).map(u => (
              <Thumb key={u} url={u} />
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Master plan image URL (chat: &quot;master plan&quot;, &quot;site plan&quot;, &quot;project layout&quot;)</label>
        <div className="flex items-start gap-2">
          <input
            type="url"
            placeholder="https://cdn.example.com/master-plan.png"
            value={value.masterPlanUrl}
            onChange={e => set('masterPlanUrl', e.target.value)}
            className={inputCls}
          />
          {value.masterPlanUrl.trim() && <div className="mt-1"><Thumb url={value.masterPlanUrl.trim()} /></div>}
        </div>
        {errors.masterPlanUrl && <p className={errCls}>{errors.masterPlanUrl}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>Floor plans (chat: &quot;2bhk&quot;, &quot;carpet area&quot;, &quot;floor plan&quot;, &quot;layout&quot;)</label>
          <button
            type="button"
            onClick={() => set('floorPlans', [...value.floorPlans, { title: '', bhk: '2', carpetAreaSqft: '', planUrl: '' }])}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="h-3 w-3" /> Add plan
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {value.floorPlans.map((row, i) => (
            <div key={i} className="grid grid-cols-12 items-start gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
              <input className={`${inputCls} col-span-4 mt-0`} placeholder="Title (e.g. 2BHK Type A)" value={row.title} onChange={e => updateRow(i, { title: e.target.value })} />
              <input className={`${inputCls} col-span-2 mt-0`} type="number" min={1} placeholder="BHK" value={row.bhk} onChange={e => updateRow(i, { bhk: e.target.value })} />
              <input className={`${inputCls} col-span-2 mt-0`} type="number" min={1} placeholder="Carpet sq ft" value={row.carpetAreaSqft} onChange={e => updateRow(i, { carpetAreaSqft: e.target.value })} />
              <input className={`${inputCls} col-span-3 mt-0`} placeholder="https://… image" value={row.planUrl} onChange={e => updateRow(i, { planUrl: e.target.value })} />
              <button
                type="button"
                aria-label="Remove floor plan"
                onClick={() => set('floorPlans', value.floorPlans.filter((_, idx) => idx !== i))}
                className="col-span-1 mt-1 flex justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {value.floorPlans.length === 0 && <p className={hintCls}>No floor plans yet. Add one per configuration.</p>}
        </div>
        {errors.floorPlans && <p className={errCls}>{errors.floorPlans}</p>}
      </div>

      <div>
        <label className={labelCls}>Location map (chat: &quot;location&quot;, &quot;directions&quot;, &quot;where&quot;, &quot;how to reach&quot;)</label>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} type="number" step="any" placeholder="Latitude e.g. 12.9716" value={value.latitude} onChange={e => set('latitude', e.target.value)} />
          <input className={inputCls} type="number" step="any" placeholder="Longitude e.g. 77.5946" value={value.longitude} onChange={e => set('longitude', e.target.value)} />
        </div>
        {errors.coordinates && <p className={errCls}>{errors.coordinates}</p>}
        <input
          className={inputCls}
          placeholder="Or paste a Google Maps embed URL (https://www.google.com/maps/embed?...)"
          value={value.mapUrl}
          onChange={e => set('mapUrl', e.target.value)}
        />
        {errors.mapUrl ? <p className={errCls}>{errors.mapUrl}</p> : <p className={hintCls}>An embed URL wins over coordinates. Only Google Maps embeds are shown in chat.</p>}
      </div>
    </div>
  );
};
