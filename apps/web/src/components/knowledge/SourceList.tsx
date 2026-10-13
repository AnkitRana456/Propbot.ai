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
        return <UploadCloud className="w-4 h-4 text-emerald-600" />;
      case 'url':
        return <Globe className="w-4 h-4 text-blue-600" />;
      case 'qa':
        return <HelpCircle className="w-4 h-4 text-purple-600" />;
      case 'text':
      default:
        return <FileText className="w-4 h-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string, error?: string | null) => {
    switch (status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Ready
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            Chunking & Embedding
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Queued
          </span>
        );
      case 'failed':
      default:
        return (
          <span
            title={error || 'Processing failed'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
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
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 space-y-3">
        <RotateCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading knowledge base sources...</p>
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
          <Database className="w-7 h-7" />
        </div>
        <div className="max-w-md">
          <h3 className="text-base font-semibold text-slate-900">No knowledge sources attached yet</h3>
          <p className="text-sm text-slate-500 mt-1">
            Empower your AI agent with project brochures, pricing plans, floor plans, and website pages.
            The bot will only answer with verified facts from these documents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Source & Details</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Vectors / Chunks</th>
              <th className="px-4 py-3.5">Size</th>
              <th className="px-4 py-3.5">Last Trained</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sources.map(src => {
              const isRetraining = retrainingId === src.id;
              return (
                <tr key={src.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-slate-100 border border-slate-200/80">
                        {getSourceIcon(src.type)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {src.title}
                          {src.sourceUrl && (
                            <a
                              href={src.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-emerald-600"
                              title={src.sourceUrl}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 capitalize flex items-center gap-2">
                          <span className="font-medium text-slate-600">Type:</span> {src.type}
                          {src.errorMessage && (
                            <span className="text-rose-600 font-medium">({src.errorMessage})</span>
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
                      <span className="font-bold text-slate-900">{src.chunkCount}</span>
                      <span className="text-xs text-slate-500">chunks</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                    {formatBytes(src.byteSize)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                    {src.lastTrainedAt ? new Date(src.lastTrainedAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right space-x-2">
                    <button
                      type="button"
                      disabled={isRetraining || src.status === 'processing'}
                      onClick={() => onRetrain(src.id)}
                      title="Re-chunk and update embeddings"
                      className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`w-4 h-4 ${isRetraining ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(src.id)}
                      title="Delete knowledge source and vectors"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
