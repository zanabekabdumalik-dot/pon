import type { Significance, Zygosity } from '../types';
import { isRecognisedGene } from '../knowledge/genes';

// Normalisation helpers. They clean up formatting and common OCR confusions,
// but never invent information that is not present in the input.

const OCR_DIGIT_FIXES: Record<string, string> = { l: '1', I: '1', '|': '1', i: '1', O: '0', o: '0', S: '5', B: '8' };

export function normalizeRsId(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const m = /\b[rR][sS]\s?([0-9lIioO|SB]{2,12})\b/.exec(input);
  if (!m) return undefined;
  const body = m[1];
  const digits = [...body].filter((c) => /[0-9]/.test(c)).length;
  if (digits < Math.max(2, body.length - 2)) return undefined; // too many letters: probably a word, not an rsID
  const fixed = [...body].map((c) => OCR_DIGIT_FIXES[c] ?? c).join('');
  return /^\d+$/.test(fixed) ? `rs${fixed.replace(/^0+/, '') || '0'}` : undefined;
}

export function normalizeGene(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const raw = input.trim().replace(/[^A-Za-z0-9\-|]/g, '');
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (isRecognisedGene(upper)) return upper;
  // OCR often confuses 1/l/I, 0/O and 5/S at the end of gene symbols (BRCAl → BRCA1, FS → F5).
  // Only applied to tokens written in capitals, so ordinary words are left alone.
  if (raw === upper || /^[A-Z]+[a-z]$/.test(raw)) {
    const fixed = upper.replace(/(?<=[A-Z])[LI|](?=$|[0-9])/g, '1').replace(/(?<=[0-9])O/g, '0');
    if (isRecognisedGene(fixed)) return fixed;
    const five = upper.replace(/(?<=^[A-Z]{1,5})S$/, '5');
    if (five !== upper && isRecognisedGene(five)) return five;
  }
  return /^[A-Z][A-Z0-9-]{1,11}$/.test(upper) ? upper : undefined;
}

/** Tidy a cDNA HGVS expression for display: "c. 5266 dupc" → "c.5266dupC". */
export function normalizeHgvsC(input: string | undefined): string | undefined {
  if (!input) return undefined;
  let s = input.trim().replace(/\s+/g, '').replace(/^c[,:;]/i, 'c.');
  if (!/^c\./i.test(s)) s = `c.${s}`;
  s = 'c.' + s.slice(2).replace(/(del|dup|ins|inv)/gi, (x) => x.toLowerCase());
  s = s.replace(/(del|dup|ins)([acgtn]+)/g, (_, op: string, bases: string) => op + bases.toUpperCase());
  s = s.replace(/([acgtn])>([acgtn])/gi, (_, a: string, b: string) => `${a.toUpperCase()}>${b.toUpperCase()}`);
  return s;
}

/** Key used to compare cDNA changes: ignores case, brackets and spelled-out deleted/duplicated bases. */
export function hgvsKey(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^c\./, '')
    .replace(/[()]/g, '')
    .replace(/(del|dup)[acgtn]+$/, '$1');
}

const AA3: Record<string, string> = {
  ala: 'a', arg: 'r', asn: 'n', asp: 'd', cys: 'c', gln: 'q', glu: 'e', gly: 'g', his: 'h', ile: 'i',
  leu: 'l', lys: 'k', met: 'm', phe: 'f', pro: 'p', ser: 's', thr: 't', trp: 'w', tyr: 'y', val: 'v', ter: '*',
};

/** Key used to compare protein changes: three-letter → one-letter, frameshift details dropped. */
export function proteinKey(input: string | undefined): string | undefined {
  if (!input) return undefined;
  let s = input.toLowerCase().replace(/\s+/g, '').replace(/^p\./, '').replace(/[()]/g, '');
  s = s.replace(/(ala|arg|asn|asp|cys|gln|glu|gly|his|ile|leu|lys|met|phe|pro|ser|thr|trp|tyr|val|ter)/g, (x) => AA3[x]);
  s = s.replace(/^([a-z*]\d+)[a-z*]?fs.*$/, '$1fs');
  return s;
}

export function aliasKey(input: string): string {
  return input.toLowerCase().replace(/[\s()_\-.]/g, '').replace('δ', 'delta').replace('Δ', 'delta');
}

/** "CT", "C/T", "C|T", "c t" → "C/T". Returns undefined for no-calls ("--", "00", "./."). */
export function normalizeGenotype(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const s = input.trim().toUpperCase().replace(/\s+/g, '');
  let m = /^([ACGTDI])[/|]?([ACGTDI])$/.exec(s);
  if (m) return `${m[1]}/${m[2]}`;
  m = /^([ACGT]+)[/|]([ACGT]+)$/.exec(s);
  if (m) return `${m[1]}/${m[2]}`;
  m = /^([ACGT])[IL1|\\]([ACGT])$/.exec(s); // OCR often reads "/" as I, l or 1 ("CIT" → C/T)
  if (m) return `${m[1]}/${m[2]}`;
  m = /^([ACGT])$/.exec(s); // haploid call (X/Y/MT in males)
  if (m) return m[1];
  return undefined;
}

export function genotypeAlleles(genotype: string | undefined): string[] {
  if (!genotype) return [];
  return genotype.split('/').filter(Boolean);
}

export function parseZygosity(input: string | undefined): Zygosity | undefined {
  if (!input) return undefined;
  const s = input.toLowerCase();
  if (/hemi/.test(s)) return 'hemizygous';
  if (/hetero|\bhet\b|one copy|1 copy|carrier/.test(s)) return 'heterozygous';
  if (/homo(zygous)?\s*(ref|reference|wild)|wild[- ]?type|\bnormal\b/.test(s)) return 'homozygous-reference';
  if (/homo|\bhom\b|two copies|2 copies/.test(s)) return 'homozygous';
  return undefined;
}

const SIGNIFICANCE_PATTERNS: [RegExp, Significance][] = [
  [/likely[\s_-]*pathogenic/i, 'likely-pathogenic'],
  [/(?<!non[\s-]?|likely[\s_-]*)pathogenic/i, 'pathogenic'],
  [/uncertain|\bvus\b|unknown significance|conflicting/i, 'uncertain'],
  [/likely[\s_-]*benign/i, 'likely-benign'],
  [/(?<!likely[\s_-]*)\bbenign\b|non[\s-]?pathogenic/i, 'benign'],
  [/risk[\s_-]*factor|increased risk|risk allele/i, 'risk-factor'],
  [/protective/i, 'protective'],
  [/association|associated/i, 'association'],
];

export function normalizeSignificance(input: string | undefined): Significance | undefined {
  if (!input) return undefined;
  for (const [re, sig] of SIGNIFICANCE_PATTERNS) if (re.test(input)) return sig;
  return undefined;
}

export const SIGNIFICANCE_LABEL: Record<Significance, string> = {
  pathogenic: 'Pathogenic',
  'likely-pathogenic': 'Likely pathogenic',
  uncertain: 'Uncertain significance (VUS)',
  'likely-benign': 'Likely benign',
  benign: 'Benign',
  'risk-factor': 'Risk factor',
  association: 'Association',
  protective: 'Protective',
  'not-provided': 'Not established',
};

/** Fixes OCR confusions of l/I inside three-letter amino-acid codes: "p.GIn1756" → "p.Gln1756". */
function fixAminoAcids(token: string): string {
  return token.replace(/[A-Z][A-Za-z]{2}/g, (m) => {
    if (AA3[m.toLowerCase()]) return m;
    const alt = m[0] + m.slice(1).replace(/I/g, 'l');
    return AA3[alt.toLowerCase()] ? alt : m;
  });
}

export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/¢/g, 'c') // OCR reads "c." as "¢."
    .replace(/\bp[-,](?=\(?[A-Z][a-zA-Z]{2}\d)/g, 'p.')
    .replace(/\bp\.\(?[A-Za-z0-9*]+/g, fixAminoAcids)
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '');
}
