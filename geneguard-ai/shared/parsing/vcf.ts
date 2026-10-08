import type { ExtractedVariant, ParseWarning, Zygosity } from '../types';
import { normalizeGene, normalizeRsId } from './normalize';
import { makeId } from './ids';

export interface VcfParseResult {
  variants: ExtractedVariant[];
  warnings: ParseWarning[];
  totalRecords: number;
  skippedLines: number;
  samples: string[];
  fileFormat?: string;
}

const CHROM_RE = /^(chr)?([1-9]|1\d|2[0-2]|X|Y|M|MT)$/i;
const BASES_RE = /^[ACGTN]+$/i;
const ALT_RE = /^([ACGTN]+|<[A-Za-z0-9:_]+>|\*)$/i;

export function looksLikeVcf(text: string): boolean {
  return /^##fileformat=VCF/m.test(text) || /^#CHROM\s+POS\s+ID\s+REF\s+ALT/m.test(text);
}

function parseInfo(field: string): Record<string, string> {
  const info: Record<string, string> = {};
  if (!field || field === '.') return info;
  for (const part of field.split(';')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) info[part] = 'true';
    else info[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return info;
}

function decodeVcfText(value: string): string {
  return value.replace(/_/g, ' ').replace(/%3B/gi, ';').replace(/%3D/gi, '=').replace(/%2C/gi, ',').replace(/\|/g, '; ');
}

/** Gene / HGVS annotation from common annotators (ClinVar VCF, SnpEff ANN, VEP CSQ, plain GENE=). */
function annotation(info: Record<string, string>, csqFields: string[] | undefined, altAllele: string) {
  let gene: string | undefined;
  let hgvsC: string | undefined;
  let hgvsP: string | undefined;
  if (info.GENEINFO) gene = info.GENEINFO.split(':')[0];
  if (!gene && (info.GENE || info.Gene || info.SYMBOL)) gene = info.GENE ?? info.Gene ?? info.SYMBOL;
  if (info.ANN) {
    const ann = info.ANN.split(',').map((a) => a.split('|')).find((a) => a[0] === altAllele) ?? info.ANN.split(',')[0].split('|');
    gene = gene ?? ann[3];
    hgvsC = ann[9] || undefined;
    hgvsP = ann[10] || undefined;
  }
  if (info.CSQ && csqFields) {
    const csq = info.CSQ.split(',')[0].split('|');
    const at = (name: string) => {
      const i = csqFields.indexOf(name);
      return i >= 0 ? csq[i] || undefined : undefined;
    };
    gene = gene ?? at('SYMBOL');
    hgvsC = hgvsC ?? at('HGVSc')?.split(':').pop();
    hgvsP = hgvsP ?? at('HGVSp')?.split(':').pop()?.replace('%3D', '=');
  }
  if (info.HGVSC && !hgvsC) hgvsC = info.HGVSC.split(':').pop();
  if (info.HGVSP && !hgvsP) hgvsP = info.HGVSP.split(':').pop();
  return { gene: normalizeGene(gene), hgvsC, hgvsP };
}

function zygosityFromGt(indices: (number | null)[]): Zygosity {
  const called = indices.filter((i): i is number => i !== null);
  if (called.length === 0) return 'unknown';
  if (called.length === 1) return called[0] === 0 ? 'homozygous-reference' : 'hemizygous';
  if (called.every((i) => i === 0)) return 'homozygous-reference';
  if (called.every((i) => i === called[0])) return 'homozygous';
  return 'heterozygous';
}

export function parseVcf(text: string, opts: { keep?: (v: ExtractedVariant) => boolean; maxVariants?: number } = {}): VcfParseResult {
  const warnings: ParseWarning[] = [];
  const variants: ExtractedVariant[] = [];
  let columns: string[] | undefined;
  let csqFields: string[] | undefined;
  let fileFormat: string | undefined;
  let total = 0;
  let skipped = 0;
  let filteredOut = 0;
  const skippedExamples: string[] = [];
  const maxVariants = opts.maxVariants ?? 5000;

  const lines = text.split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    if (!line.trim()) continue;
    if (line.startsWith('##')) {
      const ff = /^##fileformat=(.+)$/.exec(line);
      if (ff) fileFormat = ff[1].trim();
      const csq = /^##INFO=<ID=CSQ,.*Format: ([^">]+)/.exec(line);
      if (csq) csqFields = csq[1].trim().split('|');
      continue;
    }
    if (line.startsWith('#')) {
      columns = line.slice(1).split('\t');
      continue;
    }
    total++;
    const cols = line.includes('\t') ? line.split('\t') : line.trim().split(/\s+/);
    const reject = (reason: string) => {
      skipped++;
      if (skippedExamples.length < 3) skippedExamples.push(`line ${n + 1}: ${reason}`);
    };
    if (cols.length < 8) {
      reject('fewer than 8 columns');
      continue;
    }
    const [chromRaw, posRaw, idRaw, ref, altRaw, qualRaw, filter, infoRaw] = cols;
    const pos = Number(posRaw);
    if (!CHROM_RE.test(chromRaw)) {
      reject(`unsupported chromosome "${chromRaw.slice(0, 20)}"`);
      continue;
    }
    if (!Number.isInteger(pos) || pos <= 0) {
      reject('position is not a positive integer');
      continue;
    }
    if (!BASES_RE.test(ref)) {
      reject('reference allele is not a DNA sequence');
      continue;
    }
    const alts = altRaw.split(',');
    if (altRaw === '.' || !alts.every((a) => ALT_RE.test(a))) {
      reject(altRaw === '.' ? 'no alternative allele (reference site)' : 'alternative allele is not valid');
      continue;
    }
    const info = parseInfo(infoRaw);
    const ids = idRaw === '.' ? [] : idRaw.split(';');
    let rsId = ids.map((i) => normalizeRsId(i)).find(Boolean);
    if (!rsId && info.RS) rsId = normalizeRsId(`rs${info.RS}`);

    // Genotype of the first sample
    let indices: (number | null)[] = [];
    let gq: number | undefined;
    let dp: number | undefined;
    if (cols.length >= 10) {
      const format = cols[8].split(':');
      const sample = cols[9].split(':');
      const field = (name: string) => {
        const i = format.indexOf(name);
        return i >= 0 ? sample[i] : undefined;
      };
      const gt = field('GT');
      if (gt) indices = gt.split(/[/|]/).map((x) => (x === '.' ? null : Number(x)));
      const gqv = Number(field('GQ'));
      const dpv = Number(field('DP'));
      if (Number.isFinite(gqv)) gq = gqv;
      if (Number.isFinite(dpv)) dp = dpv;
    }
    const alleles = [ref, ...alts];
    const called = indices.filter((i): i is number => i !== null && i < alleles.length);
    const altIndex = called.find((i) => i > 0) ?? 1;
    const alt = alts[altIndex - 1] ?? alts[0];
    const zygosity = cols.length >= 10 ? zygosityFromGt(indices) : 'unknown';
    const genotype = called.length ? called.map((i) => alleles[i]).join('/') : undefined;
    const ann = annotation(info, csqFields, alt);
    const qual = qualRaw === '.' ? undefined : Number(qualRaw);

    const variant: ExtractedVariant = {
      id: makeId('vcf'),
      gene: ann.gene,
      hgvsC: ann.hgvsC,
      hgvsP: ann.hgvsP,
      rsId,
      chromosome: chromRaw.replace(/^chr/i, '').toUpperCase().replace(/^M$/, 'MT'),
      position: pos,
      ref: ref.toUpperCase(),
      alt: alt.toUpperCase(),
      genotype,
      zygosity,
      quality: Number.isFinite(qual) ? qual : undefined,
      filter: filter === '.' ? undefined : filter,
      genotypeQuality: gq,
      readDepth: dp,
      info: Object.keys(info).length ? info : undefined,
      reportedSignificance: info.CLNSIG ? decodeVcfText(info.CLNSIG) : undefined,
      reportedCondition: info.CLNDN ? decodeVcfText(info.CLNDN) : undefined,
      source: 'vcf',
      sourceText: line.length > 300 ? `${line.slice(0, 300)}…` : line,
    };
    if (opts.keep && !opts.keep(variant)) {
      filteredOut++;
      continue;
    }
    if (variants.length >= maxVariants) {
      filteredOut++;
      continue;
    }
    variants.push(variant);
  }

  if (!fileFormat && !columns) warnings.push({ code: 'info', message: 'No VCF header found; columns were interpreted using the standard VCF order.' });
  if (skipped)
    warnings.push({
      code: 'skipped-lines',
      message: `${skipped} line(s) were not valid VCF records and were ignored rather than interpreted (${skippedExamples.join('; ')}).`,
    });
  if (filteredOut && variants.length >= maxVariants)
    warnings.push({ code: 'truncated', message: `Only the first ${maxVariants} variants were kept for analysis.` });

  return { variants, warnings, totalRecords: total, skippedLines: skipped, samples: columns?.slice(9) ?? [], fileFormat };
}
