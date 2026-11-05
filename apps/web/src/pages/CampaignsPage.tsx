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
  stats: { recipients: number; sent: number };
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
  const [reraProjectName, setReraProjectName] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [usps, setUsps] = useState('');
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
      const res = await apiRequest<SegmentItem[]>('/api/growth/segments');
      setSegments(res || []);
      if (res && res.length > 0 && res[0] && !selectedSegmentId) {
        setSelectedSegmentId(res[0].id);
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
      const res = await apiRequest<CampaignItem[]>('/api/growth/campaigns');
      setCampaigns(res || []);
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
      const created = await apiRequest<CampaignItem>('/api/growth/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName,
          channel: campaignChannel,
          segmentId: selectedSegmentId || undefined,
          variantA: { body: variantA },
          variantB: enableAbTesting && variantB ? { body: variantB } : undefined,
          aBTestEnabled: enableAbTesting,
        }),
      });

      // Launch immediately (sends actual emails/messages)
      await apiRequest<CampaignItem>(`/api/growth/campaigns/${created.id}/launch`, {
        method: 'POST',
      });

      setCampaigns((prev) => [{ ...created, status: 'completed' }, ...prev]);
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

  const totalReach = campaigns.reduce((sum, c) => sum + c.stats.recipients, 0);
  const totalSent = campaigns.reduce((sum, c) => sum + c.stats.sent, 0);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Top Header Bar — matches WorkflowsPage style */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-600 to-indigo-600 shadow-md">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-text tracking-tight">Campaigns & Growth</h1>
              <span className="rounded-full bg-pink-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-pink-700 dark:text-pink-300">
                Multi-Channel
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Dynamic Segments, Broadcasts & RERA-Compliant Marketing
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex rounded-xl border border-border bg-bg p-1 gap-0.5">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'campaigns'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>Broadcasts</span>
          </button>
          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'segments'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Segments</span>
          </button>
          <button
            onClick={() => setActiveTab('rera')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'rera'
                ? 'bg-teal-600 text-white shadow'
                : 'text-text-muted hover:text-text hover:bg-surface'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>RERA Assistant</span>
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 border-b border-border bg-surface/50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
            <Megaphone className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-text">{campaigns.length}</div>
            <div className="text-[11px] text-text-muted">Total Broadcasts</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15">
            <Users className="h-4 w-4 text-teal-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-text">{segments.length}</div>
            <div className="text-[11px] text-text-muted">Active Segments</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/15">
            <BarChart2 className="h-4 w-4 text-pink-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-text">{totalReach.toLocaleString()}</div>
            <div className="text-[11px] text-text-muted">Total Reach</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
            <Send className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-lg font-bold text-text">{totalSent.toLocaleString()}</div>
            <div className="text-[11px] text-text-muted">Messages Sent</div>
          </div>
        </div>
      </div>

      <div className="p-6">

      {/* Tab 1: Broadcast Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Launch Campaign Form */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6 backdrop-blur space-y-6">
            <div className="border-b border-border pb-4">
              <h2 className="text-base font-bold text-text">Create Multi-Channel Broadcast</h2>
              <p className="text-xs text-text-muted mt-1">
                Launch targeted outreach to saved segments across WhatsApp, SMS, or Email.
              </p>
            </div>

            <form onSubmit={handleLaunchCampaign} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-text/80 mb-1.5">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali Premium Villa Launch — Hot Leads"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder-text-faint focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text/80 mb-1.5">Target Channel</label>
                  <select
                    value={campaignChannel}
                    onChange={(e) => setCampaignChannel(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text"
                  >
                    <option value="whatsapp">WhatsApp (High Engagement)</option>
                    <option value="sms">SMS (Universal Fallback)</option>
                    <option value="email">Email (Rich Media & Brochures)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text/80 mb-1.5">Audience Segment</label>
                  <select
                    value={selectedSegmentId}
                    onChange={(e) => setSelectedSegmentId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text"
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
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Frequency Cap Active (Anti-Spam):</strong> Leads contacted within the last 7 days or leads who have opted out will be automatically excluded from this broadcast.
                </div>
              </div>

              {/* A/B Testing Toggle */}
              <div className="rounded-xl border border-border bg-bg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-text">A/B Message Split Testing</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableAbTesting}
                      onChange={(e) => setEnableAbTesting(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text/80 mb-1">
                    Variant A (Primary Copy):
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Hello {{name}}, explore our newly launched 3BHK residences..."
                    value={variantA}
                    onChange={(e) => setVariantA(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface-2 p-3 text-sm text-text placeholder-text-faint focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {enableAbTesting && (
                  <>
                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>Traffic Split Ratio:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
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
                      <label className="block text-xs font-medium text-text/80 mb-1">
                        Variant B (Challenger Copy):
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Hi {{name}}, VIP preview pricing ends this Sunday for our luxury homes..."
                        value={variantB}
                        onChange={(e) => setVariantB(e.target.value)}
                        className="w-full rounded-xl border border-border bg-surface-2 p-3 text-sm text-text placeholder-text-faint focus:border-indigo-500 focus:outline-none"
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
          <div className="rounded-2xl border border-border bg-surface p-6 backdrop-blur flex flex-col">
            <h3 className="text-base font-bold text-text mb-4 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Past Broadcasts ({campaigns.length})
            </h3>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-12 text-text-muted text-xs">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Loading history...</span>
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-12">No broadcasts launched yet.</p>
              ) : (
                campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border bg-surface-2 p-4 space-y-2 hover:border-border transition"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-text text-xs">{c.name}</h4>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                        {c.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span className="capitalize">{c.channel}</span>
                      <span>
                        Sent: <strong className="text-text">{c.stats.sent}</strong> / {c.stats.recipients}
                      </span>
                    </div>

                    <div className="text-[10px] text-text-muted">
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
          <div className="lg:col-span-1 rounded-2xl border border-border bg-surface p-6 backdrop-blur space-y-5">
            <div>
              <h2 className="text-base font-bold text-text">New Dynamic Segment</h2>
              <p className="text-xs text-text-muted mt-1">
                Filter leads by real-time behavioral and demographic criteria.
              </p>
            </div>

            <form onSubmit={handleCreateSegment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">Segment Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hot High-Budget Buyers"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional details"
                  value={newSegmentDesc}
                  onChange={(e) => setNewSegmentDesc(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-text/80 mb-1">Min Score</label>
                  <input
                    type="number"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text/80 mb-1">Max Score</label>
                  <input
                    type="number"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">Lead Stage</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
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
                <label className="block text-xs font-medium text-text/80 mb-1">Preferred Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                >
                  <option value="">Any Channel</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="web">Web Chat</option>
                  <option value="portal">Portals (99acres/MagicBricks)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">City</label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                />
              </div>

              {/* Live Preview Button & Count */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePreviewCount}
                  disabled={loadingPreview}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition"
                >
                  {loadingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>Live Preview</span>
                </button>

                {previewCount !== null && (
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
          <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6 backdrop-blur">
            <h3 className="text-base font-bold text-text mb-4 flex items-center gap-2">
              Saved Segments ({segments.length})
              {loadingSegments && <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {segments.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-surface-2 p-4 space-y-3 hover:border-border transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-text text-sm">{s.name}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{s.description || 'Dynamic filter criteria'}</p>
                    </div>
                    <span className="rounded-lg bg-indigo-500/20 px-2 py-1 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {s.cachedCount} leads
                    </span>
                  </div>

                  <div className="rounded bg-bg p-2 text-[11px] font-mono text-text-muted">
                    {JSON.stringify(s.filterCriteria)}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setSelectedSegmentId(s.id);
                        setActiveTab('campaigns');
                      }}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-300"
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
          <div className="rounded-2xl border border-border bg-surface p-6 backdrop-blur space-y-5">
            <div className="border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-text">RERA-Compliant Marketing Generator</h2>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Automated legal compliance: mandatory project RERA embedding and strict blocking of speculative ROI claims.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">Project Name</label>
                <input
                  type="text"
                  value={reraProjectName}
                  onChange={(e) => setReraProjectName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">
                  Mandatory Project RERA Registration Number
                </label>
                <input
                  type="text"
                  value={reraNumber}
                  onChange={(e) => setReraNumber(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-mono text-emerald-700 dark:text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">Target Audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">Key Selling Points</label>
                <textarea
                  rows={2}
                  value={usps}
                  onChange={(e) => setUsps(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-text"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">
                  Draft Headline (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g.: Luxury 3BHK Residences near Hebbal"
                  value={draftHeadline}
                  onChange={(e) => setDraftHeadline(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text placeholder-text-faint mb-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text/80 mb-1">
                  Draft Body to Inspect (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Test speculative claim detector, e.g.: 'Invest now for guaranteed 18% ROI and assured rental income!'"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 p-2.5 text-xs text-text placeholder-text-faint"
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
          <div className="rounded-2xl border border-border bg-surface p-6 backdrop-blur space-y-5">
            <h3 className="text-base font-bold text-text">Compliance Review & Preview</h3>

            {complianceResult ? (
              <div className="space-y-4">
                {/* Status Alert Banner */}
                {complianceResult.isCompliant ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        100% RERA Compliant
                      </div>
                      <div className="text-xs text-emerald-800 dark:text-emerald-200 mt-1">
                        Mandatory RERA registration embedded. Zero prohibited speculative return guarantees detected.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                        Compliance Violations Detected (Blocked)
                      </div>
                      <ul className="mt-2 list-disc list-inside text-xs text-rose-800 dark:text-rose-200 space-y-1">
                        {complianceResult.violations?.map((v: string, i: number) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Generated Content Box */}
                {complianceResult.generatedCopy && (
                  <div className="rounded-xl border border-border bg-bg p-4 space-y-3">
                    <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                      {complianceResult.generatedCopy.headline}
                    </div>

                    <p className="text-xs text-text/80 leading-relaxed whitespace-pre-wrap">
                      {complianceResult.generatedCopy.body}
                    </p>

                    <div className="border-t border-border pt-3 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                      RERA Reg: {complianceResult.generatedCopy.reraNumber}
                    </div>

                    <div className="text-[10px] text-text-muted italic">
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
              <div className="flex flex-col items-center justify-center h-64 text-text-muted text-xs text-center p-6">
                <ShieldCheck className="h-10 w-10 text-text-faint mb-2" />
                <span>Fill in project details and click Generate to run RERA compliance verification.</span>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
