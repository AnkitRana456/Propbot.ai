import React from 'react';
import { AUDIENCE_CARDS, type AudienceCard } from '../../data/platformShowcase.js';
import { Building2, Users2, Compass, Briefcase, CheckCircle2 } from 'lucide-react';

export const PlatformAudienceGrid: React.FC = () => {
  const getAudienceIcon = (id: string) => {
    switch (id) {
      case 'aud-developers':
        return Building2;
      case 'aud-brokerages':
        return Users2;
      case 'aud-consultants':
        return Compass;
      case 'aud-commercial':
        return Briefcase;
      default:
        return Building2;
    }
  };

  return (
    <section id="audience" className="py-24 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
            Tailored Industry Solutions
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Built for Every Segment of the Real Estate Ecosystem
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Whether you are launching a 1,000-unit integrated township or advising ultra-high-net-worth villa buyers, PropBot Pro adapts to your exact sales structure.
          </p>
        </div>

        {/* 4-Column Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {AUDIENCE_CARDS.map((aud: AudienceCard) => {
            const Icon = getAudienceIcon(aud.id);

            return (
              <div
                key={aud.id}
                className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col justify-between"
              >
                <div>
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mb-5 shadow-md shadow-blue-500/20">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                    {aud.title}
                  </h3>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3">
                    {aud.subtitle}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
                    {aud.description}
                  </p>

                  {/* Features List */}
                  <div className="space-y-2 mb-6">
                    {aud.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example Workflow Box */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Sample Production Journey:
                  </span>
                  {aud.exampleWorkflow}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
