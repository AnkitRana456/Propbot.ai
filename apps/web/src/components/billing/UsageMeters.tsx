import React from 'react';
import { Bot, MessageSquare, Cpu, Users, Smartphone, HardDrive, AlertCircle } from 'lucide-react';
import type { UsageMeters as UsageMetersType } from '@propbot/shared';

interface UsageMetersProps {
  usage?: UsageMetersType;
}

export const UsageMeters: React.FC<UsageMetersProps> = ({ usage }) => {
  if (!usage) return null;

  const meters = [
    {
      title: 'Active Chatbots',
      current: usage.chatbots.current,
      limit: usage.chatbots.limit,
      percentage: usage.chatbots.percentage,
      icon: Bot,
      color: 'bg-blue-600',
    },
    {
      title: 'Monthly Conversations',
      current: usage.conversations.current,
      limit: usage.conversations.limit,
      percentage: usage.conversations.percentage,
      icon: MessageSquare,
      color: 'bg-indigo-600',
    },
    {
      title: 'AI Tokens (Estimated)',
      current: `${(usage.aiTokens.current / 1000).toFixed(0)}k`,
      limit: `${(usage.aiTokens.limit / 1_000_000).toFixed(1)}M`,
      percentage: usage.aiTokens.percentage,
      icon: Cpu,
      color: 'bg-purple-600',
    },
    {
      title: 'Team Users',
      current: usage.users.current,
      limit: usage.users.limit,
      percentage: usage.users.percentage,
      icon: Users,
      color: 'bg-emerald-600',
    },
    {
      title: 'WhatsApp Numbers',
      current: usage.whatsappNumbers.current,
      limit: usage.whatsappNumbers.limit,
      percentage: usage.whatsappNumbers.percentage,
      icon: Smartphone,
      color: 'bg-teal-600',
    },
    {
      title: 'Storage Capacity',
      current: `${usage.storageMb.current} MB`,
      limit: `${usage.storageMb.limit} MB`,
      percentage: usage.storageMb.percentage,
      icon: HardDrive,
      color: 'bg-amber-600',
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Plan Usage & Limits</h3>
          <p className="text-xs text-slate-500">
            Current billing cycle consumption across platform quotas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        {meters.map(m => {
          const Icon = m.icon;
          const isNearLimit = m.percentage >= 80;
          return (
            <div
              key={m.title}
              className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {m.title}
                  </span>
                </div>
                {isNearLimit && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                    <AlertCircle className="w-3 h-3" />
                    Limit Near
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  {m.current}{' '}
                  <span className="font-normal text-slate-500">/ {m.limit}</span>
                </span>
                <span className="font-medium text-slate-500">{m.percentage}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    m.percentage >= 100
                      ? 'bg-rose-500'
                      : m.percentage >= 80
                        ? 'bg-amber-500'
                        : m.color
                  }`}
                  style={{ width: `${Math.min(100, m.percentage)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
