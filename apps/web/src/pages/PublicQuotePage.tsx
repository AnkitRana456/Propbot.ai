import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest } from '../services/api-client.js';
import type { CostSheetRecord } from '../services/inventory.service.js';

function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export const PublicQuotePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [sheet, setSheet] = useState<CostSheetRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<CostSheetRecord>(`/api/public/quote/${token}`)
      .then(setSheet)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div className="max-w-md text-center">
          <p className="text-2xl font-bold text-text">Quote unavailable</p>
          <p className="mt-2 text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const totals = sheet.totals;

  return (
    <div className="min-h-screen bg-bg text-text print:bg-white">
      <div className="mx-auto max-w-2xl px-6 py-10 print:py-4">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cost Sheet</h1>
            {sheet.validUntil && (
              <p className="mt-1 text-sm text-text-muted">
                Valid until {new Date(sheet.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2 print:hidden"
          >
            Print / Save PDF
          </button>
        </div>

        {/* Line items */}
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-muted">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((line, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className={line.amount < 0 ? 'text-success' : ''}>{line.label}</span>
                    {line.note && <span className="ml-2 text-xs text-text-muted">({line.note})</span>}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${line.amount < 0 ? 'text-success' : ''}`}>
                    {line.amount < 0 ? `− ${fmt(Math.abs(line.amount))}` : fmt(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-6 space-y-2 rounded-xl border border-border bg-surface p-5">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Agreement value (incl. GST)</span>
            <span className="tabular-nums font-semibold">{fmt(totals.agreementValue ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Stamp duty + Registration</span>
            <span className="tabular-nums">{fmt((totals.stampDuty ?? 0) + (totals.registration ?? 0))}</span>
          </div>
          {(totals.discount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Discount</span>
              <span className="tabular-nums">− {fmt(totals.discount ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Net payable</span>
            <span className="tabular-nums text-accent">{fmt(totals.netPayable ?? 0)}</span>
          </div>
        </div>

        {sheet.notes && (
          <p className="mt-4 text-sm text-text-muted">{sheet.notes}</p>
        )}

        <p className="mt-8 text-center text-xs text-text-muted print:mt-4">
          This is a computer-generated cost sheet. Prices are subject to change. Please confirm with your sales advisor.
        </p>
      </div>
    </div>
  );
};

export default PublicQuotePage;
