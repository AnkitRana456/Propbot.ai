import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, X } from 'lucide-react';

interface ConsentBannerProps {
  onAccept?: () => void;
  onDecline?: () => void;
  privacyPolicyUrl?: string;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({
  onAccept,
  onDecline,
  privacyPolicyUrl = '/help',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('propbot_visitor_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('propbot_visitor_consent', 'accepted');
    setIsVisible(false);
    onAccept?.();
  };

  const handleDecline = () => {
    localStorage.setItem('propbot_visitor_consent', 'declined');
    setIsVisible(false);
    onDecline?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 transition-all">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary dark:bg-primary/20 shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
            Privacy &amp; Data Notice
          </h4>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            We use essential cookies and session state to personalize property recommendations and schedule site visits. In compliance with DPDP &amp; GDPR regulations, tracking of device info is opt-in.{' '}
            <a
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold"
            >
              Learn more
            </a>
            .
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
        <button
          onClick={handleDecline}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1"
        >
          <X className="h-3 w-3" />
          Decline Tracking
        </button>
        <button
          onClick={handleAccept}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover cursor-pointer flex items-center gap-1"
        >
          <Check className="h-3 w-3" />
          Accept &amp; Continue
        </button>
      </div>
    </div>
  );
};
