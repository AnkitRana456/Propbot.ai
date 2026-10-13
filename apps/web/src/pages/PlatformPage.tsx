import React from 'react';
import { PlatformNav } from '../components/platform/PlatformNav.js';
import { PlatformHero } from '../components/platform/PlatformHero.js';
import { PlatformClientGrid } from '../components/platform/PlatformClientGrid.js';
import { PlatformInteractiveDemo } from '../components/platform/PlatformInteractiveDemo.js';
import { PlatformFeatureItem } from '../components/platform/PlatformFeatureItem.js';
import { PlatformTimeline } from '../components/platform/PlatformTimeline.js';
import { PlatformAudienceGrid } from '../components/platform/PlatformAudienceGrid.js';
import { PlatformFaqAccordion } from '../components/platform/PlatformFaqAccordion.js';
import { PlatformFooter } from '../components/platform/PlatformFooter.js';

export const PlatformPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* 1. Sticky Glassmorphism Header Nav */}
      <PlatformNav />

      <main>
        {/* 2. Hero Section */}
        <PlatformHero />

        {/* 3. Developer & Brokerage Showcase & Metrics */}
        <PlatformClientGrid />

        {/* 4. Interactive Live Product Demo */}
        <PlatformInteractiveDemo />

        {/* 5. Editorial Alternating Feature Showcase */}
        <PlatformFeatureItem />

        {/* 6. How It Works 4-Step Process */}
        <PlatformTimeline />

        {/* 7. Industry Audience Matrix */}
        <PlatformAudienceGrid />

        {/* 8. Case Study Framework & FAQ Accordion */}
        <PlatformFaqAccordion />
      </main>

      {/* 9. Conversion CTA & Enterprise Footer */}
      <PlatformFooter />
    </div>
  );
};

export default PlatformPage;
