import React from 'react';
import {
  FileText,
  Globe,
  HelpCircle,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCw,
  Trash2,
  Database,
  ExternalLink,
} from 'lucide-react';
import type { KnowledgeSourceResponse } from '@propbot/shared';

interface SourceListProps {
  sources: KnowledgeSourceResponse[];
  isLoading: boolean;
  onRetrain: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  retrainingId?: string | null;
}

export const SourceList: React.FC<SourceListProps> = ({
  sources,
  isLoading,
  onRetrain,
  onDelete,
  retrainingId,
}) => {
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />;
      case 'url':
        return <Globe className="w-4 h-4 text-blue-600 dark:text-blue-300" />;
      case 'qa':
        return <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-300" />;
      case 'text':
      default:
        return <FileText className="w-4 h-4 text-amber-600 dark:text-amber-300" />;
    }
  };

  const getStatusBadge = (status: string, error?: string | null) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
            Ready
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 animate-spin" />
            Chunking & Embedding
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
            Queued
          </span>
        );
      case 'failed':
      default:
        return (
          <span
            title={error || 'Processing failed'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 cursor-help"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />
            Failed
          </span>
        );
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl border border-border space-y-3">
        <RotateCw className="w-8 h-8 text-emerald-600 dark:text-emerald-300 animate-spin" />
        <p className="text-sm font-medium text-text-muted">Loading knowledge base sources...</p>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl border border-dashed border-border text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-300 shadow-sm">
          <Database className="w-7 h-7" />
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-semibold text-text">No knowledge sources attached yet</h3>
          <p className="text-sm text-text-muted mt-1">
            Empower your AI agent with project brochures, pricing plans, floor plans, and website pages.
            The bot will only answer with verified facts from these documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-text/80">
          <thead className="bg-surface-2 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Source & Details</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Vectors / Chunks</th>
              <th className="px-4 py-3.5">Size</th>
              <th className="px-4 py-3.5">Last Trained</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sources.map(src => {
              const isRetraining = retrainingId === src.id;
              return (
                <tr key={src.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-surface-2 border border-border">
                        {getSourceIcon(src.type)}
                      </div>
                      <div>
                        <div className="font-semibold text-text flex items-center gap-1.5">
                          {src.title}
                          {src.sourceUrl && (
                            <a
                              href={src.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-text-faint hover:text-emerald-600"
                              title={src.sourceUrl}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5 capitalize flex items-center gap-2">
                          <span className="font-medium text-text-muted">Type:</span> {src.type}
                          {src.errorMessage && (
                            <span className="text-rose-600 dark:text-rose-300 font-medium">({src.errorMessage})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(src.status, src.errorMessage)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-text">{src.chunkCount}</span>
                      <span className="text-xs text-text-muted">chunks</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-text-muted font-mono">
                    {formatBytes(src.byteSize)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-text-muted">
                    {src.lastTrainedAt ? new Date(src.lastTrainedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right space-x-2">
                    <button
                      type="button"
                      disabled={isRetraining || src.status === 'processing'}
                      onClick={() => onRetrain(src.id)}
                      title="Re-chunk and update embeddings"
                      className="p-1.5 text-text-muted hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`w-4 h-4 ${isRetraining ? 'animate-spin text-emerald-600 dark:text-emerald-300' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(src.id)}
                      title="Delete knowledge source and vectors"
                      className="p-1.5 text-text-faint hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
