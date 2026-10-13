import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Users,
  Sparkles,
  ShieldCheck,
  Send,
  AlertTriangle,
  CheckCircle,
  Loader2,
  BarChart2,
  Eye,
} from 'lucide-react';
import { apiRequest } from '../services/api-client.js';

interface ReraComplianceResult {
  isCompliant: boolean;
  violations?: string[];
  generatedCopy?: {
    headline?: string;
    body: string;
    callToAction?: string;
    reraNumber?: string;
    disclaimer?: string;
  };
}

interface SegmentItem {
  id: string;
  name: string;
  description?: string;
  filterCriteria: Record<string, unknown>;
  cachedCount: number;
  lastCalculatedAt: string;
}

interface CampaignItem {
  id: string;
  name: string;
  channel: string;
  status: string;
  totalRecipients: number;
  successfulSends: number;
  failedSends: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

export const CampaignsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'segments' | 'campaigns' | 'rera'>('campaigns');

  // Segments State
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDesc, setNewSegmentDesc] = useState('');
  const [minScore, setMinScore] = useState<number | ''>(50);
  const [maxScore, setMaxScore] = useState<number | ''>('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Campaigns State
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignChannel, setCampaignChannel] = useState('whatsapp');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [enableAbTesting, setEnableAbTesting] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

  // RERA Assistant State
  const [reraProjectName, setReraProjectName] = useState('Prestige Falcon City');
  const [reraNumber, setReraNumber] = useState('PRM/KA/RERA/1251/310/PR/170915/000123');
  const [targetAudience, setTargetAudience] = useState('High-net-worth homebuyers seeking luxury 3BHKs');
  const [usps, setUsps] = useState('Metro adjacency, 80% open greens, ready-to-move-in luxury clubhouse');
  const [draftHeadline, setDraftHeadline] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [complianceResult, setComplianceResult] = useState<ReraComplianceResult | null>(null);
  const [generatingRera, setGeneratingRera] = useState(false);

  useEffect(() => {
    loadSegments();
    loadCampaigns();
  }, []);

  const loadSegments = async () => {
    try {
      setLoadingSegments(true);
      const res = await apiRequest<{ segments: SegmentItem[] }>('/api/growth/segments');
      setSegments(res.segments || []);
      if (res.segments && res.segments.length > 0 && res.segments[0] && !selectedSegmentId) {
        setSelectedSegmentId(res.segments[0].id);
      }
    } catch (err) {
      console.error('Failed to load segments', err);
    } finally {
      setLoadingSegments(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      const res = await apiRequest<{ campaigns: CampaignItem[] }>('/api/growth/campaigns');
      setCampaigns(res.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handlePreviewCount = async () => {
    try {
      setLoadingPreview(true);
      const criteria: Record<string, unknown> = {};
      if (minScore !== '') criteria.minScore = Number(minScore);
      if (maxScore !== '') criteria.maxScore = Number(maxScore);
      if (selectedStage) criteria.stage = selectedStage;
      if (selectedChannel) criteria.channels = [selectedChannel];
      if (selectedCity) criteria.city = selectedCity;

      const res = await apiRequest<{ matchingCount: number }>('/api/growth/segments/preview-count', {
        method: 'POST',
        body: JSON.stringify({ filterCriteria: criteria }),
      });
      setPreviewCount(res.matchingCount);
    } catch (err) {
      console.error('Failed to preview count', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegmentName.trim()) return;
    try {
      const criteria: Record<string, unknown> = {};
      if (minScore !== '') criteria.minScore = Number(minScore);
      if (maxScore !== '') criteria.maxScore = Number(maxScore);
      if (selectedStage) criteria.stage = selectedStage;
      if (selectedChannel) criteria.channels = [selectedChannel];
      if (selectedCity) criteria.city = selectedCity;

      const created = await apiRequest<SegmentItem>('/api/growth/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: newSegmentName,
          description: newSegmentDesc,
          filterCriteria: criteria,
        }),
      });

      setSegments((prev) => [created, ...prev]);
      setNewSegmentName('');
      setNewSegmentDesc('');
      setPreviewCount(null);
    } catch (err) {
      console.error('Failed to create segment', err);
    }
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !selectedSegmentId || !variantA.trim()) return;

    try {
      setLaunchingCampaign(true);
      const messageConfig = enableAbTesting
        ? {
            abEnabled: true,
            splitPercentage: splitRatio,
            variantA: { text: variantA },
            variantB: { text: variantB || variantA },
          }
        : {
            text: variantA,
          };

      const res = await apiRequest<CampaignItem>('/api/growth/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          channel: campaignChannel,
          segmentId: selectedSegmentId,
          messageConfig,
        }),
      });

      setCampaigns((prev) => [res, ...prev]);
      setCampaignName('');
      setVariantA('');
      setVariantB('');
      alert('Campaign launched successfully! Sent recipients logged.');
    } catch (err: unknown) {
      alert(`Launch error: ${(err as Error).message || 'Failed to launch'}`);
    } finally {
      setLaunchingCampaign(false);
    }
  };

  const handleGenerateReraCopy = async () => {
    try {
      setGeneratingRera(true);
      setComplianceResult(null);

      const res = await apiRequest<ReraComplianceResult>('/api/growth/rera-copy/generate', {
        method: 'POST',
        body: JSON.stringify({
          projectName: reraProjectName,
          reraNumber,
          targetAudience,
          keyUsps: usps,
          userDraftHeadline: draftHeadline || undefined,
          userDraftBody: draftBody || undefined,
        }),
      });

      setComplianceResult(res);
    } catch (err: unknown) {
      setComplianceResult({
        isCompliant: false,
        violations: [(err as Error).message || 'Generation error'],
      });
    } finally {
      setGeneratingRera(false);
    }
  };

  const handleApplyReraToCampaign = () => {
    if (complianceResult?.generatedCopy?.body) {
      setVariantA(complianceResult.generatedCopy.body);
      setActiveTab('campaigns');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      {/* Top Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-600 to-indigo-600 shadow-lg shadow-pink-500/20">
              <Megaphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Campaigns & Growth</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Dynamic Segments, Multi-Channel Broadcasts & RERA-Compliant Marketing
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 backdrop-blur">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'campaigns'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Megaphone className="h-4 w-4" />
            <span>Broadcasts</span>
          </button>
          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'segments'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Dynamic Segments</span>
          </button>
          <button
            onClick={() => setActiveTab('rera')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'rera'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span>RERA Copy Assistant</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Broadcast Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Launch Campaign Form */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">Create Multi-Channel Broadcast</h2>
              <p className="text-xs text-slate-400 mt-1">
                Launch targeted outreach to saved segments across WhatsApp, SMS, or Email.
              </p>
            </div>

            <form onSubmit={handleLaunchCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Premium Villa Launch — Hot Leads"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Channel</label>
                  <select
                    value={campaignChannel}
                    onChange={(e) => setCampaignChannel(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-slate-100"
                  >
                    <option value="whatsapp">WhatsApp (High Engagement)</option>
                    <option value="sms">SMS (Universal Fallback)</option>
                    <option value="email">Email (Rich Media & Brochures)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Audience Segment</label>
                  <select
                    value={selectedSegmentId}
                    onChange={(e) => setSelectedSegmentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-slate-100"
                  >
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.cachedCount} leads)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Guardrail Callout */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong>Frequency Cap Active (Anti-Spam):</strong> Leads contacted within the last 7 days or leads who have opted out will be automatically excluded from this broadcast.
                </div>
              </div>

              {/* A/B Testing Toggle */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold text-slate-200">A/B Message Split Testing</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableAbTesting}
                      onChange={(e) => setEnableAbTesting(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Variant A (Primary Copy):
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Hello {{name}}, explore our newly launched 3BHK residences..."
                    value={variantA}
                    onChange={(e) => setVariantA(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {enableAbTesting && (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Traffic Split Ratio:</span>
                      <span className="font-bold text-indigo-400">
                        {splitRatio}% A / {100 - splitRatio}% B
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={splitRatio}
                      onChange={(e) => setSplitRatio(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Variant B (Challenger Copy):
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Hi {{name}}, VIP preview pricing ends this Sunday for our luxury homes..."
                        value={variantB}
                        onChange={(e) => setVariantB(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/90 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={launchingCampaign || !campaignName.trim() || !variantA.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 py-3 text-sm font-bold text-white shadow-lg hover:from-indigo-500 hover:to-pink-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {launchingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>Launch Broadcast Now</span>
              </button>
            </form>
          </div>

          {/* Right Column: Campaign History */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur flex flex-col">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-indigo-400" />
              Past Broadcasts ({campaigns.length})
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-xs">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Loading history...</span>
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-12">No broadcasts launched yet.</p>
              ) : (
                campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-slate-100 text-xs">{c.name}</h4>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                        {c.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{c.channel}</span>
                      <span>
                        Sent: <strong className="text-slate-200">{c.successfulSends}</strong> / {c.totalRecipients}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dynamic Segments */}
      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Segment Builder */}
          <div className="lg:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur space-y-5">
            <div>
              <h2 className="text-base font-bold text-white">New Dynamic Segment</h2>
              <p className="text-xs text-slate-400 mt-1">
                Filter leads by real-time behavioral and demographic criteria.
              </p>
            </div>

            <form onSubmit={handleCreateSegment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Segment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hot High-Budget Buyers"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional details"
                  value={newSegmentDesc}
                  onChange={(e) => setNewSegmentDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Min Score</label>
                  <input
                    type="number"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Max Score</label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lead Stage</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="">Any Stage</option>
                  <option value="inquiry">Inquiry</option>
                  <option value="qualified">Qualified</option>
                  <option value="viewing_scheduled">Viewing Scheduled</option>
                  <option value="viewing_completed">Viewing Completed</option>
                  <option value="booked">Booked</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Preferred Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                >
                  <option value="">Any Channel</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="web">Web Chat</option>
                  <option value="portal">Portals (99acres/MagicBricks)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                />
              </div>

              {/* Live Preview Button & Count */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePreviewCount}
                  disabled={loadingPreview}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
                >
                  {loadingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>Live Preview</span>
                </button>

                {previewCount !== null && (
                  <div className="text-xs font-bold text-emerald-400">
                    Matches: {previewCount} leads
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-500 transition mt-2"
              >
                Save Segment
              </button>
            </form>
          </div>

          {/* Saved Segments List */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              Saved Segments ({segments.length})
              {loadingSegments && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {segments.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-800 bg-slate-800/60 p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm">{s.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{s.description || 'Dynamic filter criteria'}</p>
                    </div>
                    <span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs font-mono font-bold text-indigo-300">
                      {s.cachedCount} leads
                    </span>
                  </div>

                  <div className="rounded bg-slate-950/60 p-2 text-[11px] font-mono text-slate-400">
                    {JSON.stringify(s.filterCriteria)}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedSegmentId(s.id);
                        setActiveTab('campaigns');
                      }}
                      className="text-xs font-semibold text-teal-400 hover:text-teal-300"
                    >
                      Use in Broadcast &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: RERA Copy Assistant */}
      {activeTab === 'rera' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Input Form */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">RERA-Compliant Marketing Generator</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automated legal compliance: mandatory project RERA embedding and strict blocking of speculative ROI claims.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  value={reraProjectName}
                  onChange={(e) => setReraProjectName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Mandatory Project RERA Registration Number
                </label>
                <input
                  type="text"
                  value={reraNumber}
                  onChange={(e) => setReraNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-mono text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Key Selling Points</label>
                <textarea
                  rows={2}
                  value={usps}
                  onChange={(e) => setUsps(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 p-2.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Draft Headline (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g.: Luxury 3BHK Residences near Hebbal"
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 mb-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Draft Body to Inspect (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Test speculative claim detector, e.g.: 'Invest now for guaranteed 18% ROI and assured rental income!'"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 p-2.5 text-xs text-slate-100 placeholder-slate-500"
                />
              </div>

              <button
                onClick={handleGenerateReraCopy}
                disabled={generatingRera || !reraNumber.trim()}
                className="w-full rounded-xl bg-teal-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-teal-500 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generatingRera ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span>Generate & Validate RERA Copy</span>
              </button>
            </div>
          </div>

          {/* Right Column: Compliance Review & Generated Output */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur space-y-5">
            <h3 className="text-base font-bold text-white">Compliance Review & Preview</h3>

            {complianceResult ? (
              <div className="space-y-4">
                {/* Status Alert Banner */}
                {complianceResult.isCompliant ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-emerald-300">
                        100% RERA Compliant
                      </div>
                      <div className="text-xs text-emerald-200 mt-1">
                        Mandatory RERA registration embedded. Zero prohibited speculative return guarantees detected.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-rose-300">
                        Compliance Violations Detected (Blocked)
                      </div>
                      <ul className="mt-2 list-disc list-inside text-xs text-rose-200 space-y-1">
                        {complianceResult.violations?.map((v: string, i: number) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Generated Content Box */}
                {complianceResult.generatedCopy && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="text-sm font-bold text-indigo-300">
                      {complianceResult.generatedCopy.headline}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {complianceResult.generatedCopy.body}
                    </p>

                    <div className="border-t border-slate-800 pt-3 text-[11px] font-mono text-emerald-400">
                      RERA Reg: {complianceResult.generatedCopy.reraNumber}
                    </div>

                    <div className="text-[10px] text-slate-500 italic">
                      {complianceResult.generatedCopy.disclaimer}
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleApplyReraToCampaign}
                        className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
                      >
                        Copy to Broadcast Campaign &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs text-center p-6">
                <ShieldCheck className="h-10 w-10 text-slate-700 mb-2" />
                <span>Fill in project details and click Generate to run RERA compliance verification.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
