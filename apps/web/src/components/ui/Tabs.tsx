import React, { useId, useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}

/** WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends. Render the content with <TabPanel>. */
export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, label = 'Sections', className = '' }) => {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let target = -1;
    if (e.key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = tabs.length - 1;
    if (target >= 0) {
      e.preventDefault();
      onChange(tabs[target]!.id);
      refs.current[target]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={label} className={`flex flex-wrap gap-1 border-b border-border ${className}`}>
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={el => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${active ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'}`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold text-text-muted">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel: React.FC<{ id: string; value: string; children: React.ReactNode; className?: string }> = ({ id, value, children, className = '' }) =>
  id === value ? (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  ) : null;
