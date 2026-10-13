import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Bot,
  Send,
  Mic,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { useSimulateInboundMessage } from '../../services/whatsapp.service.js';

interface SimulateInboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (convId: string) => void;
}

const PRESET_SCENARIOS = [
  {
    id: 'pricing_brochure',
    title: 'High-Intent 3BHK Inquiry & Brochure',
    phone: '+91 98201 11223',
    name: 'Aarav Sharma',
    text: 'Hi! What are the all-inclusive starting prices and RERA carpet areas for 3BHK units at Prestige Lakeside Habitat? Can you send the brochure?',
    isVoice: false,
    category: 'AI Auto-Reply',
  },
  {
    id: 'frustration_handoff',
    title: 'Frustrated Buyer (Sentiment Escalation)',
    phone: '+91 98450 33445',
    name: 'Neha Gupta',
    text: 'I have been waiting 3 days for my booking token receipt and cost sheet. Connect me to a manager right now, this service is terrible!',
    isVoice: false,
    category: 'Human Handoff',
  },
  {
    id: 'voice_note',
    title: 'Voice Note STT Transcription',
    phone: '+91 98111 55667',
    name: 'Vikram Patel',
    text: 'Namaste, I sent a voice note inquiring about 4BHK luxury villas and SBI home loan subvention schemes.',
    isVoice: true,
    category: 'Voice AI',
  },
  {
    id: 'site_visit',
    title: 'Site Visit Scheduling Request',
    phone: '+91 99000 88991',
    name: 'Pooja Reddy',
    text: 'Can I reserve a VIP physical walkthrough this Saturday at 11:30 AM? My family wants to inspect Tower B.',
    isVoice: false,
    category: 'Booking Tour',
  },
];

export function SimulateInboundModal({ isOpen, onClose, onSuccess }: SimulateInboundModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('pricing_brochure');
  const [phone, setPhone] = useState('+91 98201 11223');
  const [name, setName] = useState('Aarav Sharma');
  const [text, setText] = useState(
    'Hi! What are the all-inclusive starting prices and RERA carpet areas for 3BHK units at Prestige Lakeside Habitat? Can you send the brochure?',
  );
  const [isVoiceNote, setIsVoiceNote] = useState(false);
  const [result, setResult] = useState<{
    conversationId: string;
    responseSnippet?: string;
  } | null>(null);

  const simulateMutation = useSimulateInboundMessage();

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESET_SCENARIOS.find(x => x.id === presetId);
    if (p) {
      setPhone(p.phone);
      setName(p.name);
      setText(p.text);
      setIsVoiceNote(p.isVoice);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !text) return;

    try {
      const res = await simulateMutation.mutateAsync({
        phone,
        name: name || undefined,
        text,
        isVoiceNote,
      });

      setResult({
        conversationId: res.conversationId,
        responseSnippet: res.responseSnippet,
      });

      if (onSuccess && res.conversationId) {
        onSuccess(res.conversationId);
      }
    } catch {
      // Handled by react-query error state
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Simulate Inbound WhatsApp Message</h2>
              <p className="text-xs text-slate-400">
                Test 24/7 AI conversational qualification, sentiment analysis & human handoff
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSimulate} className="p-6 space-y-5 overflow-y-auto">
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">
              Select Preset Test Scenario
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                    selectedPreset === p.id
                      ? 'border-blue-500 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500'
                      : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100/70 text-gray-700'
                  }`}
                >
                  <div className="font-semibold truncate">{p.title}</div>
                  <div className="flex items-center space-x-1.5 mt-1 text-[11px] text-gray-500">
                    {p.isVoice ? (
                      <Mic className="h-3 w-3 text-purple-500" />
                    ) : (
                      <MessageSquare className="h-3 w-3 text-blue-500" />
                    )}
                    <span>{p.category}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Buyer WhatsApp Number *
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => {
                  setSelectedPreset('');
                  setPhone(e.target.value);
                }}
                required
                placeholder="+91 98765 43210"
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Buyer Contact Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => {
                  setSelectedPreset('');
                  setName(e.target.value);
                }}
                placeholder="e.g. Aarav Sharma"
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-700">Message Content *</label>
              <label className="inline-flex items-center space-x-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVoiceNote}
                  onChange={e => setIsVoiceNote(e.target.checked)}
                  className="h-3.5 w-3.5 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="flex items-center space-x-1">
                  <Mic className="h-3 w-3 text-purple-600" />
                  <span>Simulate Voice Note</span>
                </span>
              </label>
            </div>
            <textarea
              rows={3}
              value={text}
              onChange={e => {
                setSelectedPreset('');
                setText(e.target.value);
              }}
              required
              placeholder="Type inbound message text..."
              className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Result Alert */}
          {result && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 animate-in fade-in">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Message Received & Processed by PropBot AI!</span>
              </div>
              {result.responseSnippet && (
                <div className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-emerald-100 flex items-start space-x-2">
                  <Bot className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-gray-900">Bot Auto-Response: </span>
                    <span className="text-gray-600">{result.responseSnippet}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              {result ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={simulateMutation.isPending}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {simulateMutation.isPending ? 'Processing Simulation...' : 'Simulate Inbound Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
