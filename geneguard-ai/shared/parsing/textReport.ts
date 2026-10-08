import type { ExtractedVariant, InputKind, ParseWarning } from '../types';
import { findConditionInText, KNOWN_VARIANTS } from '../knowledge';
import { isRecognisedGene } from '../knowledge/genes';
import { makeId } from './ids';
import {
  aliasKey,
  cleanText,
  hgvsKey,
  normalizeGene,
  normalizeGenotype,
  normalizeHgvsC,
  normalizeRsId,
  parseZygosity,
} from './normalize';

// Extracts genetic variants from free text: OCR output of a photo, the text
// layer of a PDF or a pasted report. Only values that literally appear in the
// text are captured; missing fields stay empty for the user to review.

export interface TextExtractResult {
  variants: ExtractedVariant[];
  warnings: ParseWarning[];
  looksComplete: boolean;
  labStatements: string[];
}

const C_RE = /\bc\.\s?([-*]?\d+(?:[+-]\d+)?(?:_[-*]?\d+(?:[+-]\d+)?)?(?:[ACGT]\s?>\s?[ACGT]|del[ACGT]*ins[ACGT]+|del[ACGT]*|dup[ACGT]*|ins[ACGT]+|inv))/i;
const P_RE = /\bp\.\s?\(?((?:[A-Z][a-z]{2}\d+(?:[A-Z][a-z]{2}|\*|=|del|dup|ins)?(?:fs\*?\d*|Ter\d*|\*\d+)?)|(?:[A-Z]\d+(?:[A-Z*]|del|dup)?(?:fs\*?\d*)?))\)?/;
const RS_TOKEN_RE = /\b[rR][sS]\s?[0-9lIoO|]{2,12}\b/g;
const GT_SLASH_RE = /(?<![A-Za-z])([ACGT])\s?[/|]\s?([ACGT])(?![A-Za-z])/;
const ZYG_RE = /\b(heterozygous|heterozygote|homozygous|homozygote|hemizygous|het|hom)\b/i;
const SIG_RE = /\b(likely pathogenic|pathogenic|uncertain significance|variant of uncertain significance|vus|likely benign|benign|risk factor)\b/i;
const APOE_RE = /APOE[^\n]{0,40}?(?:ε|e|E|epsilon\s?)([234])\s?\/\s?(?:ε|e|E|epsilon\s?)?([234])\b/;
const DESCRIPTIVE_RE =
  /genes?\s+(analy[sz]ed|tested|included|covered|sequenced)|this (test|panel|report)|panel includes|methodology|limitations|disclaimer|is a gene|we tested|was tested|were tested|can detect|cannot detect|does not detect/i;
const NEGATIVE_RE = /\b(no|not|none|negative)\b[^.]{0,60}\b(variant|mutation|pathogenic|alteration)s?\b|\bnot detected\b|\bno (clinically )?significant\b|\bnegative result\b/i;
const HEADER_WORDS = /\b(gene|variant|zygosity|classification|rsid|rs id|genotype|condition|significance|chromosome|position)\b/gi;
const COMPLETE_RE = /genes?\s+(analy[sz]ed|tested|included|covered)|methodology|\bmethods?\b|test (description|performed)|limitations|coverage|panel/i;

type Field =
  | 'gene'
  | 'variant'
  | 'protein'
  | 'rsId'
  | 'chromosome'
  | 'position'
  | 'genotype'
  | 'zygosity'
  | 'significance'
  | 'condition'
  | 'interpretation'
  | 'legacy';

const KEY_PATTERNS: [RegExp, Field][] = [
  [/^gene(\s*(symbol|name))?$/i, 'gene'],
  [/^(variant|mutation|hgvs(\.?c)?|nucleotide change|c(oding)? ?dna( change)?|dna change|coding change|alteration)$/i, 'variant'],
  [/^(protein( change)?|amino acid( change)?|hgvs\.?p)$/i, 'protein'],
  [/^(rs ?id|rs ?number|dbsnp( id)?|snp( id)?|marker)$/i, 'rsId'],
  [/^(chromosome|chrom|chr)$/i, 'chromosome'],
  [/^(position|pos|genomic position|location|coordinates?|genomic coordinates?)$/i, 'position'],
  [/^(genotype|your genotype|alleles?)$/i, 'genotype'],
  [/^(zygosity|zygocity|copies)$/i, 'zygosity'],
  [/^(classification|clinical significance|significance|pathogenicity|variant classification|acmg classification)$/i, 'significance'],
  [/^(condition|disease|disorder|phenotype|associated (condition|disease|disorder|phenotype)s?|related condition)$/i, 'condition'],
  [/^(interpretation|lab(oratory)? interpretation|clinical interpretation|comments?)$/i, 'interpretation'],
  [/^(legacy name|common name|also known as|aka)$/i, 'legacy'],
];

// Start of a "Key:" pair anywhere in a line (OCR often collapses the spacing between columns).
const KEY_START_RE =
  /(?:^|(?<=[\s|]))(gene(?:\s*(?:symbol|name))?|variant|mutation|hgvs(?:\.?[cp])?|nucleotide change|c(?:oding)?\s?dna(?: change)?|dna change|coding change|alteration|protein(?: change)?|amino acid(?: change)?|rs\s?id|rs\s?number|dbsnp(?: id)?|snp(?: id)?|marker|chromosome|chrom|chr|position|genomic position|location|coordinates?|genotype|your genotype|alleles?|zygosity|zygocity|copies|classification|clinical significance|significance|pathogenicity|variant classification|acmg classification|condition|disease|disorder|phenotype|associated (?:condition|disease|disorder|phenotype)s?|related condition|interpretation|lab(?:oratory)? interpretation|clinical interpretation|comments?|legacy name|common name|also known as|aka)\s*[:=]/gi;

function fieldForKey(key: string): Field | undefined {
  const k = key.trim().replace(/\s+/g, ' ');
  return KEY_PATTERNS.find(([re]) => re.test(k))?.[1];
}

function geneTokenIn(text: string): string | undefined {
  for (const t of text.split(/[\s|,;:()[\]]+/)) {
    const g = normalizeGene(t);
    if (g && isRecognisedGene(g)) return g;
  }
  return undefined;
}

interface Draft {
  fields: Partial<Record<Field, string>>;
  lines: string[];
  lineIdx: number[];
}

function rsIdsIn(text: string): string[] {
  return [...text.matchAll(RS_TOKEN_RE)].map((m) => normalizeRsId(m[0])).filter((x): x is string => Boolean(x));
}

/** OCR sometimes reads "rs" as "$", "1s" or "r5" in table cells ("$6025"). Only corrected on lines that name a gene, and always reported. */
function fixMisreadRsIds(line: string, warnings: ParseWarning[]): string {
  const re = /(^|\s)(\$|[1lI|]s|r5|rn)(\d{3,10})(?=\s|$)/g;
  const tableRow = /\S {2,}\S/.test(line) || /\t/.test(line); // OCR keeps wide gaps between table columns
  if (!re.test(line) || !tableRow || !geneTokenIn(line)) return line;
  return line.replace(re, (_, pre: string, bad: string, digits: string) => {
    warnings.push({ code: 'low-ocr-confidence', message: `Possible OCR error corrected: “${bad}${digits}” was read as rs${digits}. Please verify it on the review screen.` });
    return `${pre}rs${digits}`;
  });
}

function aliasIn(text: string, gene?: string): string | undefined {
  const pool = gene ? KNOWN_VARIANTS.filter((k) => k.gene === gene) : KNOWN_VARIANTS;
  const tokens = text.split(/[\s,;()[\]]+/).filter(Boolean);
  for (const k of pool) {
    for (const alias of k.aliases) {
      if (alias.startsWith('c.')) continue;
      const key = aliasKey(alias);
      if (key.length < 4) continue;
      if (tokens.some((t) => aliasKey(t) === key) || (alias.includes(' ') && text.toLowerCase().includes(alias.toLowerCase()))) return alias;
    }
  }
  return undefined;
}

function conditionIn(text: string): string | undefined {
  const cond = findConditionInText(text);
  if (!cond) return undefined;
  const lower = text.toLowerCase();
  const alias = cond.aliases.find((a) => lower.includes(a))!;
  const i = lower.indexOf(alias);
  return text.slice(i, i + alias.length);
}

function draftToVariant(d: Draft, source: InputKind, warnings: ParseWarning[]): ExtractedVariant | undefined {
  const f = d.fields;
  const joined = d.lines.join(' ');
  let gene = normalizeGene(f.gene);
  if (gene && !isRecognisedGene(gene)) {
    warnings.push({ code: 'unknown-gene', message: `"${gene}" looks like a gene symbol but is not in the GeneGuard reference list.` });
  }
  const variantText = f.variant ?? '';
  const hgvsC = C_RE.exec(variantText)?.[0] ?? C_RE.exec(joined)?.[0];
  const hgvsP = P_RE.exec(f.protein ?? variantText)?.[0] ?? P_RE.exec(joined)?.[0];
  const rsId = normalizeRsId(f.rsId) ?? rsIdsIn(joined)[0];
  let legacyName = f.legacy?.trim() || undefined;
  if (!legacyName && variantText && !hgvsC && !hgvsP && !normalizeRsId(variantText)) legacyName = variantText.trim();
  legacyName = legacyName ?? aliasIn(joined, gene);
  const apoe = APOE_RE.exec(joined);
  if (apoe && (!gene || gene === 'APOE')) {
    gene = 'APOE';
    legacyName = `ε${apoe[1]}/ε${apoe[2]}`;
  }

  let genotype: string | undefined;
  if (f.genotype) genotype = normalizeGenotype(f.genotype) ?? normalizeGenotype(f.genotype.split(/\s+/)[0]);
  if (!genotype && rsId) {
    const gt = GT_SLASH_RE.exec(joined);
    if (gt) genotype = normalizeGenotype(`${gt[1]}${gt[2]}`);
    // Standalone genotype tokens: "CT", or OCR forms such as "CIT" / "cic" (slash read as I or l)
    for (const t of joined.replace(/\brs\S+/gi, ' ').split(/[\s|,;:()]+/)) {
      if (genotype) break;
      if (/^[ACGT]{2}$/.test(t) || /^[ACGTacgt][Il1i|\\][ACGTacgt]$/.test(t)) genotype = normalizeGenotype(t);
    }
  }
  const zygosity = parseZygosity(f.zygosity) ?? parseZygosity(ZYG_RE.exec(joined)?.[0]);
  const significance = f.significance?.trim() || SIG_RE.exec(joined)?.[0];

  let chromosome = /^(?:chr)?(\d{1,2}|X|Y|MT)\b/i.exec(f.chromosome?.trim() ?? '')?.[1]?.toUpperCase();
  let position: number | undefined;
  const coord = /(?:chr)?(\d{1,2}|X|Y)\s*:\s*g?\.?\s*([\d,]{3,})/i.exec(f.position ?? joined);
  if (coord) {
    chromosome = chromosome ?? coord[1].toUpperCase();
    position = Number(coord[2].replace(/,/g, ''));
  } else if (f.position) {
    const n = Number(f.position.replace(/[,\s]/g, ''));
    if (Number.isInteger(n) && n > 0) position = n;
  }
  if (chromosome && !/^(\d{1,2}|X|Y|MT)$/.test(chromosome)) chromosome = undefined;

  const identifying = Boolean(hgvsC || hgvsP || rsId || legacyName);
  const evidence = Boolean(genotype || zygosity || significance);
  if (!(gene && (identifying || evidence)) && !(rsId && (genotype || zygosity || gene))) return undefined;

  return {
    id: makeId('txt'),
    gene,
    hgvsC: normalizeHgvsC(hgvsC),
    hgvsP: hgvsP?.replace(/\s+/g, '').replace(/^(p\.[^(]*)\)$/, '$1'),
    legacyName,
    rsId,
    chromosome,
    position,
    genotype,
    zygosity,
    reportedSignificance: significance,
    reportedCondition: f.condition?.trim() || conditionIn(joined),
    labInterpretation: f.interpretation?.trim(),
    source,
    sourceText: d.lines.join('\n'),
  };
}

function mergeKey(v: ExtractedVariant): string {
  if (v.gene && (v.hgvsC || v.legacyName)) return `${v.gene}|${hgvsKey(v.hgvsC) ?? aliasKey(v.legacyName!)}`;
  if (v.rsId) return v.rsId;
  return `${v.gene}|${v.hgvsP ?? v.id}`;
}

function mergeVariants(list: ExtractedVariant[]): ExtractedVariant[] {
  const byKey = new Map<string, ExtractedVariant>();
  const byRs = new Map<string, ExtractedVariant>();
  for (const v of list) {
    const existing = byKey.get(mergeKey(v)) ?? (v.rsId ? byRs.get(v.rsId) : undefined);
    if (existing) {
      for (const [k, val] of Object.entries(v) as [keyof ExtractedVariant, unknown][]) {
        if (k === 'id' || k === 'sourceText') continue;
        if (existing[k] === undefined && val !== undefined) (existing as unknown as Record<string, unknown>)[k] = val;
      }
      if (v.sourceText && !existing.sourceText?.includes(v.sourceText)) existing.sourceText = `${existing.sourceText}\n${v.sourceText}`;
      continue;
    }
    byKey.set(mergeKey(v), v);
    if (v.rsId) byRs.set(v.rsId, v);
  }
  return [...byKey.values()];
}

export function extractFromReportText(input: string, source: InputKind): TextExtractResult {
  const text = cleanText(input);
  const warnings: ParseWarning[] = [];
  const labStatements: string[] = [];
  const lines = text.split('\n').map((l) => fixMisreadRsIds(l.trim(), warnings));
  const drafts: Draft[] = [];

  // Pass 1 — "Key: value" blocks (one block per gene).
  let block: Draft | undefined;
  const kvLines = new Set<number>();
  const flush = () => {
    if (block && Object.keys(block.fields).length) drafts.push(block);
    block = undefined;
  };
  const setField = (field: Field, value: string) => {
    const startsNew = (field === 'gene' && block?.fields.gene) || (field === 'rsId' && block?.fields.rsId && !block.fields.gene);
    if (startsNew) flush();
    block = block ?? { fields: {}, lines: [], lineIdx: [] };
    if (!block.fields[field]) block.fields[field] = value;
  };
  lines.forEach((line, i) => {
    if (!line) return;
    const starts = [...line.matchAll(KEY_START_RE)].filter((m) => fieldForKey(m[1]));
    if (starts.length === 0) return;
    // Text before the first key, e.g. "APOE  genotype: e3/e4" → the gene this line is about.
    const lead = line.slice(0, starts[0].index).trim();
    const leadGene = lead ? geneTokenIn(lead) : undefined;
    if (leadGene) setField('gene', leadGene);
    starts.forEach((m, k) => {
      const end = k + 1 < starts.length ? starts[k + 1].index : line.length;
      const value = line
        .slice(m.index + m[0].length, end)
        .replace(/[|]+\s*$/, '')
        .trim();
      if (!value) return;
      const field = fieldForKey(m[1])!;
      setField(field, field === 'gene' ? (geneTokenIn(value) ?? value.split(/\s+/)[0]) : value);
    });
    kvLines.add(i);
    if (block && !block.lines.includes(line)) {
      block.lines.push(line);
      block.lineIdx.push(i);
    }
  });
  flush();

  // Pass 2 — table rows / free sentences that mention a gene or rsID next to variant details.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || kvLines.has(i)) continue;
    if (DESCRIPTIVE_RE.test(line)) continue;
    if (NEGATIVE_RE.test(line)) {
      if (/[A-Z0-9]{3,}/.test(line)) labStatements.push(line);
      continue;
    }
    const headerHits = line.match(HEADER_WORDS)?.length ?? 0;
    if (headerHits >= 2 && !C_RE.test(line) && rsIdsIn(line).length === 0) continue;

    const tokens = line.split(/[\s|,;:()[\]]+/).filter(Boolean);
    let gene = tokens.map((t) => normalizeGene(t)).find((t) => t && isRecognisedGene(t));
    const cMatch = C_RE.exec(line);
    if (!gene && cMatch) {
      const before = line.slice(0, cMatch.index).trim().split(/[\s|,;:()]+/).pop();
      if (before && /^[A-Z][A-Z0-9-]{1,9}$/.test(before)) gene = before;
    }
    const rsIds = rsIdsIn(line);
    if (!gene && rsIds.length === 0) {
      // An orphan HGVS change (e.g. the "Variant:" label was cut off in a photo) next to a gene block.
      const near = cMatch && drafts.find((d) => d.fields.gene && !d.fields.variant && d.lineIdx.some((j) => Math.abs(j - i) <= 2));
      if (near && cMatch) {
        near.fields.variant = cMatch[0];
        near.lines.push(line);
        near.lineIdx.push(i);
      }
      continue;
    }

    const draft: Draft = { fields: gene ? { gene } : {}, lines: [line], lineIdx: [i] };
    // A wrapped table row: the next line carries zygosity / classification without a new gene or rsID.
    const next = lines[i + 1];
    if (next && !kvLines.has(i + 1) && (ZYG_RE.test(next) || SIG_RE.test(next)) && !rsIdsIn(next).length) {
      const nextGene = next.split(/[\s|,;:()]+/).some((t) => {
        const g = normalizeGene(t);
        return g && isRecognisedGene(g);
      });
      if (!nextGene && !NEGATIVE_RE.test(next)) {
        draft.lines.push(next);
        draft.lineIdx.push(i + 1);
        i++;
      }
    }
    if (rsIds.length > 1 && !gene) {
      // Several SNPs on one line: "rs7903146 CT rs1801282 CC" — split per rsID.
      for (const part of line.split(/(?=\b[rR][sS]\s?\d)/)) if (rsIdsIn(part).length) drafts.push({ fields: {}, lines: [part.trim()], lineIdx: [i] });
      continue;
    }
    drafts.push(draft);
  }

  const variants = mergeVariants(drafts.map((d) => draftToVariant(d, source, warnings)).filter((v): v is ExtractedVariant => Boolean(v)));
  // APOE genotypes are often written as a sentence ("APOE genotype: ε3/ε4").
  const apoe = APOE_RE.exec(text);
  if (apoe && !variants.some((v) => v.gene === 'APOE' && v.legacyName)) {
    const v = draftToVariant({ fields: { gene: 'APOE' }, lines: [apoe[0]], lineIdx: [] }, source, warnings);
    if (v) variants.push(v);
  }
  for (const s of labStatements) warnings.push({ code: 'info', message: `Report states: “${s}”` });

  return { variants, warnings: dedupeWarnings(warnings), looksComplete: COMPLETE_RE.test(text), labStatements };
}

function dedupeWarnings(list: ParseWarning[]): ParseWarning[] {
  const seen = new Set<string>();
  return list.filter((w) => (seen.has(w.message) ? false : (seen.add(w.message), true)));
}
