import React, { useState } from 'react';
import {
  SHOWCASE_CLIENTS,
  TRANSFORMATION_METRICS,
  type ShowcaseClient,
} from '../../data/platformShowcase.js';
import { ArrowUpRight } from 'lucide-react';

export const PlatformClientGrid: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Developers', 'Brokerages', 'Residential', 'Commercial', 'Property Consultants'];

  const filteredClients = selectedCategory === 'All'
    ? SHOWCASE_CLIENTS
    : SHOWCASE_CLIENTS.filter(c => c.category === selectedCategory);

  return (
    <section className="py-20 border-b border-[var(--border)] bg-[var(--surface)] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)] text-xs font-mono mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            <span>Built for High-Growth Real Estate Operations</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[var(--text)] tracking-tight font-medium mb-4">
            Trusted by Premier Builders, Developers &amp; Advisory Firms
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-muted)] font-sans">
            From large-scale residential townships to high-velocity channel partners, real estate organizations use PropBot Pro to convert digital footfall into verified property site visits.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-[6px] text-xs font-mono transition-all ${
                selectedCategory === cat
                  ? 'bg-[var(--accent)] text-[var(--surface)] border-b-2 border-[var(--accent-hover)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Client Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-16">
          {filteredClients.map((client: ShowcaseClient) => (
            <div
              key={client.id}
              className="p-5 rounded-[10px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="blueprint-label text-[10px]">{client.category}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] truncate max-w-[120px]">{client.tagline}</span>
                </div>
                <h3 className="font-serif text-lg font-medium text-[var(--text)] mb-1">
                  {client.name}
                </h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                  {client.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-mono">
                <span className="text-[var(--accent)] font-medium truncate">{client.tagline}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Transformation Metrics Ledger */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-[10px] bg-[var(--surface-2)] border border-[var(--border)]">
          {TRANSFORMATION_METRICS.map((metric, idx) => (
            <div key={idx} className="space-y-1">
              <div className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">
                {metric.label}
              </div>
              <div className="font-serif text-3xl font-medium text-[var(--text)]">
                {metric.value}
              </div>
              <div className="font-mono text-xs text-[var(--success)]">
                {metric.context}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlatformClientGrid;
