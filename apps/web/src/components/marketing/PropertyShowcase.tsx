import React from 'react';
import { ModelScene } from './ModelScene.js';
import { ApartmentModel, PlotModel, ShopModel, VillaModel } from './PropertyModels.js';
import type { EmojiSet } from './EmojiBurst.js';
import { Reveal } from './Frames.js';
import { container, h2, lead, sectionPad } from './styles.js';

interface PropertyKind {
  id: string;
  title: string;
  blurb: string;
  chips: string[];
  emojis: EmojiSet;
  soldLabel: string;
  anchor: number;
  Model: React.FC<{ sold: boolean }>;
}

const KINDS: PropertyKind[] = [
  { id: 'apartments', title: 'Apartments', blurb: 'BHK, floor, facing and possession questions answered the moment they are asked, with visits booked for the weekend.', chips: ['BHK and floor plans', 'Possession dates', 'RERA details'], emojis: 'tower', soldLabel: 'Sold out', anchor: 0.8, Model: ApartmentModel },
  { id: 'villas', title: 'Villas', blurb: 'Plot size, built-up area and finishes explained in the buyer’s language, then a visit to the model villa.', chips: ['Built-up area', 'Model villa visits', 'Price breakup'], emojis: 'home', soldLabel: 'Sold', anchor: 0.8, Model: VillaModel },
  { id: 'plots', title: 'Plots and land', blurb: 'Survey numbers, approvals and dimensions shared on request, and site visits planned around the buyer’s day.', chips: ['Plot numbers', 'Approvals', 'Land visits'], emojis: 'land', soldLabel: 'Sold', anchor: 0.76, Model: PlotModel },
  { id: 'commercial', title: 'Shops and offices', blurb: 'Buy or lease, carpet area and budget captured up front, so your team calls only serious enquiries.', chips: ['Buy or lease', 'Carpet area', 'Budget match'], emojis: 'shop', soldLabel: 'Leased', anchor: 0.8, Model: ShopModel },
];

export const PropertyShowcase: React.FC = () => (
  <section id="showcase" className={`${sectionPad} relative overflow-clip`} aria-labelledby="showcase-title">
    <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-60" />
    <div className={`${container} relative`}>
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="showcase-title" className={h2}>
          Whatever you sell, PropBot sells it with you
        </h2>
        <p className={`${lead} mx-auto`}>Flats, villas, plots or shops. Turn them, tap them and watch a property sell.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {KINDS.map((k, i) => (
          <Reveal key={k.id} delay={(i % 2) * 90} className="h-full">
            <article className="h-full overflow-clip rounded-2xl border border-border bg-surface shadow-card">
              <ModelScene Model={k.Model} emojis={k.emojis} name={k.title} soldLabel={k.soldLabel} anchor={k.anchor} className="bg-gradient-to-b from-accent-soft/40 to-transparent" />
              <div className="p-5">
                <h3 className="text-lg font-bold text-text">{k.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{k.blurb}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {k.chips.map(c => (
                    <li key={c} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-text-muted">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);
