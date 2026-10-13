import React from 'react';
import type { ChatbotConfig, BusinessDay } from '@propbot/shared';
import { Clock, Globe, Moon, Mail, Phone } from 'lucide-react';

interface Step6BusinessHoursProps {
  config: ChatbotConfig;
  onChangeConfig: (config: ChatbotConfig) => void;
}

const COMMON_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST +4:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +8:00)' },
];

const DAYS: { key: BusinessDay['day']; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export const Step6BusinessHours: React.FC<Step6BusinessHoursProps> = ({
  config,
  onChangeConfig,
}) => {
  const businessHours = config.businessHours || {
    enabled: false,
    timezone: 'Asia/Kolkata',
    schedule: [
      { day: 'mon', enabled: true, start: '09:00', end: '19:00' },
      { day: 'tue', enabled: true, start: '09:00', end: '19:00' },
      { day: 'wed', enabled: true, start: '09:00', end: '19:00' },
      { day: 'thu', enabled: true, start: '09:00', end: '19:00' },
      { day: 'fri', enabled: true, start: '09:00', end: '19:00' },
      { day: 'sat', enabled: true, start: '10:00', end: '17:00' },
      { day: 'sun', enabled: false, start: '10:00', end: '17:00' },
    ],
    offlineMessage:
      'Our sales office is currently closed. Leave your contact info and our property advisor will connect with you first thing tomorrow!',
    fallbackEmail: '',
    fallbackPhone: '',
  };

  const updateBusinessHours = (updates: Partial<typeof businessHours>) => {
    onChangeConfig({
      ...config,
      businessHours: {
        ...businessHours,
        ...updates,
      },
    });
  };

  const updateDaySchedule = (dayKey: BusinessDay['day'], updates: Partial<BusinessDay>) => {
    const currentSchedule = businessHours.schedule || [];
    const existingIndex = currentSchedule.findIndex(d => d.day === dayKey);

    let newSchedule: BusinessDay[];
    if (existingIndex >= 0) {
      newSchedule = currentSchedule.map(d => (d.day === dayKey ? { ...d, ...updates } : d));
    } else {
      newSchedule = [
        ...currentSchedule,
        { day: dayKey, enabled: true, start: '09:00', end: '18:00', ...updates },
      ];
    }

    updateBusinessHours({ schedule: newSchedule });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Business Hours & Fallback
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Set agency operating schedules and custom out-of-office automated notifications.
        </p>
      </div>

      <div className="space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div>
            <span className="font-bold text-sm text-slate-900 dark:text-white block">
              Enforce Business Hours
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              When enabled, visitors chatting outside schedule receive out-of-office notices.
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={businessHours.enabled ?? false}
              onChange={e => updateBusinessHours({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
          </label>
        </div>

        {businessHours.enabled && (
          <>
            {/* Timezone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-blue-600" />
                <span>Operating Timezone</span>
              </label>
              <select
                value={businessHours.timezone || 'Asia/Kolkata'}
                onChange={e => updateBusinessHours({ timezone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Schedule Table */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 space-y-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                Weekly Timetable
              </span>

              {DAYS.map(day => {
                const dayConfig = businessHours.schedule?.find(d => d.day === day.key) || {
                  day: day.key,
                  enabled: true,
                  start: '09:00',
                  end: '19:00',
                };

                return (
                  <div
                    key={day.key}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-b-0 dark:border-slate-800/60"
                  >
                    <div className="flex items-center gap-2 w-32">
                      <input
                        type="checkbox"
                        checked={dayConfig.enabled}
                        onChange={e => updateDaySchedule(day.key, { enabled: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {day.label}
                      </span>
                    </div>

                    {dayConfig.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayConfig.start}
                          onChange={e => updateDaySchedule(day.key, { start: e.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                          type="time"
                          value={dayConfig.end}
                          onChange={e => updateDaySchedule(day.key, { end: e.target.value })}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Closed</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Offline Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-blue-600" />
                <span>Out-Of-Office Greeting</span>
              </label>
              <textarea
                rows={2}
                value={businessHours.offlineMessage || ''}
                onChange={e => updateBusinessHours({ offlineMessage: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Fallback Channels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>Escalation Email</span>
                </label>
                <input
                  type="email"
                  value={businessHours.fallbackEmail || ''}
                  onChange={e => updateBusinessHours({ fallbackEmail: e.target.value })}
                  placeholder="sales@prestige.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>Direct Hotline</span>
                </label>
                <input
                  type="tel"
                  value={businessHours.fallbackPhone || ''}
                  onChange={e => updateBusinessHours({ fallbackPhone: e.target.value })}
                  placeholder="+91 80 2559 1080"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
