import { MESSAGES } from './messages';

// Post-filter for AI-generated text. The language model is instructed to follow
// the same rules, but this filter enforces the most important ones in code:
// no diagnoses stated as fact, no certainty about the future, no medication
// instructions and no dosages.

const NEGATION = /\b(not|n't|never|no|without|cannot|can't|isn't|doesn't|don't|does not|do not|is not|are not|neither|nor)\b/i;

const RULES: { re: RegExp; reason: string; negatable: boolean }[] = [
  {
    re: /\byou (have|definitely have|certainly have|are suffering from|suffer from)\b[^.!?]{0,60}\b(cancer|disease|syndrome|disorder|fibrosis|anemia|anaemia|diabetes|alzheimer'?s|dementia|hypercholesterolemia|condition|trisomy)\b/i,
    reason: 'states a diagnosis',
    negatable: true,
  },
  {
    re: /\byou (will|are going to|are certain to|are sure to)\s+(definitely\s+|certainly\s+)?(get|develop|have|die|suffer)\b/i,
    reason: 'predicts the future with certainty',
    negatable: true,
  },
  { re: /\b(guarantee[sd]?|100\s?%|certainly will|definitely will|inevitabl[ey])\b/i, reason: 'claims certainty', negatable: true },
  { re: /\b(you are|you're) (diagnosed|sick|ill|healthy for sure|safe from)\b/i, reason: 'states a diagnosis', negatable: true },
  { re: /\b\d+(?:[.,]\d+)?\s?(mg|mcg|µg|ug|ml|iu|units? of (?:insulin|medication)|tablets?|pills?|capsules?|drops?)\b(?![a-z])/i, reason: 'mentions a dosage', negatable: false },
  {
    re: /\b(take|start(ing)?|begin|use|try)\b[^.!?]{0,40}\b(tamoxifen|statins?|metformin|aspirin|warfarin|heparin|anticoagulants?|blood thinners?|medications?|medicines?|drugs?|supplements?|hormones?|insulin|ivacaftor|chemotherapy)\b/i,
    reason: 'advises starting a treatment',
    negatable: true,
  },
  { re: /\b(stop|discontinue)\b[^.!?]{0,30}\b(medications?|medicines?|treatment|drugs?)\b/i, reason: 'advises stopping a treatment', negatable: true },
];

export interface SafetyResult {
  text: string;
  removed: { sentence: string; reason: string }[];
}

export function sanitizeAiText(text: string): SafetyResult {
  const removed: SafetyResult['removed'] = [];
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) ?? [text];
  const kept = sentences.filter((sentence) => {
    for (const rule of RULES) {
      if (!rule.re.test(sentence)) continue;
      const doctorContext = /\b(doctor|physician|specialist|counsel(l)?or|healthcare professional)\b/i.test(sentence) && rule.reason.includes('treatment');
      if ((rule.negatable && NEGATION.test(sentence)) || doctorContext) continue;
      removed.push({ sentence: sentence.trim(), reason: rule.reason });
      return false;
    }
    return true;
  });
  let out = kept.join('').replace(/\n{3,}/g, '\n\n').trim();
  if (removed.length) out = `${out}${out ? '\n\n' : ''}${MESSAGES.uncertain}`;
  return { text: out, removed };
}
