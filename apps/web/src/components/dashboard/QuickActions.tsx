import React from 'react';
import { PlusCircle, Bot, CalendarPlus, GitBranch, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: 'Create Chatbot',
      description: 'Scaffold an 8-step AI concierge or WhatsApp bot',
      icon: Bot,
      accent:
        'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
      action: () => navigate('/chatbots'),
    },
    {
      title: 'WhatsApp Bot',
      description: 'Connect automated 24/7 WhatsApp auto-reply',
      icon: PlusCircle,
      accent:
        'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
      action: () => navigate('/whatsapp'),
    },
    {
      title: 'Book Site Visit',
      description: 'Schedule a physical luxury property tour',
      icon: CalendarPlus,
      accent:
        'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60',
      action: () => navigate('/appointments'),
    },
    {
      title: 'Buyer DNA Pipeline',
      description: 'Analyze budget, intent score & preferences',
      icon: GitBranch,
      accent:
        'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
      action: () => navigate('/leads'),
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Quick Actions</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rapid launch workflows for brokers, managers and admins
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          <Sparkles className="h-2.5 w-2.5 text-blue-500" />
          Fast Track
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(act => {
          const Icon = act.icon;
          return (
            <button
              key={act.title}
              onClick={act.action}
              className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${act.accent}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </div>

              <div className="mt-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {act.title}
                </span>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {act.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
