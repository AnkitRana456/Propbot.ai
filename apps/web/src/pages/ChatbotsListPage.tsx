import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { ChatbotResponse, ChatbotStatus } from '@propbot/shared';
import {
  useChatbots,
  useUpdateChatbotStatus,
  useDuplicateChatbot,
  useDeleteChatbot,
  useRotateKey,
} from '../services/chatbots.service.js';
import { Bot, Plus, Search, Globe, MessageSquare, Copy, Check, MoreVertical, Settings, Sparkles, RefreshCw, Trash2, Code2, Database, Users, MessageCircle, LayoutGrid, Table as TableIcon, X, Play, Pause, AlertCircle, ArrowUpRight } from 'lucide-react';

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
      {/* Top Header Banner with 3D Depth */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-slate-50/50 to-orange-50/20 p-6 shadow-card dark:border-slate-800/90 dark:from-slate-900 dark:via-slate-900/90 dark:to-orange-950/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Real Estate Chatbots
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-[#B84A22] border border-orange-200 dark:border-orange-800/60 dark:text-orange-300 shadow-xs">
                <Sparkles className="h-3 w-3 text-[#B84A22] dark:text-orange-400" />
                <span>{totalBots} Deployed</span>
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-sans">
              Build, brand, and deploy AI assistants across your property websites and WhatsApp channels.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/chatbots/new')}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2.5 text-xs font-bold text-white shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Chatbot</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Bar with 3D Card Depth */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Total Assistants</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-slate-900 dark:text-white">{totalBots}</div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">Configured for agency</span>
        </div>

        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Active Deployments</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeBots}
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">
            Live and qualifying buyers
          </span>
        </div>

        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Leads Captured</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-slate-900 dark:text-white">{totalLeads}</div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">
            Verified prospect contacts
          </span>
        </div>

        <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Conversations</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <MessageCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="font-serif text-3xl font-bold text-slate-900 dark:text-white">
            {totalConversations}
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1 block">Total chats handled</span>
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
            className="w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B84A22] focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-white shadow-xs transition-all"
          />
        </div>

        {/* Filter Tabs & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-700/80 dark:bg-slate-800/80 shadow-xs">
            {(['all', 'active', 'paused', 'draft'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-all duration-200 cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white'
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
            className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-xs focus:outline-none focus:ring-2 focus:ring-[#B84A22]/30"
          >
            <option value="all">All Platforms</option>
            <option value="web">Website Widget</option>
            <option value="whatsapp">WhatsApp AI</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-700/80 dark:bg-slate-800/80 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-card dark:bg-slate-900 dark:text-white'
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
          <div className="h-16 w-16 rounded-2xl bg-orange-50 text-[#B84A22] dark:bg-orange-950/60 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">No Chatbots Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            Get started by launching our wizard to create your first intelligent property sales bot.
          </p>
          <button
            type="button"
            onClick={() => navigate('/chatbots/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-5 py-2.5 text-xs font-bold text-white shadow-button hover:shadow-button-hover transition-all"
          >
            <Plus className="h-4 w-4" />
            Launch Wizard
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW WITH 3D DEPTH */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {chatbots.map(bot => {
            const primaryColor = bot.config?.appearance?.primaryColor || '#B84A22';
            const botTitle = bot.config?.appearance?.botName || bot.name;

            return (
              <div
                key={bot.id}
                className="group relative rounded-2xl border border-slate-200/90 bg-white/95 p-5 dark:border-slate-800 dark:bg-slate-900/95 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card-hover flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        style={{ backgroundColor: primaryColor }}
                        className="h-11 w-11 rounded-xl text-white flex items-center justify-center shadow-card shrink-0"
                      >
                        {bot.type === 'web' ? (
                          <Globe className="h-5 w-5" />
                        ) : (
                          <MessageSquare className="h-5 w-5" />
                        )}
                      </div>
                      <div className="truncate min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/chatbots/${bot.id}/edit`)}
                          className="font-serif font-bold text-sm text-slate-900 dark:text-white truncate text-left hover:text-[#B84A22] dark:hover:text-orange-400 transition-colors block max-w-full cursor-pointer"
                        >
                          {bot.name}
                        </button>
                        <span className="text-[11px] font-mono text-slate-400 truncate block">
                          {botTitle}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill & Action Menu */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(bot)}
                        title={`Click to toggle: ${bot.status}`}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1 cursor-pointer ${
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
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {activeMenuId === bot.id && (
                          <div className="absolute right-0 top-7 z-30 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/chatbots/${bot.id}/training`);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 font-medium cursor-pointer"
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
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              Bot Settings
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEmbedModalBot(bot);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <Code2 className="h-3.5 w-3.5" />
                              Get Embed Code
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(bot.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate Bot
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRotateKey(bot.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 cursor-pointer"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Rotate Public Key
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                            <button
                              type="button"
                              onClick={() => handleDelete(bot.id)}
                              className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 cursor-pointer"
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
                  <div className="rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between mb-4 shadow-2xs">
                    <div className="truncate pr-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Public Key
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 truncate block">
                        {bot.publicKey}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(bot.publicKey, bot.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      title="Copy public key"
                    >
                      {copiedKey === bot.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Whitelisted Domains */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Whitelisted Domains:
                    </span>{' '}
                    {bot.allowedDomains && bot.allowedDomains.length > 0
                      ? bot.allowedDomains.join(', ')
                      : 'All domains allowed (*)'}
                  </div>
                </div>

                {/* Card Footer: Metrics & Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span title="Leads Captured" className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <strong className="text-slate-900 dark:text-white">{bot.leadsCount || 0}</strong>
                    </span>
                    <span title="Conversations" className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                      <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
                      <strong className="text-slate-900 dark:text-white">{bot.conversationsCount || 0}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEmbedModalBot(bot)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-xs hover:border-[#B84A22] hover:text-[#B84A22] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-orange-400 transition-all cursor-pointer"
                    >
                      <Code2 className="h-3 w-3" />
                      <span>Embed</span>
                    </button>
                    <Link
                      to={`/chatbots/${bot.id}/edit`}
                      className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-[#B84A22] dark:bg-slate-800 dark:hover:bg-[#B84A22] transition-all"
                    >
                      <span>Configure</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900 shadow-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/90 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4">Chatbot</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Public Key</th>
                <th className="py-3.5 px-4">Leads</th>
                <th className="py-3.5 px-4">Conversations</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
              {chatbots.map(bot => (
                <tr key={bot.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-serif font-semibold text-xs text-slate-900 dark:text-white block">
                      {bot.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {bot.config?.appearance?.botName || 'PropBot'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono uppercase text-slate-600 dark:text-slate-300">
                    {bot.type}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        bot.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {bot.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{bot.publicKey}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {bot.leadsCount || 0}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {bot.conversationsCount || 0}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/chatbots/${bot.id}/training`)}
                      className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 font-bold cursor-pointer"
                    >
                      Knowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/chatbots/${bot.id}/edit`)}
                      className="text-[#B84A22] hover:text-[#9c3e1c] dark:text-orange-400 font-bold cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmbedModalBot(bot)}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer"
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

      {/* Embed Code Modal with Glassmorphism */}
      {embedModalBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-[#B84A22] dark:bg-orange-500/20 dark:text-orange-400">
                  <Code2 className="h-4 w-4" />
                </div>
                <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white">
                  Embed: {embedModalBot.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmbedModalBot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copy and paste this snippet into the HTML of your website, right before the closing{' '}
                <code className="text-[#B84A22] dark:text-orange-400 font-mono font-bold">&lt;/body&gt;</code> tag.
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
                  className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-[#B84A22] transition-colors cursor-pointer"
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
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Installation Guides:
                </span>
                <div className="flex gap-3 text-[#B84A22] dark:text-orange-400 font-medium">
                  <span className="cursor-pointer hover:underline">WordPress</span>
                  <span className="cursor-pointer hover:underline">Webflow</span>
                  <span className="cursor-pointer hover:underline">React / Next.js</span>
                  <span className="cursor-pointer hover:underline">Shopify</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <Link
                to={`/chatbots/${embedModalBot.id}/training`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B84A22] dark:text-orange-400 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Open RAG Test Studio
              </Link>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Link
                  to={`/chatbots/${embedModalBot.id}/edit`}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                >
                  Configure Widget
                </Link>
                <button
                  type="button"
                  onClick={() => setEmbedModalBot(null)}
                  className="rounded-xl bg-gradient-to-r from-[#B84A22] to-[#c75528] px-4 py-2 text-xs font-bold text-white shadow-button hover:shadow-button-hover transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotsListPage;
