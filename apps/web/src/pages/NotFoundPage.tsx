import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useDocumentMeta } from '../lib/use-document-meta.js';

/** Shown for any address that does not exist. */
export const NotFoundPage: React.FC = () => {
  useDocumentMeta({ title: 'Page not found | PropBot Pro', noindex: true });
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Compass className="h-7 w-7" /></span>
      <p className="mt-5 text-sm font-semibold text-accent">Error 404</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-text">We could not find that page</h1>
      <p className="mt-2 max-w-md text-text-muted">The link may be old or mistyped. Head back to your dashboard or the home page.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/dashboard" className="inline-flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-on-accent hover:bg-accent-hover">Go to dashboard</Link>
        <Link to="/" className="inline-flex h-11 items-center rounded-lg border border-border bg-surface px-6 text-sm font-semibold text-text hover:bg-surface-2">Home page</Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
