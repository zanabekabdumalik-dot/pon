import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { AnalysisReport, ChatMessage } from '../../shared/types';
import { sanitizeAiText } from '../../shared/safety';
import { config } from '../config';
import { CHAT_SYSTEM, EXPLAIN_SYSTEM, reportFacts, VISION_PROMPT } from './prompts';

// Thin wrapper around the Anthropic Messages API. The API key is read by the
// SDK from ANTHROPIC_API_KEY on the server and never reaches the browser.

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 2 }));

// Server-side fallback: if the model declines a request, the API retries it on
// Anthropic's recommended fallback model instead of returning a refusal.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

export class AiUnavailable extends Error {}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'The AI API key was rejected.';
  if (err instanceof Anthropic.RateLimitError) return 'The AI service is rate-limited right now.';
  if (err instanceof Anthropic.BadRequestError) return 'The AI service rejected the request.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service.';
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status}).`;
  return err instanceof Error ? err.message : 'Unknown AI error.';
}

const ExplanationSchema = z.object({
  overview: z.string(),
  findings: z.array(z.object({ id: z.string(), explanation: z.string() })),
  prs: z.array(z.object({ traitKey: z.string(), explanation: z.string() })),
});

/** Asks the model to rewrite explanations in plain language. Risk levels are never taken from the model. */
export async function enrichWithAi(report: AnalysisReport): Promise<AnalysisReport> {
  try {
    const message = await anthropic().beta.messages.parse({
      model: config.ai.model,
      max_tokens: 12000,
      system: EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: `FACTS (JSON):\n${JSON.stringify(reportFacts(report))}` }],
      output_config: { effort: config.ai.effort, format: betaZodOutputFormat(ExplanationSchema) },
      ...FALLBACK,
    });
    if (message.stop_reason === 'refusal' || !message.parsed_output) throw new AiUnavailable('The AI did not return explanations.');
    const out = message.parsed_output;
    const clean = (text: string | undefined, fallback: string) => {
      const t = text?.trim();
      return t ? sanitizeAiText(t).text || fallback : fallback;
    };
    const byId = new Map(out.findings.map((f) => [f.id, f.explanation]));
    const byTrait = new Map(out.prs.map((p) => [p.traitKey, p.explanation]));
    return {
      ...report,
      overview: clean(out.overview, report.overview),
      overviewSource: out.overview?.trim() ? 'ai' : report.overviewSource,
      findings: report.findings.map((f) =>
        byId.get(f.id)?.trim() ? { ...f, explanation: clean(byId.get(f.id), f.explanation), explanationSource: 'ai' as const } : f,
      ),
      prs: report.prs.map((p) =>
        byTrait.get(p.traitKey)?.trim() ? { ...p, explanation: clean(byTrait.get(p.traitKey), p.explanation), explanationSource: 'ai' as const } : p,
      ),
      ai: { ...report.ai, used: true, model: message.model },
    };
  } catch (err) {
    throw new AiUnavailable(describeError(err));
  }
}

export async function chatWithAi(report: AnalysisReport | null, history: ChatMessage[]): Promise<{ text: string; model: string }> {
  const context = report ? JSON.stringify(reportFacts(report)) : '{"note":"No genetic data has been analysed in this session."}';
  try {
    const message = await anthropic().beta.messages.create({
      model: config.ai.model,
      max_tokens: 8000,
      system: `${CHAT_SYSTEM}\n\nREPORT_CONTEXT (JSON):\n${context}`,
      messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      output_config: { effort: config.ai.effort },
      cache_control: { type: 'ephemeral' },
      ...FALLBACK,
    });
    if (message.stop_reason === 'refusal') throw new AiUnavailable('The AI declined to answer.');
    const text = message.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('\n')
      .trim();
    if (!text) throw new AiUnavailable('The AI returned an empty answer.');
    return { text: sanitizeAiText(text).text, model: message.model };
  } catch (err) {
    if (err instanceof AiUnavailable) throw err;
    throw new AiUnavailable(describeError(err));
  }
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** Optional "AI Vision" OCR: transcription only — the same rule-based extractor then reads the text. */
export async function transcribeImage(base64: string, mediaType: string): Promise<{ text: string; model: string }> {
  if (!IMAGE_TYPES.includes(mediaType as ImageType)) throw new AiUnavailable('Unsupported image type for AI Vision.');
  try {
    const message = await anthropic().beta.messages.create({
      model: config.ai.model,
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as ImageType, data: base64 } },
            { type: 'text', text: VISION_PROMPT },
          ],
        },
      ],
      output_config: { effort: 'low' },
      ...FALLBACK,
    });
    if (message.stop_reason === 'refusal') throw new AiUnavailable('The AI declined to read this image.');
    const text = message.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('\n')
      .trim();
    return { text: text === 'NO_TEXT' ? '' : text, model: message.model };
  } catch (err) {
    if (err instanceof AiUnavailable) throw err;
    throw new AiUnavailable(describeError(err));
  }
}
