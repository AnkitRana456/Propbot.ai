import React, { useState } from 'react';
import { X, Send, ShieldCheck, Zap } from 'lucide-react';
import { useBroadcastCampaign } from '../../services/whatsapp.service.js';

interface BroadcastCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BroadcastCampaignModal({ isOpen, onClose }: BroadcastCampaignModalProps) {
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('property_inquiry_details');
  const [minScore, setMinScore] = useState<number>(50);
  const [successResult, setSuccessResult] = useState<{ sentCount: number; totalRecipients: number } | null>(null);

  const broadcastMutation = useBroadcastCampaign();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const res = await broadcastMutation.mutateAsync({
      name: name.trim(),
      templateName,
      segment: {
        minIntentScore: minScore,
      },
    });

    setSuccessResult({ sentCount: res.sentCount, totalRecipients: res.totalRecipients });
    setTimeout(() => {
      setSuccessResult(null);
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900">New Broadcast Campaign</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {successResult ? (
          <div className="p-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center font-bold">
              ✓
            </div>
            <h4 className="text-sm font-bold text-gray-900">Broadcast Dispatched</h4>
            <p className="text-xs text-gray-600">
              Successfully sent to {successResult.sentCount} of {successResult.totalRecipients} eligible leads.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Campaign Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Q4 Luxury Launch VIP Preview"
                required
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp Template *</label>
              <select
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="property_inquiry_details">property_inquiry_details (Approved)</option>
                <option value="site_visit_invitation">site_visit_invitation (Approved)</option>
                <option value="brochure_share_followup">brochure_share_followup (Approved)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Target Segment (Min Intent Score: {minScore})
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minScore}
                onChange={e => setMinScore(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>All Leads (0)</span>
                <span>Warm Leads (35+)</span>
                <span>Hot Leads (70+)</span>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-start space-x-2 text-[11px] text-purple-900">
              <ShieldCheck className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Opt-in Safeguard:</strong> Leads who sent STOP or opted out are automatically excluded to preserve compliance.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={broadcastMutation.isPending || !name.trim()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {broadcastMutation.isPending ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
