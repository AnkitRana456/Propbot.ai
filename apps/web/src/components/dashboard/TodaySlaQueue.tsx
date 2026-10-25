import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Clock, Phone, MessageSquare, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';

export interface HotLeadItem {
  id: string;
  name: string;
  phone: string;
  score: number;
  project: string;
  bhk: string;
  budget: string;
  slaMinutesRemaining: number;
  timeAgo: string;
}

export interface TodaySlaQueueProps {
  hotLeads?: HotLeadItem[];
  onSelectLead?: (leadId: string) => void;
}

export const TodaySlaQueue: React.FC<TodaySlaQueueProps> = ({
  hotLeads = [],
  onSelectLead,
}) => {
  return (
    <Card radius="xl" className="p-5 border-amber-200/80 dark:border-amber-900/40">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Hot Leads SLA Queue
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Immediate call response required to maintain 85%+ visit conversion rate.
            </p>
          </div>
        </div>

        <Link
          to="/leads"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          <span>All Leads</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {hotLeads.map(lead => {
          const isUrgent = lead.slaMinutesRemaining <= 5;
          return (
            <div
              key={lead.id}
              className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isUrgent
                  ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/80 hover:border-amber-300 dark:hover:border-amber-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center justify-center h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                  <span className="text-xs font-black font-display">{lead.score}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider">Score</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {lead.name}
                    </span>
                    <Badge variant="gold" size="sm">
                      {lead.bhk}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{lead.project}</span>
                    <span>&bull;</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {lead.budget}
                    </span>
                    <span>&bull;</span>
                    <span className="text-[11px] text-slate-400">{lead.timeAgo}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* SLA Timer */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    isUrgent
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>SLA: {lead.slaMinutesRemaining}m left</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${lead.phone}`}
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                    title={`Call ${lead.name}`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition"
                    title={`WhatsApp ${lead.name}`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </a>
                  {onSelectLead && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectLead(lead.id)}
                    >
                      Brief
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
