import React from 'react';
import { useDocumentMeta } from '../lib/use-document-meta.js';
import { EmojiBurstProvider } from '../components/marketing/EmojiBurst.js';
import { MegaNav } from '../components/marketing/MegaNav.js';
import { ProductExplorer } from '../components/marketing/ProductExplorer.js';
import { PropertyShowcase } from '../components/marketing/PropertyShowcase.js';
import { BuiltFor, ClosingDemo, Faq, FeatureGrid, Hero, HowItWorks, MarketingFooter, Pricing, ProductTour, ProofBand, TrustStrip, UseCases } from '../components/marketing/Sections.js';

/** The public marketing site at "/". */
export const PlatformPage: React.FC = () => {
  useDocumentMeta({
    title: 'PropBot Pro | AI chatbot and CRM that books site visits',
    description: 'Answer every property enquiry in seconds on your website and WhatsApp, qualify buyers and book site visits automatically. Free trial, pricing in rupees.',
    path: '/',
  });

  return (
    <EmojiBurstProvider>
      <div className="min-h-screen bg-bg font-sans text-text">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent">
          Skip to content
        </a>
        <MegaNav />
        <main id="main" tabIndex={-1} className="focus:outline-none">
          <Hero />
          <TrustStrip />
          <ProductTour />
          <ProofBand />
          <PropertyShowcase />
          <ProductExplorer />
          <UseCases />
          <FeatureGrid />
          <BuiltFor />
          <HowItWorks />
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
