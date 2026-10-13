import React from 'react';
import { Download, FileText } from 'lucide-react';
import type { InvoiceRecord } from '@propbot/shared';

interface InvoicesTableProps {
  invoices: InvoiceRecord[];
  isLoading?: boolean;
}

export const InvoicesTable: React.FC<InvoicesTableProps> = ({ invoices, isLoading }) => {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading payment invoices...</div>;
  }

  if (invoices.length === 0) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">No Invoices Found</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Billing invoices and payment receipts will appear here after your first plan renewal.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-6 py-3.5">Invoice #</th>
            <th className="px-6 py-3.5">Date</th>
            <th className="px-6 py-3.5">Amount</th>
            <th className="px-6 py-3.5">Status</th>
            <th className="px-6 py-3.5">Payment Method</th>
            <th className="px-6 py-3.5 text-right">Receipt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {invoices.map(inv => (
            <tr key={inv.id} className="hover:bg-slate-50/50">
              <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900 dark:text-white">
                {inv.invoiceNumber}
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">
                {new Date(inv.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                ₹{(inv.amount / 100).toLocaleString()}
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {inv.status}
                </span>
              </td>
              <td className="px-6 py-4 text-xs capitalize text-slate-500">{inv.provider}</td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => alert(`Downloading receipt for ${inv.invoiceNumber}...`)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
