import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Sparkles,
  PhoneCall,
  CalendarCheck,
  Share2,
  CheckCircle2,
  Scale,
  Calculator,
  Clock,
} from 'lucide-react';
import {
  usePublicShortlistRoom,
  useTrackShortlistTelemetry,
} from '../services/shortlist.service.js';
import { EmiCalculator } from '../components/inventory/EmiCalculator.js';

export const ShortlistRoomPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [activeTab, setActiveTab] = useState<'cards' | 'compare' | 'emi'>('cards');
  const [selectedProjectForEmi, setSelectedProjectForEmi] = useState<{
    name: string;
    price: number;
  } | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [ctaModal, setCtaModal] = useState<{
    isOpen: boolean;
    type: 'visit' | 'callback';
    projectId?: string;
    projectName?: string;
  }>({ isOpen: false, type: 'visit' });
  const [ctaSubmitted, setCtaSubmitted] = useState(false);

  const { data: room, isLoading, isError } = usePublicShortlistRoom(token);
  const trackTelemetry = useTrackShortlistTelemetry();

  // Dwell time tracking
  const startTimeRef = useRef<number>(Date.now());
  const trackedDwellRef = useRef<number>(0);

  useEffect(() => {
    if (!token) return;

    // Track initial page view
    trackTelemetry.mutate({
      token,
      input: { event: 'view' },
    });

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const delta = elapsedSeconds - trackedDwellRef.current;
      if (delta >= 15) {
        trackedDwellRef.current = elapsedSeconds;
        trackTelemetry.mutate({
          token,
          input: {
            event: 'dwell',
            timeSpentSeconds: delta,
          },
        });
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      const totalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remainingDelta = totalElapsed - trackedDwellRef.current;
      if (remainingDelta > 2 && token) {
        trackTelemetry.mutate({
          token,
          input: {
            event: 'dwell',
            timeSpentSeconds: remainingDelta,
          },
        });
      }
    };
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium text-slate-300">Loading your personalized shortlist room...</p>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Building2 className="w-16 h-16 text-slate-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Shortlist Room Unavailable</h1>
        <p className="text-slate-400 max-w-md mb-6">
          This property shortlist room link is either invalid, expired, or has been removed by the advisor.
        </p>
      </div>
    );
  }

  if (room.isExpired) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Clock className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
        <p className="text-slate-400 max-w-md mb-6">
          This personalized property shortlist link for {room.leadFirstName} has expired on{' '}
          {new Date(room.expiresAt).toLocaleDateString()}. Please reach out to {room.agencyName} to receive a refreshed shortlist.
        </p>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
      if (token) {
        trackTelemetry.mutate({
          token,
          input: { event: 'share' },
        });
      }
    }
  };

  const handleCtaOpen = (type: 'visit' | 'callback', projectId?: string, projectName?: string) => {
    setCtaSubmitted(false);
    setCtaModal({ isOpen: true, type, projectId, projectName });
    if (token) {
      trackTelemetry.mutate({
        token,
        input: {
          event: type === 'visit' ? 'visit_request' : 'callback_request',
          projectId,
        },
      });
    }
  };

  const handleCtaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCtaSubmitted(true);
    setTimeout(() => {
      setCtaModal({ isOpen: false, type: 'visit' });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                {room.agencyName}
              </p>
              <h2 className="text-sm font-semibold text-white">Smart Shortlist Room</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5 text-primary" />
              {copiedShare ? 'Link Copied!' : 'Share Room'}
            </button>
            <button
              onClick={() => handleCtaOpen('callback')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-hover text-white transition-all shadow-md shadow-primary/20"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Request Callback
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        {/* Hero Personalized Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary-light text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Curated for {room.leadFirstName}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              {room.title || `Curated Property Shortlist for ${room.leadFirstName}`}
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Based on your preferences and requirements, we have curated these top{' '}
              <span className="font-semibold text-white">{room.items.length} hand-picked developments</span>.
              Explore unit specs, compare pricing, calculate EMIs, and book an exclusive guided site visit.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                Active until {new Date(room.expiresAt).toLocaleDateString()}
              </span>
              <span>•</span>
              <span>Verified RERA Developments</span>
              <span>•</span>
              <span>Direct Builder Pricing</span>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center gap-2 mt-8 pt-6 border-t border-slate-800/80">
            <button
              onClick={() => {
                setActiveTab('cards');
                if (token) trackTelemetry.mutate({ token, input: { event: 'focus_project' } });
              }}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'cards'
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Shortlisted Properties ({room.items.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('compare');
                if (token) trackTelemetry.mutate({ token, input: { event: 'compare' } });
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'compare'
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Scale className="w-4 h-4" />
              Side-by-Side Comparison
            </button>
            <button
              onClick={() => {
                setActiveTab('emi');
                if (token) trackTelemetry.mutate({ token, input: { event: 'emi_calc' } });
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'emi'
                  ? 'bg-primary text-white shadow-lg shadow-primary/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Calculator className="w-4 h-4" />
              Loan EMI Calculator
            </button>
          </div>
        </section>

        {/* Tab 1: Shortlisted Properties Cards */}
        {activeTab === 'cards' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {room.items.map((item, idx) => {
                const project = item.project;
                const startingPrice = project.pricingDetails?.startingPrice;

                return (
                  <div
                    key={item.projectId}
                    className="group relative flex flex-col rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl hover:border-primary/50 transition-all duration-300"
                  >
                    {/* Top Match Score Pill */}
                    <div className="relative h-48 bg-slate-800 overflow-hidden">
                      {project.gallery && project.gallery.length > 0 ? (
                        <img
                          src={project.gallery[0]}
                          alt={project.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-800 text-slate-600">
                          <Building2 className="w-12 h-12 mb-2" />
                          <span className="text-xs uppercase tracking-wider font-semibold">
                            {project.builderName}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                      {/* Match Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-black shadow-lg backdrop-blur-md">
                        <Sparkles className="w-3.5 h-3.5" />
                        {item.matchScore}% DNA Match
                      </div>

                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-slate-300 text-[10px] font-semibold backdrop-blur-md">
                        #{idx + 1} Recommendation
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-primary">{project.builderName}</span>
                          <span>{project.status.replace('_', ' ')}</span>
                        </div>

                        <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>

                        <p className="flex items-center gap-1.5 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {project.location}
                        </p>

                        {/* Match Highlights */}
                        {item.matchHighlights && item.matchHighlights.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.matchHighlights.map((hl, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[11px] font-medium"
                              >
                                ✓ {hl}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* USPs */}
                        {project.usps && project.usps.length > 0 && (
                          <p className="text-xs text-slate-300 line-clamp-2 pt-1 italic">
                            "{project.usps.slice(0, 2).join(' • ')}"
                          </p>
                        )}
                      </div>

                      {/* Pricing & Unit Info */}
                      <div className="pt-4 border-t border-slate-800 space-y-3">
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Starting From
                            </span>
                            <div className="text-xl font-black text-white">
                              {startingPrice
                                ? startingPrice >= 10000000
                                  ? `₹${(startingPrice / 10000000).toFixed(2)} Cr`
                                  : `₹${(startingPrice / 100000).toFixed(2)} Lakhs`
                                : 'On Request'}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedProjectForEmi({
                                name: project.name,
                                price: startingPrice || 10000000,
                              });
                              setActiveTab('emi');
                            }}
                            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            Calc EMI
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleCtaOpen('visit', project.id, project.name)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-md shadow-primary/20"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            Book Site Visit
                          </button>
                          <button
                            onClick={() => handleCtaOpen('callback', project.id, project.name)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Callback
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Comparison Matrix */}
        {activeTab === 'compare' && (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl overflow-x-auto">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">Side-by-Side Comparison</h3>
              <p className="text-xs text-slate-400 mt-1">
                Objective feature-by-feature evaluation of shortlisted developments
              </p>
            </div>

            <table className="w-full text-left text-sm text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="py-3 px-4 text-xs uppercase font-bold text-slate-400 w-1/4">
                    Feature / Spec
                  </th>
                  {room.items.map((item) => (
                    <th key={item.projectId} className="py-3 px-4 font-bold text-white text-sm">
                      <div className="flex items-center gap-1.5">
                        <span>{item.project.name}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60 font-semibold">
                          {item.matchScore}% Match
                        </span>
                      </div>
                      <div className="text-xs font-normal text-slate-400">{item.project.builderName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {room.comparisonMatrix.attributes.map((attr) => (
                  <tr key={attr.key} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-xs font-semibold text-slate-400">
                      {attr.label}
                    </td>
                    {room.items.map((item) => {
                      const val = attr.values[item.projectId];
                      return (
                        <td key={item.projectId} className="py-3 px-4 text-xs text-white">
                          {val !== undefined && val !== null ? String(val) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: EMI Calculator */}
        {activeTab === 'emi' && (
          <div className="max-w-3xl mx-auto">
            <EmiCalculator
              initialPrice={selectedProjectForEmi?.price || 10000000}
            />
          </div>
        )}
      </main>

      {/* Floating Sticky Bottom CTA for Mobile */}
      <div className="sm:hidden sticky bottom-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 px-4 flex items-center justify-between gap-3">
        <button
          onClick={() => handleCtaOpen('visit')}
          className="flex-1 py-3 px-4 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
        >
          <CalendarCheck className="w-4 h-4" />
          Book Guided Visit
        </button>
        <button
          onClick={() => handleCtaOpen('callback')}
          className="py-3 px-4 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2"
        >
          <PhoneCall className="w-4 h-4 text-primary" />
          Call
        </button>
      </div>

      {/* CTA Modal (Visit / Callback) */}
      {ctaModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setCtaModal({ isOpen: false, type: 'visit' })}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            {ctaSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Request Received!</h3>
                <p className="text-xs text-slate-300">
                  Your dedicated property advisor from {room.agencyName} will connect with you within 15 minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCtaSubmit} className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
                    {ctaModal.type === 'visit' ? (
                      <CalendarCheck className="w-5 h-5" />
                    ) : (
                      <PhoneCall className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {ctaModal.type === 'visit' ? 'Schedule Site Visit' : 'Request Instant Callback'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {ctaModal.projectName || 'Curated Shortlist Projects'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    defaultValue={room.leadFirstName}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Preferred Time / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. This Saturday 11:00 AM"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCtaModal({ isOpen: false, type: 'visit' })}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/25"
                  >
                    Confirm Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
