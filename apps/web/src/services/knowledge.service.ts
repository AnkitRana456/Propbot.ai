import {
  type CreateTextSourceInput,
  type CreateQaSourceInput,
  type CreateCrawlSourceInput,
  type CreateQaOverrideInput,
  type KnowledgeSourceResponse,
  type KnowledgeSourcesListResponse,
  type QaOverrideResponse,
  type UnansweredQuestionResponse,
  type RagQueryInput,
  type RagQueryResponse,
} from '@propbot/shared';
import { apiRequest } from './api-client.js';

export const knowledgeService = {
  // 1. Sources CRUD
  async listSources(chatbotId: string): Promise<KnowledgeSourcesListResponse> {
    return apiRequest<KnowledgeSourcesListResponse>(`/api/chatbots/${chatbotId}/knowledge/sources`);
  },

  async getSource(chatbotId: string, sourceId: string): Promise<KnowledgeSourceResponse> {
    return apiRequest<KnowledgeSourceResponse>(`/api/chatbots/${chatbotId}/knowledge/sources/${sourceId}`);
  },

  async createTextSource(
    chatbotId: string,
    input: CreateTextSourceInput,
  ): Promise<KnowledgeSourceResponse> {
    return apiRequest<KnowledgeSourceResponse>(`/api/chatbots/${chatbotId}/knowledge/sources/text`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async createQaSource(
    chatbotId: string,
    input: CreateQaSourceInput,
  ): Promise<KnowledgeSourceResponse> {
    return apiRequest<KnowledgeSourceResponse>(`/api/chatbots/${chatbotId}/knowledge/sources/qa`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async createCrawlSource(
    chatbotId: string,
    input: CreateCrawlSourceInput,
  ): Promise<KnowledgeSourceResponse> {
    return apiRequest<KnowledgeSourceResponse>(`/api/chatbots/${chatbotId}/knowledge/sources/crawl`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async uploadFileSource(
    chatbotId: string,
    file: File,
    title: string,
  ): Promise<KnowledgeSourceResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    return apiRequest<KnowledgeSourceResponse>(`/api/chatbots/${chatbotId}/knowledge/sources/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  async reTrainSource(chatbotId: string, sourceId: string): Promise<KnowledgeSourceResponse> {
    return apiRequest<KnowledgeSourceResponse>(
      `/api/chatbots/${chatbotId}/knowledge/sources/${sourceId}/retrain`,
      { method: 'POST' },
    );
  },

  async deleteSource(chatbotId: string, sourceId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
      `/api/chatbots/${chatbotId}/knowledge/sources/${sourceId}`,
      { method: 'DELETE' },
    );
  },

  // 2. Interactive Test Query
  async testQuery(
    chatbotId: string,
    input: RagQueryInput & {
      history?: Array<{ role: 'visitor' | 'assistant'; content: string }>;
      visitorName?: string;
    },
  ): Promise<RagQueryResponse> {
    return apiRequest<RagQueryResponse>(`/api/chatbots/${chatbotId}/knowledge/query`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 3. Fine-Tune Loop: Q&A Overrides
  async listQaOverrides(chatbotId: string): Promise<QaOverrideResponse[]> {
    return apiRequest<QaOverrideResponse[]>(`/api/chatbots/${chatbotId}/knowledge/overrides`);
  },

  async createQaOverride(
    chatbotId: string,
    input: CreateQaOverrideInput,
  ): Promise<QaOverrideResponse> {
    return apiRequest<QaOverrideResponse>(`/api/chatbots/${chatbotId}/knowledge/overrides`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async deleteQaOverride(chatbotId: string, overrideId: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
      `/api/chatbots/${chatbotId}/knowledge/overrides/${overrideId}`,
      { method: 'DELETE' },
    );
  },

  // 4. Fine-Tune Loop: Unanswered Questions Inbox
  async listUnanswered(chatbotId: string): Promise<UnansweredQuestionResponse[]> {
    return apiRequest<UnansweredQuestionResponse[]>(`/api/chatbots/${chatbotId}/knowledge/unanswered`);
  },

  async resolveUnanswered(
    chatbotId: string,
    questionId: string,
    answer: string,
  ): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(
      `/api/chatbots/${chatbotId}/knowledge/unanswered/${questionId}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ answer }),
      },
    );
  },
};
