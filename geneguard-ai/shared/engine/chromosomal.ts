import type { AnalysisReport, ChromosomalObservation, ChromosomalResult, Confidence, ParsedInput } from '../types';
import { CHROMOSOMAL_BY_KEY, CHROMOSOMAL_CONDITIONS } from '../knowledge/chromosomal';

const CORE_KEYS = ['trisomy21', 'trisomy18', 'trisomy13', 'monosomyX', 'xxy'];

const NOT_ASSESSABLE_REASON =
  'The submitted data is a list of genetic variants. This kind of data is not designed to detect changes in the number or structure of chromosomes, so chromosomal conditions cannot be assessed. This does not mean that chromosomal changes are absent.';

function reliability(o: ChromosomalObservation, input: ParsedInput): { level: Confidence; reason: string } {
  const ocr = input.kind === 'photo' || Boolean(input.ocrEngine);
  if (o.kind === 'screening')
    return {
      level: 'medium',
      reason: 'Screening result (e.g. NIPT). Screening tests can give false-positive and false-negative results; only diagnostic testing can confirm.',
    };
  if (o.kind === 'karyotype')
    return ocr
      ? { level: 'medium', reason: 'Laboratory karyotype notation, read with OCR — check that it was transcribed correctly.' }
      : { level: 'high', reason: 'Laboratory karyotype notation as written in the report.' };
  return { level: 'medium', reason: 'Written statement in the report (no karyotype notation found).' };
}

export function assessChromosomal(input: ParsedInput): AnalysisReport['chromosomal'] {
  const obs = input.chromosomal;
  if (obs.length === 0) {
    return {
      assessable: false,
      reason: NOT_ASSESSABLE_REASON,
      results: CORE_KEYS.map((key) => {
        const c = CHROMOSOMAL_BY_KEY[key];
        return {
          conditionKey: key,
          name: c.name,
          status: 'insufficient-data',
          risk: 'not-assessable',
          meaning: c.meaning,
          reliability: 'insufficient',
          reliabilityReason: 'Not assessable from submitted data.',
          requiresConfirmation: false,
          sources: c.sources,
        };
      }),
    };
  }

  // Any full karyotype (normal or not) shows the number of every chromosome.
  const karyotype = obs.find((o) => o.kind === 'karyotype' && o.result === 'normal') ?? obs.find((o) => o.kind === 'karyotype');
  const mentioned = new Set(obs.map((o) => o.conditionKey).filter(Boolean) as string[]);
  const keys = karyotype
    ? CHROMOSOMAL_CONDITIONS.map((c) => c.key)
    : [...new Set([...CORE_KEYS.slice(0, 3), ...CHROMOSOMAL_CONDITIONS.map((c) => c.key).filter((k) => mentioned.has(k))])];

  const results: ChromosomalResult[] = keys.map((key) => {
    const c = CHROMOSOMAL_BY_KEY[key];
    const base = { conditionKey: key, name: c.name, meaning: c.meaning, sources: c.sources };
    const own = obs.filter((o) => o.conditionKey === key);
    const abnormal = own.find((o) => o.result === 'abnormal');
    const screenPos = own.find((o) => o.result === 'screen-positive');
    const negative = own.find((o) => o.result === 'normal' || o.result === 'screen-negative');
    if (abnormal) {
      const r = reliability(abnormal, input);
      return {
        ...base,
        status: 'detected',
        risk: 'high',
        reliability: r.level,
        reliabilityReason: `${r.reason}${abnormal.mosaic ? ' The result is mosaic (only some cells are affected), which can change its effects.' : ''}`,
        requiresConfirmation: true,
        evidenceText: abnormal.raw,
      };
    }
    if (screenPos) {
      const r = reliability(screenPos, input);
      return {
        ...base,
        status: 'screen-positive',
        risk: 'elevated',
        reliability: r.level,
        reliabilityReason: r.reason,
        requiresConfirmation: true,
        evidenceText: screenPos.raw,
      };
    }
    if (negative) {
      const r = reliability(negative, input);
      return {
        ...base,
        status: 'not-detected',
        risk: 'low',
        reliability: r.level,
        reliabilityReason:
          negative.result === 'screen-negative'
            ? `${r.reason} A low-risk screening result makes the condition unlikely but does not rule it out.`
            : r.reason,
        requiresConfirmation: false,
        evidenceText: negative.raw,
      };
    }
    if (karyotype && c.detectableByKaryotype) {
      const r = reliability(karyotype, input);
      return {
        ...base,
        status: 'not-detected',
        risk: 'low',
        reliability: r.level,
        reliabilityReason: `${r.reason} Not present in the reported karyotype (${karyotype.raw}), at the resolution of the test.`,
        requiresConfirmation: false,
        evidenceText: karyotype.raw,
      };
    }
    return {
      ...base,
      status: 'insufficient-data',
      risk: 'not-assessable',
      reliability: 'insufficient',
      reliabilityReason: karyotype
        ? 'A standard karyotype cannot see changes this small; a chromosomal microarray or FISH would be needed.'
        : 'The report does not contain a result for this condition.',
      requiresConfirmation: false,
    };
  });

  for (const o of obs.filter((x) => x.conditionKey === 'other' && x.result === 'abnormal')) {
    const r = reliability(o, input);
    results.unshift({
      conditionKey: 'other',
      name: `Chromosomal change reported: ${o.raw}`,
      status: 'detected',
      risk: 'high',
      meaning: 'The report describes a chromosomal change that GeneGuard cannot interpret in detail. A clinical geneticist should explain what it means.',
      reliability: r.level,
      reliabilityReason: r.reason,
      requiresConfirmation: true,
      evidenceText: o.raw,
      sources: [],
    });
  }

  const methods = [...new Set(obs.map((o) => o.method).filter(Boolean))];
  return {
    assessable: true,
    reason: `Your data includes a chromosome-level result${methods.length ? ` (${methods.join(', ')})` : ''}. GeneGuard shows what the report states; it cannot re-analyse chromosomes.`,
    results,
  };
}
