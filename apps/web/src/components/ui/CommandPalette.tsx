import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bot,
  UserCheck,
  Calendar,
  Building,
  Settings,
  HelpCircle,
  Sparkles,
  ArrowRight,
  X,
  CreditCard,
  MessageSquare,
} from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Tools';
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  shortcut?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Today Overview',
      category: 'Navigation',
      icon: <Sparkles className="h-4 w-4 text-blue-500" />,
      path: '/dashboard',
    },
    {
      id: 'nav-leads',
      title: 'View CRM Leads & Buyer DNA',
      category: 'Navigation',
      icon: <UserCheck className="h-4 w-4 text-amber-500" />,
      path: '/leads',
    },
    {
      id: 'nav-chatbots',
      title: 'Configure AI Chatbots',
      category: 'Navigation',
      icon: <Bot className="h-4 w-4 text-blue-500" />,
      path: '/chatbots',
    },
    {
      id: 'nav-whatsapp',
      title: 'Open WhatsApp Inbox',
      category: 'Navigation',
      icon: <MessageSquare className="h-4 w-4 text-teal-500" />,
      path: '/whatsapp',
    },
    {
      id: 'nav-appointments',
      title: 'View Site Visits & Appointments',
      category: 'Navigation',
      icon: <Calendar className="h-4 w-4 text-blue-500" />,
      path: '/appointments',
    },
    {
      id: 'nav-properties',
      title: 'Manage Property Inventory & Units',
      category: 'Navigation',
      icon: <Building className="h-4 w-4 text-indigo-500" />,
      path: '/properties',
    },
    {
      id: 'nav-subscription',
      title: 'Manage Subscription & Limits',
      category: 'Navigation',
      icon: <CreditCard className="h-4 w-4 text-rose-500" />,
      path: '/subscription',
    },
    {
      id: 'nav-settings',
      title: 'Open Settings & Integrations Vault',
      category: 'Navigation',
      icon: <Settings className="h-4 w-4 text-slate-500" />,
      path: '/settings',
    },
    {
      id: 'nav-design',
      title: 'Aurora Estate Design System Showcase',
      category: 'Navigation',
      icon: <Sparkles className="h-4 w-4 text-teal-500" />,
      path: '/design',
    },
    // Actions
    {
      id: 'act-new-bot',
      title: 'Create New AI Real Estate Assistant',
      category: 'Actions',
      icon: <Bot className="h-4 w-4 text-blue-500" />,
      path: '/chatbots/new',
    },
    {
      id: 'act-help',
      title: 'Help Center & Documentation',
      category: 'Tools',
      icon: <HelpCircle className="h-4 w-4 text-slate-400" />,
      path: '/help',
    },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open handled by caller or state
        }
      }
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  const executeCommand = (cmd: CommandItem) => {
    onClose();
    if (cmd.path) {
      navigate(cmd.path);
    } else if (cmd.action) {
      cmd.action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, lead, chatbot or page..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching destinations or commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <span>{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cmd.category}
                    </span>
                    {isSelected && <ArrowRight className="h-3.5 w-3.5" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-400">
          <span>Navigate with &uarr;&darr;</span>
          <span>Select with &crarr;</span>
          <span>Close with ESC</span>
        </div>
      </div>
    </div>
  );
};
