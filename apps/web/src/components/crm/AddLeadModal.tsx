import React, { useState } from 'react';
import { X, UserPlus, Sparkles, Phone, Mail, User, IndianRupee, MapPin } from 'lucide-react';
import { useCaptureLead } from '../../services/leads.service.js';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose }) => {
  const captureLeadMutation = useCaptureLead();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    budget: '₹1.50 Cr - ₹2.20 Cr',
    bhk: '3 BHK',
    location: 'Whitefield',
    purpose: 'End-use',
    timeline: 'Within 30 days',
    source: 'Direct Phone / Walk-in',
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      setErrorMsg('Name and Phone number are required.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await captureLeadMutation.mutateAsync({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        budget: formData.budget,
        bhk: formData.bhk,
        location: formData.location,
        purpose: formData.purpose,
        timeline: formData.timeline,
        metadata: {
          source: formData.source,
          createdBy: 'Manual Entry / Quick CRM Capture',
        },
      });

      const lead = res?.data;
      setSuccessMsg(
        `✓ Lead ${lead?.name || formData.name} added! Assigned to ${
          lead?.assignedAgentName || 'least loaded agent'
        } with ${lead?.intentScore ?? 85}% ${lead?.intentLabel ?? 'HOT'} intent.`
      );

      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
        setFormData({
          name: '',
          phone: '',
          email: '',
          budget: '₹1.50 Cr - ₹2.20 Cr',
          bhk: '3 BHK',
          location: 'Whitefield',
          purpose: 'End-use',
          timeline: 'Within 30 days',
          source: 'Direct Phone / Walk-in',
        });
      }, 1400);
    } catch (err: unknown) {
      setErrorMsg((err instanceof Error ? err.message : '') || 'Failed to create lead. Please check details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950/60 text-[#B84A22]">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add New Lead to CRM
            </h3>
            <p className="text-xs text-slate-500">
              Instantly create a prospect with Buyer DNA & AI Intent Scoring
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-600">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="email"
                placeholder="vikram@example.com"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                BHK Type
              </label>
              <select
                value={formData.bhk}
                onChange={e => setFormData(prev => ({ ...prev, bhk: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
              >
                <option value="1 BHK">1 BHK</option>
                <option value="2 BHK">2 BHK</option>
                <option value="3 BHK">3 BHK</option>
                <option value="4 BHK">4 BHK</option>
                <option value="Villa">Luxury Villa</option>
                <option value="Penthouse">Penthouse</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Budget Range
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={formData.budget}
                  onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="₹1.50 Cr - ₹2.50 Cr"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preferred Locality
              </label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Whitefield, Sarjapur"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lead Source
              </label>
              <select
                value={formData.source}
                onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#B84A22]"
              >
                <option value="Direct Phone / Walk-in">Direct Phone / Walk-in</option>
                <option value="Website Chatbot Widget">Website Chatbot Widget</option>
                <option value="WhatsApp Inbound">WhatsApp Inbound</option>
                <option value="Facebook Lead Ad">Facebook Lead Ad</option>
                <option value="99acres Portal">99acres Portal</option>
                <option value="MagicBricks Portal">MagicBricks Portal</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30 p-2.5 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#B84A22] shrink-0" />
            <span>AI will automatically score buyer intent and route to the least-busy active sales agent.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={captureLeadMutation.isPending}
              className="rounded-xl bg-[#B84A22] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#a1401d] disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {captureLeadMutation.isPending ? 'Creating Lead...' : 'Save & Route Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
