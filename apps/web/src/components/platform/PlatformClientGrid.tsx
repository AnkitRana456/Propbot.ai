import React, { useState } from 'react';
import {
  SHOWCASE_CLIENTS,
  TRANSFORMATION_METRICS,
  type ShowcaseClient,
} from '../../data/platformShowcase.js';
import { ArrowUpRight, Sparkles } from 'lucide-react';

export const PlatformClientGrid: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Developers', 'Brokerages', 'Residential', 'Commercial', 'Property Consultants'];

  const filteredClients = selectedCategory === 'All'
    ? SHOWCASE_CLIENTS
    : SHOWCASE_CLIENTS.filter(c => c.category === selectedCategory);

  return (
    <section className="py-20 border-y border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Built for High-Growth Real Estate Teams
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Trusted by Builders, Developers & Modern Brokerages
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300">
            From regional township developers to high-velocity channel partners, real-estate teams use PropBot Pro to convert digital footfall into verified property site visits.
          </p>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
            (Sample client placeholders — replace with your portfolio in <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">platformShowcase.ts</code>)
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Fictional Client Logos & Wordmarks Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-16">
          {filteredClients.map((client: ShowcaseClient) => (
            <div
              key={client.id}
              className="group relative p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">
                    {client.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Demo Partner</span>
                </div>
                <div className="font-extrabold text-base tracking-tight text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {client.name}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                  {client.description}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 group-hover:text-blue-500">
                <span className="truncate">{client.tagline}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

        {/* Transformation Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-slate-200 dark:border-slate-800">
          {TRANSFORMATION_METRICS.map((metric) => (
            <div
              key={metric.label}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm text-center flex flex-col items-center justify-center"
            >
              <div className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                {metric.value}
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                {metric.label}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {metric.context}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
