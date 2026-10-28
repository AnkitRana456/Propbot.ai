import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Inbox,
  Database,
  Layers,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { useChatbot } from '../services/chatbots.service.js';
import { knowledgeService } from '../services/knowledge.service.js';
import { SourceList } from '../components/knowledge/SourceList.js';
import { AddSourceModal } from '../components/knowledge/AddSourceModal.js';
import { QaOverridesModal } from '../components/knowledge/QaOverridesModal.js';
import { UnansweredInboxModal } from '../components/knowledge/UnansweredInboxModal.js';
import { TestChatWidget } from '../components/knowledge/TestChatWidget.js';
import type { QaPair, RagQueryResponse } from '@propbot/shared';

export const ChatbotTrainingPage: React.FC = () => {
  const { id: chatbotId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Modal open states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isOverridesModalOpen, setIsOverridesModalOpen] = useState(false);
  const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
  const [prefilledQuestion, setPrefilledQuestion] = useState('');
  const [retrainingId, setRetrainingId] = useState<string | null>(null);

  // 1. Fetch Chatbot Details
  const { data: chatbot, isLoading: isChatbotLoading } = useChatbot(chatbotId);

  // 2. Fetch Knowledge Sources
  const { data: sourcesData, isLoading: isSourcesLoading } = useQuery({
    queryKey: ['knowledgeSources', chatbotId],
    queryFn: () => knowledgeService.listSources(chatbotId!),
    enabled: !!chatbotId,
    refetchInterval: query => {
      // Poll every 3 seconds if any source is queued or processing
      const hasPending = query.state.data?.sources.some(
        s => s.status === 'processing' || s.status === 'queued',
      );
      return hasPending ? 3000 : false;
    },
  });

  // 3. Fetch Overrides
  const { data: overrides = [] } = useQuery({
    queryKey: ['qaOverrides', chatbotId],
    queryFn: () => knowledgeService.listQaOverrides(chatbotId!),
    enabled: !!chatbotId,
  });

  // 4. Fetch Unanswered Questions
  const { data: unanswered = [] } = useQuery({
    queryKey: ['unanswered', chatbotId],
    queryFn: () => knowledgeService.listUnanswered(chatbotId!),
    enabled: !!chatbotId,
  });

  // Mutations
  const textMutation = useMutation({
    mutationFn: (input: { title: string; content: string }) =>
      knowledgeService.createTextSource(chatbotId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] });
    },
  });

  const qaMutation = useMutation({
    mutationFn: (input: { title: string; pairs: QaPair[] }) =>
      knowledgeService.createQaSource(chatbotId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] });
    },
  });

  const crawlMutation = useMutation({
    mutationFn: (input: { title: string; url: string; maxPages: number; maxDepth: number }) =>
      knowledgeService.createCrawlSource(chatbotId!, {
        title: input.title,
        url: input.url,
        config: {
          maxPages: input.maxPages,
          maxDepth: input.maxDepth,
          sameDomainOnly: true,
          respectRobotsTxt: true,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] });
    },
  });

  const fileMutation = useMutation({
    mutationFn: (input: { title: string; file: File }) =>
      knowledgeService.uploadFileSource(chatbotId!, input.file, input.title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] });
    },
  });

  const retrainMutation = useMutation({
    mutationFn: (sourceId: string) => knowledgeService.reTrainSource(chatbotId!, sourceId),
    onMutate: sourceId => setRetrainingId(sourceId),
    onSettled: () => {
      setRetrainingId(null);
      queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => knowledgeService.deleteSource(chatbotId!, sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] });
    },
  });

  const addOverrideMutation = useMutation({
    mutationFn: (input: { question: string; answer: string }) =>
      knowledgeService.createQaOverride(chatbotId!, {
        question: input.question,
        answer: input.answer,
        source: 'correction',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qaOverrides', chatbotId] });
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: (overrideId: string) => knowledgeService.deleteQaOverride(chatbotId!, overrideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qaOverrides', chatbotId] });
    },
  });

  const resolveUnansweredMutation = useMutation({
    mutationFn: (input: { questionId: string; answer: string }) =>
      knowledgeService.resolveUnanswered(chatbotId!, input.questionId, input.answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unanswered', chatbotId] });
      queryClient.invalidateQueries({ queryKey: ['qaOverrides', chatbotId] });
    },
  });

  const handleTestQuery = async (
    query: string,
    history: Array<{ role: 'visitor' | 'assistant'; content: string }>,
    visitorName?: string,
  ): Promise<RagQueryResponse> => {
    return knowledgeService.testQuery(chatbotId!, { query, history, visitorName });
  };

  const handleOpenCorrect = (question: string) => {
    setPrefilledQuestion(question);
    setIsOverridesModalOpen(true);
  };

  const sources = sourcesData?.sources || [];
  const totalChunks = sources.reduce((acc, s) => acc + (s.chunkCount || 0), 0);
  const pendingUnansweredCount = unanswered.filter(u => u.status === 'pending').length;

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link to="/chatbots" className="hover:text-slate-800 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Chatbots
            </Link>
            <span>/</span>
            <span className="text-slate-700">{chatbot?.name || 'Agent'}</span>
            <span>/</span>
            <span className="text-emerald-700">Knowledge Base & RAG</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span>Knowledge Base Training</span>
            {chatbot?.status && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {chatbot.status}
              </span>
            )}
          </h1>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsOverridesModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Priority Overrides</span>
            {overrides.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
                {overrides.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsInboxModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Inbox className="w-4 h-4 text-blue-600" />
            <span>Unanswered Inbox</span>
            {pendingUnansweredCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                {pendingUnansweredCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Knowledge Source
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{sources.length}</div>
            <div className="text-xs text-slate-500 font-medium">Knowledge Sources</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{totalChunks}</div>
            <div className="text-xs text-slate-500 font-medium">Indexed Chunks</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">Task Router</div>
            <div className="text-xs text-slate-500 font-medium">Tiered LLM & Embeddings</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-700">Strict Anti-Hallucination</div>
            <div className="text-xs text-slate-500 font-medium">Grounded RAG Guardrails</div>
          </div>
        </div>
      </div>

      {/* Split-Screen Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Sources Management (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Ground Truth Sources
              </h2>
              <p className="text-xs text-slate-500">
                Documents and FAQs your AI agent references when answering visitor questions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['knowledgeSources', chatbotId] })}
              title="Refresh source statuses"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <SourceList
            sources={sources}
            isLoading={isSourcesLoading || isChatbotLoading}
            onRetrain={sourceId => retrainMutation.mutate(sourceId)}
            onDelete={sourceId => deleteMutation.mutate(sourceId)}
            retrainingId={retrainingId}
          />
        </div>

        {/* Right Side: Interactive Live Test RAG Widget (5 cols) */}
        <div className="lg:col-span-5 h-[640px] sticky top-6">
          <TestChatWidget
            onTestQuery={handleTestQuery}
            onCorrectAnswer={handleOpenCorrect}
            botName={chatbot?.name || 'Agent'}
          />
        </div>
      </div>

      {/* Modals */}
      <AddSourceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmitText={async (title, content) => {
          await textMutation.mutateAsync({ title, content });
        }}
        onSubmitQa={async (title, pairs) => {
          await qaMutation.mutateAsync({ title, pairs });
        }}
        onSubmitCrawl={async (title, url, maxPages, maxDepth) => {
          await crawlMutation.mutateAsync({ title, url, maxPages, maxDepth });
        }}
        onSubmitFile={async (title, file) => {
          await fileMutation.mutateAsync({ title, file });
        }}
      />

      <QaOverridesModal
        isOpen={isOverridesModalOpen}
        onClose={() => {
          setIsOverridesModalOpen(false);
          setPrefilledQuestion('');
        }}
        overrides={overrides}
        onAddOverride={async (question, answer) => {
          await addOverrideMutation.mutateAsync({ question, answer });
        }}
        onDeleteOverride={async overrideId => {
          await deleteOverrideMutation.mutateAsync(overrideId);
        }}
        prefilledQuestion={prefilledQuestion}
      />

      <UnansweredInboxModal
        isOpen={isInboxModalOpen}
        onClose={() => setIsInboxModalOpen(false)}
        unansweredQuestions={unanswered}
        onResolve={async (questionId, answer) => {
          await resolveUnansweredMutation.mutateAsync({ questionId, answer });
        }}
      />
    </div>
  );
};
