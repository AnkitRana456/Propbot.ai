import React from 'react';
import { HOW_IT_WORKS_STEPS, type HowItWorksStep } from '../../data/platformShowcase.js';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export const PlatformTimeline: React.FC = () => {
  return (
    <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Seamless Sales Velocity Journey
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
          How PropBot Pro Powers Your Pipeline
        </h2>
        <p className="text-base text-slate-600 dark:text-slate-300">
          From the first anonymous website touchpoint to the physical site visit walkthrough, every step is automated, compliant, and tracked in real time.
        </p>
      </div>

      {/* Responsive Timeline: Horizontal on Desktop, Vertical on Mobile */}
      <div className="relative">
        {/* Desktop Connector Line */}
        <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 -translate-y-8 -z-10 opacity-30" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {HOW_IT_WORKS_STEPS.map((step: HowItWorksStep) => (
            <div
              key={step.step}
              className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                {/* Step Number Badge */}
                <div className="flex items-center justify-between mb-5">
                  <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shadow-md shadow-blue-500/20">
                    {step.step}
                  </span>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                    {step.metric}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-1">
                  {step.title}
                </h3>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                  {step.subtitle}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Zero Hallucination Guard</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
