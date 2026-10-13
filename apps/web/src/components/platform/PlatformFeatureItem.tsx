import React from 'react';
import { SHOWCASE_FEATURES, type ShowcaseFeature } from '../../data/platformShowcase.js';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';

export const PlatformFeatureItem: React.FC = () => {
  return (
    <section id="features" className="py-24 bg-slate-50/50 dark:bg-slate-900/30 border-y border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-28">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            End-to-End Real Estate Technology
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Engineered Specifically for Property Sales Velocity
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300">
            PropBot Pro isn't a general chatbot wrapped around GPT. It's a vertically specialized real-estate operating system designed to qualify buyers, protect builder pricing, and close site visits.
          </p>
        </div>

        {/* Alternating Feature Rows */}
        {SHOWCASE_FEATURES.map((feat: ShowcaseFeature, index: number) => {
          const isEven = index % 2 === 0;

          return (
            <div
              key={feat.id}
              className={`grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center ${
                isEven ? '' : 'lg:flex-row-reverse'
              }`}
            >
              {/* Text Column */}
              <div className={`lg:col-span-6 ${isEven ? 'order-1' : 'order-1 lg:order-2'}`}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-bold uppercase tracking-wider mb-4 border border-blue-200 dark:border-blue-800">
                  {feat.badge}
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug mb-3">
                  {feat.title}
                </h3>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-4">
                  {feat.subtitle}
                </p>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                  {feat.description}
                </p>

                {/* Bullet Points */}
                <ul className="space-y-3 mb-8">
                  {feat.bulletPoints.map((point, pIndex) => (
                    <li key={pIndex} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#demo"
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group"
                >
                  Explore in interactive demo
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>

              {/* Product UI Visual Column */}
              <div className={`lg:col-span-6 ${isEven ? 'order-2' : 'order-2 lg:order-1'}`}>
                <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl">
                  {/* Subtle Top Indicator */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      PropBot Pro Module
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-[10px]">
                      Verified Active
                    </span>
                  </div>

                  {/* Dynamic Visual Content per type */}
                  {feat.visualType === 'chat' && (
                    <div className="space-y-3 text-xs">
                      <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-2xl rounded-tl-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        <strong>Prestige Lakeside Habitat:</strong> 3BHK Lake View units start at ₹2.10 Cr. 1,850 sq.ft. RERA registration PRM/KA/RERA/1251/446/PR/171015/000452.
                      </div>
                      <div className="bg-blue-600 text-white p-3.5 rounded-2xl rounded-tr-sm ml-auto max-w-[85%]">
                        Can you confirm if covered parking and clubhouse charges are included?
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-2xl rounded-tl-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        Yes, two basement car parks and lifetime club membership are bundled. Ready for inspection this weekend.
                      </div>
                    </div>
                  )}

                  {feat.visualType === 'dna' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">Amit Patel • 94% Intent</div>
                          <div className="text-[11px] text-slate-500">Budget: ₹2.10 Cr – ₹2.50 Cr | 3BHK Luxury</div>
                        </div>
                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold text-[10px]">
                          HOT LEAD
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-slate-400">Preferred Zone:</span> Whitefield
                        </div>
                        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-slate-400">Timeline:</span> &lt; 30 Days
                        </div>
                      </div>
                    </div>
                  )}

                  {feat.visualType === 'shortlist' && (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">Tower B - 802</div>
                          <div className="text-slate-500 text-[11px]">3BHK Lake Facing • 1,850 Sq.Ft.</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600 dark:text-blue-400">₹2.10 Cr</div>
                          <div className="text-[10px] text-emerald-600 font-semibold">98% Match</div>
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">Estate - 04 Villa</div>
                          <div className="text-slate-500 text-[11px]">4BHK Private Pool • 4,850 Sq.Ft.</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600 dark:text-blue-400">₹6.50 Cr</div>
                          <div className="text-[10px] text-emerald-600 font-semibold">89% Match</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {feat.visualType === 'crm' && (
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-slate-400 text-[10px]">Qualified</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">14</div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-slate-400 text-[10px]">Site Visits</div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">8</div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="text-slate-400 text-[10px]">Tokens</div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">5</div>
                      </div>
                    </div>
                  )}

                  {feat.visualType === 'whatsapp' && (
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-slate-800 dark:text-slate-200">
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                          Official WhatsApp Business API
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          VIP Site Visit QR Pass and Google Maps pin dispatched automatically 24h prior to visit.
                        </p>
                      </div>
                    </div>
                  )}

                  {feat.visualType === 'handoff' && (
                    <div className="space-y-2 text-xs">
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-amber-800 dark:text-amber-400">Tier 2 Guarded Action</div>
                          <div className="text-[11px] text-slate-500">Proposed ₹3,00,000 builder token concession</div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px]">
                          Pending Manager
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
