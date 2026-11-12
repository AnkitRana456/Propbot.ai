import React from 'react';
import { useDocumentMeta } from '../lib/use-document-meta.js';
import { EmojiBurstProvider } from '../components/marketing/EmojiBurst.js';
import { Compare, RoiCalculator } from '../components/marketing/Extras.js';
import { themeCss } from '../components/marketing/config.js';
import { motionCss } from '../components/marketing/motion.js';
import { Cursor } from '../components/marketing/Cursor.js';
import { Journey } from '../components/marketing/Journey.js';
import { ProgressTower } from '../components/marketing/ProgressTower.js';
import { usePageMotion } from '../components/marketing/scroll.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';
import { MegaNav } from '../components/marketing/MegaNav.js';
import { ProductExplorer } from '../components/marketing/ProductExplorer.js';
import { PropertyShowcase } from '../components/marketing/PropertyShowcase.js';
import { EstateReveal } from '../components/marketing/EstateReveal.js';
import { PhoneFeatures } from '../components/marketing/PhoneFeatures.js';
import { PriceCalculator } from '../components/marketing/PriceCalculator.js';
import { ProductivityFeatures } from '../components/marketing/ProductivityFeatures.js';
import { BuiltFor, ClosingDemo, Faq, FeatureGrid, Hero, HowItWorks, MarketingFooter, Pricing, ProductTour, ProofBand, TrustStrip, UseCases } from '../components/marketing/Sections.js';

/** The public marketing site at "/". */
export const PlatformPage: React.FC = () => {
  useDocumentMeta({
    title: 'PropBot Pro | AI chatbot and CRM that books site visits',
    description: 'Answer every property enquiry in seconds on your website and WhatsApp, qualify buyers and book site visits automatically. Free trial, pricing in rupees.',
    path: '/',
  });
  const reduced = useReducedMotion();
  usePageMotion(reduced);

  return (
    <EmojiBurstProvider>
      <div className="mkt min-h-screen bg-bg font-sans text-text">
        <style>{themeCss() + motionCss()}</style>
        <div aria-hidden className="grain" />
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent">
          Skip to content
        </a>
        <MegaNav />
        <ProgressTower />
        <Cursor reduced={reduced} />
        <main id="main" tabIndex={-1} className="focus:outline-none">
          <Hero />
          <TrustStrip />
          <Journey />
          <ProductTour />
          <ProofBand />
          <Compare />
          <EstateReveal />
          <PropertyShowcase />
          <ProductExplorer />
          <UseCases />
          <ProductivityFeatures />
          <FeatureGrid />
          <BuiltFor />
          <PhoneFeatures />
          <HowItWorks />
          <RoiCalculator />
          <PriceCalculator />
          <Pricing />
          <Faq />
          <ClosingDemo />
        </main>
        <MarketingFooter />
      </div>
    </EmojiBurstProvider>
  );
};

export default PlatformPage;
