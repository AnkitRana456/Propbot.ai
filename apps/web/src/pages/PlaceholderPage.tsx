import React from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlaceholderPageProps {
  title: string;
  description: string;
  phaseTag: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  description,
  phaseTag,
}) => {
  return (
    <div className="card space-y-4 dark:border-border-dark dark:bg-surface-dark">
      <div className="flex items-center justify-between border-b border-border-light pb-4 dark:border-border-dark">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <span className="pill-badge flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{phaseTag}</span>
        </span>
      </div>

      <div className="py-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This module is part of the PropBot Pro roadmap and scheduled for upcoming implementation
          phases per the project specification.
        </p>
        <div className="mt-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
