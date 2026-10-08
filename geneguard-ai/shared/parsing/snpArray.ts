import type { ExtractedVariant, ParseWarning } from '../types';
import { makeId } from './ids';
import { normalizeGenotype, normalizeRsId } from './normalize';

// Consumer genotyping "raw data" files (23andMe, AncestryDNA, MyHeritage-style):
//   rsid  chromosome  position  genotype          (23andMe)
//   rsid  chromosome  position  allele1  allele2  (AncestryDNA)

export interface SnpParseResult {
  variants: ExtractedVariant[];
  warnings: ParseWarning[];
  markersGenotyped: number;
  noCalls: number;
  skippedLines: number;
}

const ROW_RE = /^"?(rs\d+|i\d+)"?[\t, ]+"?(\d{1,2}|X|Y|XY|MT|M)"?[\t, ]+"?(\d+)"?[\t, ]+"?([ACGTDI0-]{1,2})"?(?:[\t, ]+"?([ACGTDI0-])"?)?\s*$/i;

export function looksLikeSnpArray(text: string): boolean {
  const sample = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).slice(0, 30);
  if (sample.length === 0) return false;
  const rows = sample.filter((l) => ROW_RE.test(l.trim())).length;
  return rows >= Math.min(3, sample.length) && rows / sample.length > 0.6;
}

export function parseSnpArray(text: string, opts: { keep?: (rsId: string) => boolean } = {}): SnpParseResult {
  const warnings: ParseWarning[] = [];
  const variants: ExtractedVariant[] = [];
  let markers = 0;
  let noCalls = 0;
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || /^"?rsid"?[\t, ]/i.test(line)) continue;
    const m = ROW_RE.exec(line);
    if (!m) {
      skipped++;
      continue;
    }
    markers++;
    const [, id, chrom, pos, a1, a2] = m;
    const genotype = normalizeGenotype(a2 ? `${a1}${a2}` : a1);
    if (!genotype || /[0-]/.test(a1)) {
      noCalls++;
      continue;
    }
    const rsId = normalizeRsId(id);
    if (!rsId) continue; // internal (i-prefixed) identifiers cannot be interpreted
    if (opts.keep && !opts.keep(rsId)) continue;
    variants.push({
      id: makeId('snp'),
      rsId,
      chromosome: chrom.toUpperCase().replace(/^M$/, 'MT'),
      position: Number(pos),
      genotype,
      source: 'snp-array',
      sourceText: line,
    });
  }
  if (skipped) warnings.push({ code: 'skipped-lines', message: `${skipped} line(s) did not match the genotype format and were ignored.` });
  if (noCalls) warnings.push({ code: 'info', message: `${noCalls} marker(s) had no genotype call ("--") and were not analysed.` });
  return { variants, warnings, markersGenotyped: markers, noCalls, skippedLines: skipped };
}
