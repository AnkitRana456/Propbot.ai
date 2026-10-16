import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Sparkles, Key, Bot, Code, Flame } from 'lucide-react';
import { Card } from '../ui/Card.js';

export interface TodayChecklistProps {
  isAiConnected: boolean;
  hasChatbot: boolean;
  hasTrainedKnowledge: boolean;
  hasCapturedLead: boolean;
}

export const TodayChecklist: React.FC<TodayChecklistProps> = ({
  isAiConnected,
  hasChatbot,
  hasTrainedKnowledge,
  hasCapturedLead,
}) => {
  const steps = [
    {
      id: 'step-keys',
      title: '1. Connect Real AI Keys',
      desc: 'Set Gemini/OpenAI key in Settings',
      completed: isAiConnected,
      link: '/settings',
      icon: Key,
    },
    {
      id: 'step-bot',
      title: '2. Provision Chatbot',
      desc: 'Create sales assistant & prompt',
      completed: hasChatbot,
      link: '/chatbots/new',
      icon: Bot,
    },
    {
      id: 'step-train',
      title: '3. Upload Knowledge',
      desc: 'Ingest RERA brochure & FAQs',
      completed: hasTrainedKnowledge,
      link: '/chatbots',
      icon: Sparkles,
    },
    {
      id: 'step-embed',
      title: '4. Embed Chat Widget',
      desc: 'Copy script onto your website',
      completed: true,
      link: '/chatbots',
      icon: Code,
    },
    {
      id: 'step-lead',
      title: '5. Capture First Hot Lead',
      desc: 'Verify visitor-to-CRM journey',
      completed: hasCapturedLead,
      link: '/leads',
      icon: Flame,
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const allCompleted = completedCount === steps.length;

  if (allCompleted) return null;

  return (
    <Card radius="xl" className="p-5 border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Agency Launch Checklist ({completedCount}/{steps.length} Complete)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete these 5 steps to activate 24/7 autonomous lead qualification and CRM delivery.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {steps.map(s => {
          const Icon = s.icon;
          return (
            <Link
              key={s.id}
              to={s.link}
              className={`p-3 rounded-xl border transition flex flex-col justify-between ${
                s.completed
                  ? 'border-teal-200 bg-teal-50/60 dark:border-teal-900/40 dark:bg-teal-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`p-1.5 rounded-lg ${
                    s.completed
                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {s.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="mt-2.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {s.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {s.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};
