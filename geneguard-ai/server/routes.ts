import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { answerLocally } from '../shared/chat';
import { analyze } from '../shared/engine/analyze';
import { findKnownVariant, KNOWN_RSIDS } from '../shared/knowledge';
import type { AnalysisReport, ChatReply, ParsedInput, ServerStatus } from '../shared/types';
import { AiUnavailable, chatWithAi, enrichWithAi, transcribeImage } from './ai/claude';
import { lookupClinvar } from './clinvar';
import { config } from './config';

// The API is stateless: nothing a user sends is stored, logged or shared.
// Each request carries the data it needs and is forgotten after the response.

export const api = Router();

const str = z.string().max(4000).optional();
const num = z.number().finite().optional();

const VariantSchema = z.object({
  id: z.string().max(100),
  gene: z.string().max(40).optional(),
  hgvsC: z.string().max(200).optional(),
  hgvsP: z.string().max(200).optional(),
  legacyName: z.string().max(200).optional(),
  rsId: z.string().max(20).optional(),
  chromosome: z.string().max(5).optional(),
  position: num,
  ref: z.string().max(1000).optional(),
  alt: z.string().max(1000).optional(),
  genotype: z.string().max(2000).optional(),
  zygosity: z.enum(['heterozygous', 'homozygous', 'hemizygous', 'homozygous-reference', 'unknown']).optional(),
  reportedSignificance: str,
  reportedCondition: str,
  labInterpretation: str,
  quality: num,
  filter: z.string().max(200).optional(),
  readDepth: num,
  genotypeQuality: num,
  info: z.record(z.string(), z.string().max(4000)).optional(),
  source: z.enum(['photo', 'pdf', 'vcf', 'snp-array', 'text', 'manual', 'demo']),
  sourceText: z.string().max(4000).optional(),
  userEdited: z.boolean().optional(),
  demo: z.boolean().optional(),
  fictional: z.boolean().optional(),
});

const InputSchema = z.object({
  kind: z.enum(['photo', 'pdf', 'vcf', 'snp-array', 'text', 'manual', 'demo']),
  fileName: z.string().max(300).optional(),
  dataScope: z.enum(['targeted-report', 'partial-report', 'snp-genotyping', 'vcf', 'cytogenetic-report', 'manual', 'synthetic-demo', 'unknown']),
  variants: z.array(VariantSchema).max(5000),
  chromosomal: z
    .array(
      z.object({
        id: z.string().max(100),
        kind: z.enum(['karyotype', 'statement', 'screening']),
        raw: z.string().max(500),
        conditionKey: z.string().max(40).optional(),
        result: z.enum(['abnormal', 'normal', 'screen-positive', 'screen-negative']),
        method: z.string().max(200).optional(),
        mosaic: z.boolean().optional(),
      }),
    )
    .max(50),
  rawText: z.string().max(200_000).optional(),
  ocrConfidence: num,
  ocrEngine: z.string().max(100).optional(),
  warnings: z.array(z.object({ code: z.string().max(40), message: z.string().max(2000) })).max(200),
  stats: z.object({ totalRecords: z.number(), keptRecords: z.number(), skippedLines: z.number(), markersGenotyped: num }),
  profile: z.object({ label: z.string().max(200), age: num, sex: z.string().max(40).optional(), synthetic: z.boolean() }).optional(),
});

const AnalyzeBody = z.object({
  input: InputSchema,
  options: z.object({ useAI: z.boolean().default(false), clinvar: z.boolean().default(false) }).default({ useAI: false, clinvar: false }),
});

const ChatBody = z.object({
  report: z.any().nullable(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).min(1).max(40),
  useAI: z.boolean().default(false),
});

const VisionBody = z.object({
  image: z.string().max(14_000_000),
  consent: z.literal(true),
});

const bad = (res: Response, message: string, status = 400) => res.status(status).json({ error: message });

api.get('/health', (_req, res) => {
  const status: ServerStatus = {
    ok: true,
    ai: { enabled: config.ai.enabled, model: config.ai.enabled ? config.ai.model : undefined, vision: config.ai.enabled },
    clinvarLookup: config.clinvar.enabled,
    version: config.version,
  };
  res.json(status);
});

api.post('/analyze', async (req: Request, res: Response) => {
  const parsed = AnalyzeBody.safeParse(req.body);
  if (!parsed.success) return bad(res, 'The submitted data has an unexpected format.');
  const { input, options } = parsed.data;

  let clinvar: Awaited<ReturnType<typeof lookupClinvar>> | undefined;
  if (options.clinvar && config.clinvar.enabled) {
    const unknown = [
      ...new Set(
        input.variants
          .filter((v) => v.rsId && !KNOWN_RSIDS.has(v.rsId) && !findKnownVariant(v as ParsedInput['variants'][number]) && v.zygosity !== 'homozygous-reference')
          .map((v) => v.rsId!),
      ),
    ];
    if (unknown.length) clinvar = await lookupClinvar(unknown);
  }

  let report: AnalysisReport = analyze(input as ParsedInput, { clinvar: clinvar?.records });
  if (clinvar?.errors) report.warnings.push({ code: 'info', message: `ClinVar could not be reached for ${clinvar.errors} variant(s); those were interpreted without it.` });

  if (options.useAI) {
    if (!config.ai.enabled) {
      report.ai.note = 'External AI is not configured on this server; built-in explanations are shown.';
    } else {
      try {
        report = await enrichWithAi(report);
      } catch (err) {
        report.ai.note = `AI explanations unavailable (${err instanceof AiUnavailable ? err.message : 'error'}); built-in explanations are shown.`;
      }
    }
  }
  res.json({ report });
});

api.post('/chat', async (req: Request, res: Response) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) return bad(res, 'The chat request has an unexpected format.');
  const { messages, useAI } = parsed.data;
  const report = (parsed.data.report ?? null) as AnalysisReport | null;
  if (report && (!Array.isArray(report.findings) || !Array.isArray(report.prs) || !report.chromosomal)) return bad(res, 'The report has an unexpected format.');
  const last = messages[messages.length - 1];
  if (last.role !== 'user') return bad(res, 'The last message must come from the user.');

  if (useAI && config.ai.enabled) {
    try {
      const { text, model } = await chatWithAi(report, messages);
      const reply: ChatReply = { reply: text, engine: 'ai', note: `Answered by ${model}`, sources: [] };
      return res.json(reply);
    } catch (err) {
      const local = answerLocally(last.content, report);
      return res.json({ ...local, note: `AI unavailable (${err instanceof AiUnavailable ? err.message : 'error'}) — answered by the built-in engine.` });
    }
  }
  res.json(answerLocally(last.content, report));
});

api.post('/ocr/vision', async (req: Request, res: Response) => {
  if (!config.ai.enabled) return bad(res, 'AI Vision is not configured on this server.', 503);
  const parsed = VisionBody.safeParse(req.body);
  if (!parsed.success) return bad(res, 'Consent and an image are required.');
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data.image);
  if (!m) return bad(res, 'The image must be a base64 data URL.');
  try {
    const { text, model } = await transcribeImage(m[2], m[1]);
    res.json({ text, model });
  } catch (err) {
    bad(res, err instanceof AiUnavailable ? err.message : 'AI Vision failed.', 502);
  }
});
