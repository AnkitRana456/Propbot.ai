import React, { useState } from 'react';
import { SHOWCASE_FAQS, PLACEHOLDER_TESTIMONIALS, type FaqItem } from '../../data/platformShowcase.js';
import { ChevronDown, HelpCircle, FileText } from 'lucide-react';

export const PlatformFaqAccordion: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
      {/* 1. Neutral Case Study / Testimonial Placeholder Cards (Rule 10 Compliant) */}
      <div>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-2">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            Verified Case Study Framework
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Customer Impact & Proof-of-Concept
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            We prioritize transparent benchmarks over fabricated testimonials. Add your team’s verified results as you go live.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLACEHOLDER_TESTIMONIALS.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                  {item.statusText}
                </span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-2">
                  {item.title}
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.message}
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400">
                Ready to plug into your portfolio
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Frequently Asked Questions Accordion */}
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200 dark:border-blue-800">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            Frequently Asked Questions
          </div>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Got Questions About Deploying PropBot Pro?
          </h3>
        </div>

        <div className="space-y-3.5">
          {SHOWCASE_FAQS.map((faq: FaqItem, idx: number) => {
            const isOpen = openIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
                >
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${
                      isOpen ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
