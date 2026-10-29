import React, { useRef, useState } from 'react';
import { Download, Upload, X } from 'lucide-react';
import { useImportLeads, type ImportSummary } from '../../services/leads.service.js';
import { Button } from '../ui/Button.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_CSV = `name,phone,email
Rahul Sharma,+919876543210,rahul@example.com
Priya Patel,+919812345678,
Amit Verma,+918800001234,amit@example.com`;

export const ImportLeadsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportSummary | null>(null);
  const importMutation = useImportLeads();

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setCsv(e.target?.result as string ?? '');
    reader.readAsText(file);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-leads.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!csv.trim()) return;
    const res = await importMutation.mutateAsync({ csv });
    setResult(res.data);
  };

  const handleClose = () => {
    setCsv('');
    setFileName('');
    setResult(null);
    importMutation.reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="Import leads">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">Import Leads from CSV</h2>
          <button type="button" onClick={handleClose} className="rounded-md p-1 hover:bg-surface-2" aria-label="Close">
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!result ? (
            <>
              {/* Format info */}
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-text-muted">
                <p className="font-medium text-text">Required columns:</p>
                <p className="mt-1"><code className="rounded bg-surface px-1">name</code>, <code className="rounded bg-surface px-1">phone</code></p>
                <p className="mt-1">Optional: <code className="rounded bg-surface px-1">email</code></p>
                <button type="button" onClick={downloadSample} className="mt-2 flex items-center gap-1.5 text-accent hover:underline">
                  <Download className="h-3.5 w-3.5" /> Download sample CSV
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-8 text-center hover:border-accent hover:bg-accent-soft/30 transition-colors"
              >
                <Upload className="h-7 w-7 text-text-muted" />
                <p className="text-sm font-medium text-text">{fileName || 'Click or drag a CSV file here'}</p>
                {fileName && <p className="text-xs text-text-muted">File loaded — ready to import</p>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {importMutation.isError && (
                <p className="text-sm text-danger">{importMutation.error.message}</p>
              )}
            </>
          ) : (
            /* Results */
            <div className="space-y-3">
              <h3 className="font-medium text-text">Import complete</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{result.created}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Created</p>
                </div>
                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-3 text-center">
                  <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{result.duplicate}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">Duplicate</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">{result.failed}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">Failed</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <p className="mb-1 text-xs font-semibold text-text-muted">Errors:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-danger">Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              size="sm"
              onClick={handleImport}
              disabled={!csv.trim() || importMutation.isPending}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              {importMutation.isPending ? 'Importing…' : 'Import leads'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
