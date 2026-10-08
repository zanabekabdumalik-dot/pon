import type { AnalysisReport, ChatMessage, ChatReply, ParsedInput, ServerStatus } from '../../shared/types';
import { asset } from './env';

/** The GeneGuard server could not be reached (offline, static hosting, embedded page, …). */
export class ApiUnavailable extends Error {}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 120_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(asset(path), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new ApiUnavailable('The GeneGuard server could not be reached.');
  }
  // Static hosts answer unknown paths with 404 or with index.html — neither is our API.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new ApiUnavailable('No GeneGuard API at this address.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  health: async () => {
    const s = await request<ServerStatus>('api/health', undefined, 5000);
    if (!s || s.ok !== true || typeof s.ai !== 'object') throw new ApiUnavailable('Unexpected health response.');
    return s;
  },

  analyze: (input: ParsedInput, options: { useAI: boolean; clinvar: boolean }) => {
    // The raw document text stays in the browser; only structured variant data is sent.
    const { rawText: _omit, ...payload } = input;
    return request<{ report: AnalysisReport }>('api/analyze', { method: 'POST', body: JSON.stringify({ input: payload, options }) });
  },

  chat: (report: AnalysisReport | null, messages: ChatMessage[], useAI: boolean) =>
    request<ChatReply>('api/chat', { method: 'POST', body: JSON.stringify({ report, messages, useAI }) }),

  vision: (image: string) => request<{ text: string; model: string }>('api/ocr/vision', { method: 'POST', body: JSON.stringify({ image, consent: true }) }),
};
