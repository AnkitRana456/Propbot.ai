import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatbotResponse, ChatbotStatus } from '@propbot/shared';
import {
  useChatbots,
  useUpdateChatbotStatus,
  useDuplicateChatbot,
  useDeleteChatbot,
  useRotateKey,
} from '../services/chatbots.service.js';
import {
  Bot,
  Plus,
  Search,
  Globe,
  MessageSquare,
  Copy,
  Check,
  MoreVertical,
  Settings,
  Sparkles,
  RefreshCw,
  Trash2,
  Code2,
  Database,
  Users,
  MessageCircle,
  LayoutGrid,
  Table as TableIcon,
  X,
  Play,
  Pause,
  AlertCircle,
} from 'lucide-react';

export const ChatbotsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'web' | 'whatsapp'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Embed Modal State
  const [embedModalBot, setEmbedModalBot] = useState<ChatbotResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Active action menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // TanStack Query
  const { data, isLoading, error } = useChatbots({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  });

  const updateStatusMutation = useUpdateChatbotStatus();
  const duplicateMutation = useDuplicateChatbot();
  const deleteMutation = useDeleteChatbot();
  const rotateKeyMutation = useRotateKey();

  const chatbots = data?.chatbots || [];

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleStatus = (bot: ChatbotResponse) => {
    const nextStatus: ChatbotStatus = bot.status === 'active' ? 'paused' : 'active';
    updateStatusMutation.mutate({ id: bot.id, status: nextStatus });
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id);
    setActiveMenuId(null);
  };

  const handleDelete = (id: string) => {
    if (
      confirm(
        'Are you sure you want to delete this chatbot? It will be removed from your dashboard.',
      )
    ) {
      deleteMutation.mutate(id);
      setActiveMenuId(null);
    }
  };

  const handleRotateKey = (id: string) => {
    if (
      confirm(
        'Rotating this key will immediately invalidate the current embed script. Are you sure?',
      )
    ) {
      rotateKeyMutation.mutate(id);
      setActiveMenuId(null);
    }
  };

  // Metrics
  const totalBots = chatbots.length;
  const activeBots = chatbots.filter(b => b.status === 'active').length;
  const totalLeads = chatbots.reduce((acc, b) => acc + (b.leadsCount || 0), 0);
  const totalConversations = chatbots.reduce((acc, b) => acc + (b.conversationsCount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Real Estate Chatbots
            </h1>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {totalBots} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Build, brand, and deploy AI assistants across your property websites and WhatsApp
            channels.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/chatbots/new')}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Chatbot
        </button>
      </div>

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Assistants</span>
            <Bot className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalBots}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Configured for agency</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Deployments</span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeBots}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Live and qualifying buyers
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Leads Captured</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalLeads}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Verified prospect contacts
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Conversations</span>
            <MessageCircle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalConversations}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Total chats handled</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chatbots by name..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white shadow-xs"
          />
        </div>

        {/* Filter Tabs & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            {(['all', 'active', 'paused', 'draft'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all ${
                  statusFilter === tab
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Platform Selector */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as 'all' | 'web' | 'whatsapp')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-xs focus:outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="web">Website Widget</option>
            <option value="whatsapp">WhatsApp AI</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Table view"
            >
              <TableIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content State Handling */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-slate-200 bg-white p-5 animate-pulse dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-rose-600" />
          <p className="font-bold">Failed to load chatbots</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      ) : chatbots.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Chatbots Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            Get started by launching our 8-step wizard to create your first intelligent property
            sales bot.
          </p>
          <button
            type="button"
            onClick={() => navigate('/chatbots/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            Launch 8-Step Wizard
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {chatbots.map(bot => {
            const primaryColor = bot.config?.appearance?.primaryColor || '#059669';
            const botTitle = bot.config?.appearance?.botName || bot.name;

            return (
              <div
                key={bot.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        style={{ backgroundColor: primaryColor }}
                        className="h-10 w-10 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0"
                      >
                        {bot.type === 'web' ? (
                          <Globe className="h-5 w-5" />
                        ) : (
                          <MessageSquare className="h-5 w-5" />
                        )}
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {bot.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 truncate block">
                          {botTitle}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill & Action Menu */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(bot)}
                        title={`Click to toggle: ${bot.status}`}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                          bot.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : bot.status === 'paused'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {bot.status === 'active' && <Play className="h-2.5 w-2.5 fill-current" />}
                        {bot.status === 'paused' && <Pause className="h-2.5 w-2.5 fill-current" />}
                        {bot.status}
                      </button>

                      {/* Dropdown Menu Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === bot.id ? null : bot.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {activeMenuId === bot.id && (
                          <div className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/chatbots/${bot.id}/training`);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 font-medium"
                            >
                              <Database className="h-3.5 w-3.5 text-emerald-600" />
                              Knowledge Base & RAG
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/chatbots/${bot.id}/edit`);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              Edit Settings
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/chatbots/${bot.id}/wizard`);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Open in Wizard
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEmbedModalBot(bot);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              <Code2 className="h-3.5 w-3.5" />
                              Get Embed Code
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(bot.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate Bot
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRotateKey(bot.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Rotate Public Key
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                            <button
                              type="button"
                              onClick={() => handleDelete(bot.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Chatbot
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Public Key Display */}
                  <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between mb-4">
                    <div className="truncate pr-2">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                        Public Key
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {bot.publicKey}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(bot.publicKey, bot.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="Copy public key"
                    >
                      {copiedKey === bot.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Allowed Domains snippet */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Whitelisted Domains:
                    </span>{' '}
                    {bot.allowedDomains && bot.allowedDomains.length > 0
                      ? `${bot.allowedDomains.length} domains (${bot.allowedDomains[0]}${
                          bot.allowedDomains.length > 1 ? '...' : ''
                        })`
                      : 'All domains permitted (Test mode)'}
                  </div>
                </div>

                {/* Card Footer: Metrics & Embed CTA */}
                <div className="border-t border-slate-100 pt-3 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-blue-500" />
                      <strong className="text-slate-900 dark:text-white">
                        {bot.leadsCount || 0}
                      </strong>{' '}
                      leads
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                      <strong className="text-slate-900 dark:text-white">
                        {bot.conversationsCount || 0}
                      </strong>{' '}
                      chats
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/chatbots/${bot.id}/training`)}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                    >
                      <Database className="h-3.5 w-3.5" />
                      Knowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedModalBot(bot)}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      Embed
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider dark:bg-slate-800/60 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Chatbot</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Public Key</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Chats</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {chatbots.map(bot => (
                <tr key={bot.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{bot.name}</td>
                  <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-300">
                    {bot.type === 'web' ? 'Website' : 'WhatsApp'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        bot.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : bot.status === 'paused'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {bot.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{bot.publicKey}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {bot.leadsCount || 0}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {bot.conversationsCount || 0}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/chatbots/${bot.id}/training`)}
                      className="text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                      Knowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/chatbots/${bot.id}/edit`)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedModalBot(bot)}
                      className="text-slate-500 hover:text-slate-800 font-medium"
                    >
                      Embed
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Embed Code Modal */}
      {embedModalBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Embed: {embedModalBot.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmbedModalBot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copy and paste this snippet into the HTML of your website, right before the closing{' '}
                <code className="text-blue-600">&lt;/body&gt;</code> tag.
              </p>

              <div className="rounded-xl bg-slate-950 p-3.5 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800 relative group">
                <pre>{`<!-- PropBot Pro AI Real Estate Widget -->
<script
  src="https://cdn.propbotpro.com/widget.js"
  data-propbot-key="${embedModalBot.publicKey}"
  async
></script>`}</pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`<!-- PropBot Pro AI Real Estate Widget -->
<script
  src="https://cdn.propbotpro.com/widget.js"
  data-propbot-key="${embedModalBot.publicKey}"
  async
></script>`);
                    setCopiedKey('modal');
                    setTimeout(() => setCopiedKey(null), 2000);
                  }}
                  className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                >
                  {copiedKey === 'modal' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Installation Guides:
                </span>
                <div className="flex gap-3 text-blue-600 dark:text-blue-400 font-medium">
                  <span className="cursor-pointer hover:underline">WordPress</span>
                  <span className="cursor-pointer hover:underline">Webflow</span>
                  <span className="cursor-pointer hover:underline">React / Next.js</span>
                  <span className="cursor-pointer hover:underline">Shopify</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setEmbedModalBot(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
