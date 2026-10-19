import React, { useState } from 'react';
import {
  X,
  FileText,
  UploadCloud,
  Globe,
  HelpCircle,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { QaPair } from '@propbot/shared';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitText: (title: string, content: string) => Promise<void>;
  onSubmitQa: (title: string, pairs: QaPair[]) => Promise<void>;
  onSubmitCrawl: (title: string, url: string, maxPages: number, maxDepth: number) => Promise<void>;
  onSubmitFile: (title: string, file: File) => Promise<void>;
}

type TabType = 'text' | 'file' | 'crawl' | 'qa';

export const AddSourceModal: React.FC<AddSourceModalProps> = ({
  isOpen,
  onClose,
  onSubmitText,
  onSubmitQa,
  onSubmitCrawl,
  onSubmitFile,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('file');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Text tab state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  // File tab state
  const [fileTitle, setFileTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Crawl tab state
  const [crawlTitle, setCrawlTitle] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [maxPages, setMaxPages] = useState(20);
  const [maxDepth, setMaxDepth] = useState(2);

  // Q&A tab state
  const [qaTitle, setQaTitle] = useState('');
  const [qaPairs, setQaPairs] = useState<QaPair[]>([
    { question: '', answer: '' },
    { question: '', answer: '' },
  ]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!fileTitle) {
        setFileTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleAddQaPair = () => {
    setQaPairs([...qaPairs, { question: '', answer: '' }]);
  };

  const handleRemoveQaPair = (index: number) => {
    setQaPairs(qaPairs.filter((_, i) => i !== index));
  };

  const handleUpdateQaPair = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...qaPairs];
    const item = updated[index];
    if (item) {
      item[field] = value;
      setQaPairs(updated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'text') {
        if (!textTitle.trim()) throw new Error('Source title is required.');
        if (textContent.trim().length < 10) throw new Error('Content must be at least 10 characters.');
        await onSubmitText(textTitle.trim(), textContent.trim());
      } else if (activeTab === 'file') {
        if (!selectedFile) throw new Error('Please select a file to upload.');
        if (!fileTitle.trim()) throw new Error('Document title is required.');
        await onSubmitFile(fileTitle.trim(), selectedFile);
      } else if (activeTab === 'crawl') {
        if (!crawlUrl.trim() || !crawlUrl.startsWith('http')) {
          throw new Error('Please enter a valid HTTP or HTTPS website URL.');
        }
        const title = crawlTitle.trim() || crawlUrl.trim();
        await onSubmitCrawl(title, crawlUrl.trim(), maxPages, maxDepth);
      } else if (activeTab === 'qa') {
        if (!qaTitle.trim()) throw new Error('FAQ collection title is required.');
        const validPairs = qaPairs.filter(p => p.question.trim() && p.answer.trim());
        if (validPairs.length === 0) {
          throw new Error('Please fill in at least one Question and Answer pair.');
        }
        await onSubmitQa(qaTitle.trim(), validPairs);
      }

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add knowledge source');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[var(--surface)] text-[var(--text-primary)] rounded-xl shadow-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-muted)]">
          <div>
            <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">Add Knowledge Source</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Feed verified property facts, brochures, and layouts into your AI agent
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--border)] px-6 bg-[var(--surface)] gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'file'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'text'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Paste Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('crawl')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'crawl'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Globe className="w-4 h-4" />
            Website Crawl
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qa')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'qa'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Structured Q&A
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Brochure & Specifications 2026"
                  value={fileTitle}
                  onChange={e => setFileTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  Attach Document (PDF, DOCX, TXT, CSV, XLSX)
                </label>
                <div className="border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[var(--surface-muted)]/50">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".pdf,.docx,.txt,.csv,.xlsx"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <UploadCloud className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-2" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {selectedFile ? selectedFile.name : 'Click to upload or drag & drop'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      PDF, DOCX, TXT, CSV, or XLSX up to 25 MB
                    </p>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  Source Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Clubhouse Amenities & Operational Guidelines"
                  value={textTitle}
                  onChange={e => setTextTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  Knowledge Context Content
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste verified details, guidelines, price milestones, or FAQs here..."
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)] resize-none font-mono text-xs"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Will be automatically chunked into semantic 500-token sections with 50-token overlap.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'crawl' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  Website / Project Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Official Developer Microsite"
                  value={crawlTitle}
                  onChange={e => setCrawlTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  Starting URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/properties/luxury-villas"
                  value={crawlUrl}
                  onChange={e => setCrawlUrl(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-lg text-sm font-mono text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 font-mono">
                    Max Pages: <span className="text-[var(--accent)] font-bold">{maxPages}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={maxPages}
                    onChange={e => setMaxPages(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 font-mono">
                    Crawl Depth: <span className="text-[var(--accent)] font-bold">{maxDepth} levels</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={maxDepth}
                    onChange={e => setMaxDepth(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Crawler respects robots.txt, strips HTML boilerplates, and stays strictly on the root domain.
              </p>
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 font-mono">
                  FAQ Collection Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Possession & Stamp Duty FAQ"
                  value={qaTitle}
                  onChange={e => setQaTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-mono">
                    Question & Answer Pairs
                  </label>
                  <button
                    type="button"
                    onClick={handleAddQaPair}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Pair
                  </button>
                </div>

                {qaPairs.map((pair, idx) => (
                  <div key={idx} className="p-3.5 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[var(--text-muted)]">Pair #{idx + 1}</span>
                      {qaPairs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQaPair(idx)}
                          className="text-[var(--text-muted)] hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Question (e.g. What is the booking token amount?)"
                      value={pair.question}
                      onChange={e => handleUpdateQaPair(idx, 'question', e.target.value)}
                      className="w-full px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <textarea
                      rows={2}
                      placeholder="Verified Answer (e.g. The booking token is ₹10 Lakhs.)"
                      value={pair.answer}
                      onChange={e => handleUpdateQaPair(idx, 'answer', e.target.value)}
                      className="w-full px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[var(--accent)] hover:brightness-110 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? 'Ingesting & Vectorizing...' : 'Save & Ingest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
