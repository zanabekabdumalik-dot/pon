import type { ChromosomalObservation } from '../types';
import { CHROMOSOMAL_CONDITIONS } from '../knowledge/chromosomal';
import { makeId } from './ids';

// Recognises chromosome-level results written in a report:
//  • ISCN karyotypes: 46,XX · 47,XY,+21 · 45,X · 47,XXY · 46,XX,del(22)(q11.2) · mos 47,XX,+21[12]/46,XX[8]
//  • plain statements: "Trisomy 21: high risk", "Consistent with Down syndrome", "Turner syndrome not detected"

const KARYOTYPE_RE = /(?<![\d.])(mos\s+)?(4[5-9])\s*,\s*(X{1,4}Y{0,2}|Y)(?![A-Za-z])((?:\s*,\s*[^\s,;/]+)*)(\s*\/\s*4[5-9]\s*,\s*X{1,4}Y{0,2}[^\s;]*)?/gi;
const SCREENING_RE = /\b(nipt|nips|cell[- ]free dna|cfdna|non[- ]invasive prenatal|prenatal screening|screening test)\b/i;
const NEGATIVE_RE = /\b(not detected|negative|low risk|low probability|no evidence|not consistent|absent|not identified|within normal)\b/i;
const POSITIVE_RE = /\b(high risk|increased risk|high probability|positive|detected|consistent with|identified|present|abnormal)\b/i;

function method(text: string): string | undefined {
  if (SCREENING_RE.test(text)) return 'Prenatal cell-free DNA screening (NIPT)';
  if (/microarray|\bcma\b|array cgh|snp array/i.test(text)) return 'Chromosomal microarray';
  if (/\bfish\b/i.test(text)) return 'FISH';
  if (/karyotyp|g-band|chromosome analysis|cytogenetic/i.test(text)) return 'Karyotype (chromosome analysis)';
  return undefined;
}

export function extractChromosomal(text: string): ChromosomalObservation[] {
  const out: ChromosomalObservation[] = [];
  const reportMethod = method(text);
  const screening = SCREENING_RE.test(text);

  for (const m of text.matchAll(KARYOTYPE_RE)) {
    const [raw, mos, countStr, sexRaw, restRaw, mosaicPart] = m;
    const count = Number(countStr);
    const sex = sexRaw.toUpperCase();
    const tokens = (restRaw ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const mosaic = Boolean(mos || mosaicPart || /\[\d+\]/.test(raw));
    const add = (conditionKey: string | undefined, result: ChromosomalObservation['result']) =>
      out.push({ id: makeId('chr'), kind: 'karyotype', raw: raw.trim(), conditionKey, result, method: reportMethod, mosaic });

    const keys: string[] = [];
    for (const t of tokens) {
      const plus = /^\+(\d{1,2})/.exec(t);
      if (plus) {
        if (['21', '18', '13'].includes(plus[1])) keys.push(`trisomy${plus[1]}`);
        else keys.push('other');
      } else if (/^del\(22\)\(q11/i.test(t)) keys.push('del22q11');
      else if (/^(del|dup|t|inv|der|r|i|ins|add)\(/i.test(t) || /^[+-]/.test(t)) keys.push('other');
    }
    if (count === 45 && sex === 'X') keys.push('monosomyX');
    if (sex === 'XXY') keys.push('xxy');
    if (sex === 'XXX') keys.push('xxx');
    if (sex === 'XYY') keys.push('xyy');
    if (keys.length === 0 && count === 46 && (sex === 'XX' || sex === 'XY')) add(undefined, 'normal');
    else for (const k of new Set(keys)) add(k, 'abnormal');
  }

  const already = new Set(out.map((o) => o.conditionKey));
  for (const line of text.split(/\r?\n/)) {
    const lower = line.toLowerCase();
    for (const cond of CHROMOSOMAL_CONDITIONS) {
      if (already.has(cond.key)) continue;
      const alias = cond.aliases.find((a) => {
        if (a.length <= 3) return new RegExp(`\\b${a}\\b`, 'i').test(line); // short aliases such as "T21"
        return lower.includes(a);
      });
      if (!alias) continue;
      const negative = NEGATIVE_RE.test(line);
      const positive = !negative && POSITIVE_RE.test(line);
      if (!negative && !positive) continue; // a mention without a result (e.g. in a methods section)
      out.push({
        id: makeId('chr'),
        kind: screening ? 'screening' : 'statement',
        raw: line.trim(),
        conditionKey: cond.key,
        result: screening ? (positive ? 'screen-positive' : 'screen-negative') : positive ? 'abnormal' : 'normal',
        method: reportMethod,
      });
      already.add(cond.key);
    }
  }
  return out;
}
