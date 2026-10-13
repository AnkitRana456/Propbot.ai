import React, { useState } from 'react';
import type { ChatbotConfig } from '@propbot/shared';
import { MessageSquareText, Plus, Trash2 } from 'lucide-react';

interface Step3GreetingProps {
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

export const Step3Greeting: React.FC<Step3GreetingProps> = ({ config, onChangeConfig }) => {
  const behavior = config.behavior || {
    systemPrompt: '',
    tone: 'luxury',
    defaultLanguage: 'en',
    supportedLanguages: ['en'],
    temperature: 0.7,
    greetingMessage:
      'Hello! Welcome to our luxury real estate showcase. How can I help you find your dream property today?',
    quickQuestions: [
      'Explore featured villas',
      'Schedule a private site visit',
      'Download pricing & brochure',
      'Check payment plan options',
    ],
  };

  const [newQuestionInput, setNewQuestionInput] = useState('');

  const updateBehavior = (updates: Partial<typeof behavior>) => {
    onChangeConfig({
      ...config,
      behavior: {
        ...behavior,
        ...updates,
      },
    });
  };

  const handleAddQuestion = () => {
    if (!newQuestionInput.trim()) return;
    const current = behavior.quickQuestions || [];
    if (current.length >= 6) return;
    updateBehavior({
      quickQuestions: [...current, newQuestionInput.trim()],
    });
    setNewQuestionInput('');
  };

  const handleRemoveQuestion = (indexToRemove: number) => {
    const current = behavior.quickQuestions || [];
    updateBehavior({
      quickQuestions: current.filter((_, idx) => idx !== indexToRemove),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Greeting & Quick Starters
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Craft an inviting welcome message and clickable suggestion pills to spark immediate
          engagement.
        </p>
      </div>

      <div className="space-y-5">
        {/* Welcome Greeting */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
            Initial Welcome Message <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={behavior.greetingMessage || ''}
            onChange={e => updateBehavior({ greetingMessage: e.target.value })}
            placeholder="Welcome message sent immediately when conversation opens..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white leading-relaxed"
          />
          <p className="text-xs text-slate-500 mt-1">
            Keep it warm, concise, and focused on helping the buyer discover suitable homes.
          </p>
        </div>

        {/* Quick Question Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Quick Prompt Chips ({behavior.quickQuestions?.length || 0}/6)
            </label>
            <span className="text-xs text-slate-400">
              Visitors can click these to ask instantly
            </span>
          </div>

          <div className="space-y-2 mb-3">
            {behavior.quickQuestions?.map((q, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 px-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {q}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(idx)}
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Remove chip"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {(behavior.quickQuestions?.length || 0) < 6 && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newQuestionInput}
                onChange={e => setNewQuestionInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddQuestion();
                  }
                }}
                placeholder="e.g. Schedule a private site visit..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Chip
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
