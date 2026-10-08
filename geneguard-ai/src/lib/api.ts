import type { AnalysisReport, ChatMessage, ChatReply, ParsedInput, ServerStatus } from '../../shared/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  health: () => request<ServerStatus>('/api/health'),

  analyze: (input: ParsedInput, options: { useAI: boolean; clinvar: boolean }) => {
    // The raw document text stays in the browser; only structured variant data is sent.
    const { rawText: _omit, ...payload } = input;
    return request<{ report: AnalysisReport }>('/api/analyze', { method: 'POST', body: JSON.stringify({ input: payload, options }) });
  },

  chat: (report: AnalysisReport | null, messages: ChatMessage[], useAI: boolean) =>
    request<ChatReply>('/api/chat', { method: 'POST', body: JSON.stringify({ report, messages, useAI }) }),

  vision: (image: string) => request<{ text: string; model: string }>('/api/ocr/vision', { method: 'POST', body: JSON.stringify({ image, consent: true }) }),
};
