import type { ExtractedVariant, InputKind, ParsedInput, ParseWarning } from '../types';
import { GENES, KNOWN_RSIDS, resolveSnpRsId } from '../knowledge';
import { MESSAGES } from '../messages';
import { extractChromosomal } from './karyotype';
import { looksLikeSnpArray, parseSnpArray } from './snpArray';
import { extractFromReportText } from './textReport';
import { looksLikeVcf, parseVcf } from './vcf';

export { normalizeGenotype, normalizeHgvsC, normalizeRsId, normalizeGene, parseZygosity } from './normalize';
export { makeId } from './ids';

export { MESSAGES } from '../messages';

const LARGE_FILE_LINES = 20000;

export interface TextParseOptions {
  kind: InputKind;
  fileName?: string;
  ocrConfidence?: number;
  ocrEngine?: string;
}

/** True when a VCF record is worth sending for interpretation (used to shrink whole-genome files). */
function relevantVcfRecord(v: ExtractedVariant): boolean {
  const rs = resolveSnpRsId(v);
  if (rs && KNOWN_RSIDS.has(rs)) return true;
  if (v.gene && GENES[v.gene] && v.zygosity !== 'homozygous-reference') return true;
  return Boolean(v.reportedSignificance && /pathogenic/i.test(v.reportedSignificance) && !/benign|conflicting/i.test(v.reportedSignificance));
}

export function variantIsIncomplete(v: ExtractedVariant): boolean {
  const identified = Boolean(v.hgvsC || v.hgvsP || v.legacyName || v.rsId || (v.chromosome && v.position && v.alt));
  const dosage =
    Boolean(v.zygosity && v.zygosity !== 'unknown') || Boolean(v.genotype) || (v.gene === 'APOE' && /ε[234]\/ε[234]/.test(v.legacyName ?? ''));
  return !v.gene && !v.rsId ? true : !identified || !dosage;
}

/** Parses text from any source (OCR, PDF text layer, .txt/.vcf/.csv file) into a reviewable structure. */
export function parseTextInput(text: string, opts: TextParseOptions): ParsedInput {
  const warnings: ParseWarning[] = [];
  const lineCount = text.split('\n').length;

  if (looksLikeVcf(text)) {
    const large = lineCount > LARGE_FILE_LINES;
    const res = parseVcf(text, large ? { keep: relevantVcfRecord } : {});
    if (large)
      warnings.push({
        code: 'info',
        message: `Large file: ${res.totalRecords.toLocaleString('en')} records were read and the ${res.variants.length} records relevant to the GeneGuard knowledge base were kept. Nothing was uploaded.`,
      });
    warnings.push(...res.warnings);
    if (res.variants.length === 0) warnings.push({ code: 'no-genetic-info', message: MESSAGES.noGeneticInfo });
    return {
      kind: 'vcf',
      fileName: opts.fileName,
      dataScope: 'vcf',
      variants: res.variants,
      chromosomal: [],
      warnings,
      stats: { totalRecords: res.totalRecords, keptRecords: res.variants.length, skippedLines: res.skippedLines },
    };
  }

  if (looksLikeSnpArray(text)) {
    const res = parseSnpArray(text, { keep: (rs) => KNOWN_RSIDS.has(rs) });
    warnings.push(...res.warnings);
    warnings.push({
      code: 'info',
      message: `${res.markersGenotyped.toLocaleString('en')} genotyped markers found; ${res.variants.length} are covered by the GeneGuard knowledge base. Consumer genotyping arrays test selected positions only and can miss or mis-call rare variants.`,
    });
    if (res.variants.length === 0) warnings.push({ code: 'insufficient', message: MESSAGES.insufficient });
    return {
      kind: 'snp-array',
      fileName: opts.fileName,
      dataScope: 'snp-genotyping',
      variants: res.variants,
      chromosomal: [],
      warnings,
      stats: {
        totalRecords: res.markersGenotyped,
        keptRecords: res.variants.length,
        skippedLines: res.skippedLines,
        markersGenotyped: res.markersGenotyped,
      },
    };
  }

  const report = extractFromReportText(text, opts.kind);
  const chromosomal = extractChromosomal(text);
  warnings.push(...report.warnings);

  const incomplete = report.variants.filter(variantIsIncomplete);
  let dataScope: ParsedInput['dataScope'] = 'targeted-report';
  if (report.variants.length === 0 && chromosomal.length === 0) dataScope = 'unknown';
  else if (report.variants.length === 0) dataScope = 'cytogenetic-report';
  else if (opts.kind === 'photo' && (!report.looksComplete || incomplete.length > 0)) dataScope = 'partial-report';

  if (report.variants.length === 0 && chromosomal.length === 0) {
    warnings.unshift({ code: 'no-genetic-info', message: MESSAGES.noGeneticInfo });
  } else if (dataScope === 'partial-report' || incomplete.length > 0) {
    warnings.unshift({ code: 'partial', message: MESSAGES.partial });
  }
  for (const v of incomplete) {
    const name = [v.gene, v.hgvsC ?? v.legacyName ?? v.rsId].filter(Boolean).join(' ') || 'A variant';
    const missing = [
      !(v.hgvsC || v.hgvsP || v.legacyName || v.rsId) && 'the exact variant',
      !(v.zygosity || v.genotype) && 'zygosity / genotype',
    ].filter(Boolean);
    if (missing.length) warnings.push({ code: 'insufficient', message: `${MESSAGES.insufficient} ${name}: ${missing.join(' and ')} not found in the text.` });
  }
  if (opts.ocrConfidence !== undefined && opts.ocrConfidence < 60 && (report.variants.length || chromosomal.length)) {
    warnings.push({
      code: 'low-ocr-confidence',
      message: `Text recognition confidence is low (${Math.round(opts.ocrConfidence)}%). Please check every field carefully against the original document.`,
    });
  }

  return {
    kind: opts.kind,
    fileName: opts.fileName,
    dataScope,
    variants: report.variants,
    chromosomal,
    rawText: text,
    ocrConfidence: opts.ocrConfidence,
    ocrEngine: opts.ocrEngine,
    warnings,
    stats: { totalRecords: report.variants.length, keptRecords: report.variants.length, skippedLines: 0 },
  };
}
