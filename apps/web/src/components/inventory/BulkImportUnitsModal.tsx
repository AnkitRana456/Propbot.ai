import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { useBulkImportUnits } from '../../services/inventory.service.js';
import type { BulkImportReport } from '@propbot/shared';

interface BulkImportUnitsModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const SAMPLE_CSV = `tower,floor,unitNumber,bhk,carpetAreaSqft,superAreaSqft,price,status,facing,furnishing
Tower A,12,A-1204,3,1350,1820,16500000,available,east,semi_furnished
Tower A,12,A-1205,2,980,1320,11500000,available,north,unfurnished
Tower B,4,B-402,4,2150,2850,26000000,available,park_facing,fully_furnished
Tower B,8,B-801,3,1420,1900,17200000,booked,east,semi_furnished`;

export const BulkImportUnitsModal: React.FC<BulkImportUnitsModalProps> = ({
  isOpen,
  projectId,
  projectName,
  onClose,
  onSuccess,
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [report, setReport] = useState<BulkImportReport | null>(null);
  const [fileName, setFileName] = useState('');

  const bulkImportMutation = useBulkImportUnits();

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_units_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) return;
    try {
      const res = await bulkImportMutation.mutateAsync({
        projectId,
        input: { csvContent },
      });
      setReport(res);
      if (res.importedCount > 0 && onSuccess) {
        onSuccess();
      }
    } catch {
      // handled by mutation error
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-blue-600" />
              Bulk Import Unit Inventory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Project: {projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Sample template banner */}
          <div className="flex items-center justify-between rounded-xl bg-blue-50/70 p-3.5 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/60">
            <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-300">
              <FileText className="h-4 w-4 shrink-0 text-blue-600" />
              <span>Use standard CSV format: <code>tower, floor, unitNumber, bhk, carpetAreaSqft, price, status</code></span>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-xs hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-300 shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Sample CSV
            </button>
          </div>

          {/* File Upload Box */}
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center dark:border-slate-800 hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <UploadCloud className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {fileName ? fileName : 'Click to select CSV file from computer'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Accepts CSV files with up to 500 unit rows</p>
            </label>
          </div>

          {/* Textarea Editor */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Or Paste CSV Data Directly:
            </label>
            <textarea
              rows={5}
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
              placeholder="tower,floor,unitNumber,bhk,carpetAreaSqft,superAreaSqft,price,status,facing,furnishing&#10;Tower A,12,A-1204,3,1350,1820,16500000,available,east,semi_furnished"
              className="w-full font-mono text-xs rounded-xl border border-slate-200 p-3 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Validation Report Result */}
          {report && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Successfully Imported: {report.importedCount} / {report.totalRows}
                </span>
                {report.failedCount > 0 && (
                  <span className="flex items-center gap-1 text-rose-600">
                    <AlertTriangle className="h-4 w-4" /> Failed: {report.failedCount}
                  </span>
                )}
              </div>

              {report.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-rose-600 border-t border-slate-200 pt-2 dark:border-slate-700">
                  {report.errors.map((err, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span className="font-mono font-bold">Row {err.row}:</span>
                      <span>{err.error} {err.unitNumber ? `(${err.unitNumber})` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {report ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!csvContent.trim() || bulkImportMutation.isPending}
            onClick={handleImport}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {bulkImportMutation.isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importing...
              </>
            ) : (
              'Run Import & Validate'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
