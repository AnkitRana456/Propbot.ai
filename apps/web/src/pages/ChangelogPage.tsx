import React from 'react';
import { Link } from 'react-router-dom';
import { useChangelog } from '../services/controls.service.js';
import { Badge } from '../components/ui/Badge.js';
import { Skeleton } from '../components/common/Skeleton.js';

const CATEGORY_VARIANT: Record<string, 'mint' | 'blue' | 'gold' | 'slate'> = { feature: 'mint', improvement: 'blue', fix: 'slate', security: 'gold' };

/** Public page: no login needed. */
export const ChangelogPage: React.FC = () => {
  const { data, isLoading, error } = useChangelog();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-xs text-slate-500 hover:text-slate-800">← PropBot</Link>
      <h1 className="mt-2 font-serif text-3xl font-bold text-slate-900 dark:text-white">What&apos;s new</h1>
      <p className="mt-1 text-sm text-slate-500">Product updates, improvements and security fixes.</p>
      {error && <p className="mt-6 text-sm text-rose-600" role="alert">{error.message}</p>}
      {isLoading ? <Skeleton className="mt-6 h-40 w-full" /> : (
        <ol className="mt-8 space-y-6">
          {(data ?? []).map(e => (
            <li key={e.id} className="border-l-2 border-[#B84A22]/40 pl-4">
              <div className="flex items-center gap-2"><h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white">{e.title}</h2><Badge variant={CATEGORY_VARIANT[e.category] ?? 'slate'} size="sm">{e.category}</Badge></div>
              <p className="text-[11px] text-slate-400">{new Date(e.publishedAt).toLocaleDateString()}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{e.bodyMd}</p>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="text-sm text-slate-400">No updates published yet.</li>}
        </ol>
      )}
    </main>
  );
};
