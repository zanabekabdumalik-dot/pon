import type {
  ClinvarRecord,
  Confidence,
  EvidenceLevel,
  ExtractedVariant,
  Finding,
  ParsedInput,
  ParseWarning,
  RiskLevel,
  Significance,
  SourceRef,
} from '../types';
import {
  APOE_INTERPRETATION,
  APOE_SNPS,
  APOE_SOURCES,
  CONDITIONS,
  findKnownVariant,
  GENES,
  PRS_SNP_INDEX,
  resolveSnpRsId,
  type ApoeGenotype,
  type KnownVariant,
  type MatchMethod,
} from '../knowledge';
import { ACMG_GUIDELINE, clinvarGene, clinvarRs, clinvarTerm, dbsnp } from '../knowledge/sources';
import { makeId } from '../parsing/ids';
import { MESSAGES } from '../messages';
import { genotypeAlleles, normalizeSignificance, SIGNIFICANCE_LABEL } from '../parsing/normalize';
import { lowerFirst } from '../text';
import type { SnpObservation } from './prs';

export interface InterpretOutput {
  findings: Finding[];
  snpObservations: Map<string, SnpObservation>;
  testedNotDetected: { gene: string; variant: string; genotype?: string }[];
  notInterpreted: number;
  knowledgeBaseMatches: number;
  warnings: ParseWarning[];
}

const CONF_ORDER: Confidence[] = ['high', 'medium', 'low', 'insufficient'];
const minConf = (a: Confidence, b: Confidence): Confidence => (CONF_ORDER.indexOf(a) >= CONF_ORDER.indexOf(b) ? a : b);
const RISK_ORDER: RiskLevel[] = ['not-assessable', 'low', 'average', 'elevated', 'high'];
export const maxRisk = (list: RiskLevel[]): RiskLevel =>
  list.reduce<RiskLevel>((m, r) => (RISK_ORDER.indexOf(r) > RISK_ORDER.indexOf(m) ? r : m), 'not-assessable');

const COMMON_KB_VARIANTS = new Set(['hfe-c282y', 'hfe-h63d', 'f5-leiden', 'f2-g20210a', 'mthfr-c677t', 'hbb-hbs']);

function dataConfidence(v: ExtractedVariant, input: ParsedInput, kv?: KnownVariant): { level: Confidence; reason: string } {
  switch (v.source) {
    case 'vcf': {
      const problems: string[] = [];
      if (v.filter && v.filter !== 'PASS') problems.push(`FILTER=${v.filter}`);
      if (v.quality !== undefined && v.quality < 30) problems.push(`QUAL ${v.quality}`);
      if (v.genotypeQuality !== undefined && v.genotypeQuality < 20) problems.push(`GQ ${v.genotypeQuality}`);
      if (v.readDepth !== undefined && v.readDepth < 10) problems.push(`read depth ${v.readDepth}`);
      return problems.length
        ? { level: 'low', reason: `The variant call has low quality (${problems.join(', ')}); it may be a sequencing artefact.` }
        : { level: 'high', reason: 'Good-quality variant call from a VCF file.' };
    }
    case 'snp-array':
      if (kv && kv.category === 'monogenic' && !COMMON_KB_VARIANTS.has(kv.id))
        return {
          level: 'low',
          reason: 'Consumer genotyping arrays often mis-call rare variants like this one; it must be confirmed with a clinical-grade test.',
        };
      return { level: 'medium', reason: 'Genotype from consumer array data (not a clinical test).' };
    case 'photo':
      return input.ocrConfidence !== undefined && input.ocrConfidence < 60
        ? { level: 'low', reason: 'Read from a photo with low OCR confidence.' }
        : { level: 'medium', reason: 'Read from a photo/screenshot with OCR and checked by you.' };
    case 'pdf':
      return input.ocrEngine
        ? { level: 'medium', reason: 'Read from a scanned PDF with OCR and checked by you.' }
        : { level: 'high', reason: 'Read from the text of a PDF report and checked by you.' };
    case 'text':
      return { level: 'high', reason: 'Read from a text report and checked by you.' };
    case 'manual':
      return { level: 'medium', reason: 'Entered manually — please double-check against the original report.' };
    case 'demo':
      return { level: 'high', reason: 'Synthetic demonstration data entered exactly.' };
  }
}

type Count = { count: number | null; how: string };

function effectAlleleCount(v: ExtractedVariant, kv: KnownVariant): Count & { mismatch?: string } {
  const alleles = genotypeAlleles(v.genotype);
  if (kv.effectAllele && alleles.length > 0 && alleles.every((a) => a.length === 1)) {
    if (!alleles.every((a) => a === kv.effectAllele || a === kv.otherAllele)) {
      return {
        count: null,
        how: 'genotype',
        mismatch: `Genotype ${v.genotype} does not match the expected alleles ${kv.otherAllele}/${kv.effectAllele} (possible strand or assembly difference).`,
      };
    }
    return { count: alleles.filter((a) => a === kv.effectAllele).length, how: `genotype ${v.genotype}` };
  }
  switch (v.zygosity) {
    case 'heterozygous':
      return { count: 1, how: 'heterozygous' };
    case 'homozygous':
      return { count: 2, how: 'homozygous' };
    case 'hemizygous':
      return { count: 1, how: 'hemizygous' };
    case 'homozygous-reference':
      return { count: 0, how: 'homozygous reference' };
    default:
      return { count: null, how: 'not provided' };
  }
}

type SigGroup = 'P' | 'B' | 'U' | 'R' | undefined;
const sigGroup = (s: Significance | undefined): SigGroup =>
  s === 'pathogenic' || s === 'likely-pathogenic'
    ? 'P'
    : s === 'benign' || s === 'likely-benign'
      ? 'B'
      : s === 'uncertain'
        ? 'U'
        : s === 'risk-factor' || s === 'association' || s === 'protective'
          ? 'R'
          : undefined;

const MATCH_LABEL: Record<MatchMethod, string> = {
  rsid: 'rsID',
  'hgvs-c': 'cDNA (HGVS c.) notation',
  'hgvs-p': 'protein (HGVS p.) notation',
  alias: 'common / legacy variant name',
  position: 'genomic position and alleles (GRCh38)',
};

function plainExplanation(gene: string, condition: string, mechanism: string | undefined, inheritance: string): string {
  const info = GENES[gene];
  const role = info ? `The ${gene} gene ${info.role}. ` : '';
  const inh = /recessive/i.test(inheritance)
    ? 'Conditions linked to this gene usually appear only when both copies of the gene are affected.'
    : /dominant/i.test(inheritance)
      ? 'One altered copy of this gene can be enough to raise risk, but it does not make the condition certain.'
      : 'Its effect depends on many other genetic and lifestyle factors.';
  return `Your data contains a variant in the ${gene} gene. ${role}${mechanism ? `${mechanism} ` : ''}Some variants in this gene are associated with ${lowerFirst(condition)}. ${inh} The presence of a variant alone does not necessarily mean that you have, or will develop, the condition.`;
}

function kbFinding(
  v: ExtractedVariant,
  kv: KnownVariant,
  method: MatchMethod,
  count: Count,
  input: ParsedInput,
  warnings: ParseWarning[],
): Finding {
  const condition = kv.conditionLabel ?? CONDITIONS[kv.conditionKey]?.name ?? kv.conditionKey;
  const notes: string[] = [`Matched to the knowledge base by ${MATCH_LABEL[method]}.`, ...(kv.notes ?? [])];
  let conf = dataConfidence(v, input, kv);
  let interp = count.count !== null ? kv.copies[(Math.min(count.count, 2) as 1 | 2) || 1] : undefined;
  let requiresConfirmation = kv.category === 'monogenic' && kv.significance !== 'association';

  if (count.count === null) {
    const sameRisk = kv.copies[1].risk === kv.copies[2].risk || (kv.copies[1].risk !== 'low' && kv.copies[2].risk !== 'low');
    if (sameRisk) {
      interp = { ...kv.copies[1], text: `${kv.copies[1].text} (The number of copies was not provided.)` };
      conf = { level: minConf(conf.level, 'medium'), reason: `${conf.reason} Zygosity was not provided.` };
    } else {
      interp = {
        risk: 'average',
        headline: 'Number of copies not provided — interpretation limited',
        text: `${MESSAGES.insufficient} For this condition one copy usually means carrier status while two copies may cause the condition, so zygosity (heterozygous or homozygous) is needed. ${MESSAGES.uncertain}`,
        clinicallyRelevant: true,
      };
      conf = { level: 'low', reason: `${conf.reason} Zygosity was not provided.` };
    }
  }
  const reported = normalizeSignificance(v.reportedSignificance);
  if (reported) {
    const conflict = sigGroup(reported) !== sigGroup(kv.significance) && !(sigGroup(reported) === 'P' && sigGroup(kv.significance) === 'R');
    if (conflict) {
      notes.push(
        `The submitted data lists this variant as "${v.reportedSignificance}", while the GeneGuard knowledge base lists "${kv.significanceLabel}". Classifications can change over time.`,
      );
      conf = { level: 'low', reason: 'The submitted report and the knowledge base disagree about this variant.' };
      warnings.push({ code: 'conflict', message: `${kv.gene} ${kv.name}: classification differs between your data and the knowledge base. ${MESSAGES.uncertain}` });
      requiresConfirmation = true;
    } else {
      notes.push(`Your data reports this variant as "${v.reportedSignificance}", consistent with the knowledge base.`);
    }
  }
  if (v.fictional) notes.push('This is a fictional demonstration variant.');
  if (kv.evidence === 'limited') conf = { level: minConf(conf.level, 'medium'), reason: conf.reason };

  return {
    id: makeId('f'),
    category: kv.category,
    variantIds: [v.id],
    gene: kv.gene,
    variantLabel: kv.name,
    rsId: kv.rsId ?? v.rsId,
    genotype: v.genotype,
    zygosity: v.zygosity ?? (count.count === 1 ? 'heterozygous' : count.count === 2 ? 'homozygous' : undefined),
    condition,
    conditionKey: kv.conditionKey,
    inheritance: kv.inheritance,
    significance: kv.significance,
    significanceLabel: kv.significanceLabel,
    significanceSource: 'knowledge-base',
    evidence: kv.evidence,
    confidence: conf.level,
    confidenceReason: conf.reason,
    risk: interp!.risk,
    riskHeadline: interp!.headline,
    interpretation: interp!.text,
    explanation: plainExplanation(kv.gene, condition, kv.mechanism, kv.inheritance),
    explanationSource: 'built-in',
    carrier: Boolean(interp!.carrier),
    clinicallyRelevant: interp!.clinicallyRelevant,
    requiresConfirmation,
    knowledgeBaseId: kv.id,
    sources: [...kv.sources, ...(GENES[kv.gene]?.sources ?? []), ...(CONDITIONS[kv.conditionKey]?.sources ?? []), ACMG_GUIDELINE],
    notes,
    demo: v.demo,
  };
}

const CLINVAR_EVIDENCE = (review: string): EvidenceLevel => {
  const r = review.toLowerCase();
  if (/practice guideline|expert panel/.test(r)) return 'high';
  if (/multiple submitters/.test(r) && !/conflict/.test(r)) return 'moderate';
  if (/single submitter|conflicting/.test(r)) return 'limited';
  return 'unknown';
};

/** Interpretation for a variant that is not in the curated knowledge base. */
function unknownFinding(v: ExtractedVariant, input: ParsedInput, clinvar: ClinvarRecord | undefined): Finding {
  const gene = v.gene ?? clinvar?.gene;
  const info = gene ? GENES[gene] : undefined;
  const condInfo = info?.conditionKeys.map((k) => CONDITIONS[k]).find(Boolean);
  const label = [v.hgvsC, v.hgvsP && `(${v.hgvsP})`, v.legacyName && !v.hgvsC ? v.legacyName : undefined].filter(Boolean).join(' ') || v.rsId || 'Exact variant not identified';
  const data = dataConfidence(v, input);
  const notes: string[] = [];
  const sources: SourceRef[] = [];
  if (v.rsId) sources.push(clinvarRs(v.rsId), dbsnp(v.rsId));
  else if (gene && v.hgvsC) sources.push(clinvarTerm(gene, v.hgvsC));
  else if (gene) sources.push(clinvarGene(gene));
  if (info) sources.push(...info.sources);
  if (condInfo) sources.push(...condInfo.sources);

  let significance: Significance = 'not-provided';
  let significanceSource: Finding['significanceSource'] = 'none';
  let evidence: EvidenceLevel = 'unknown';
  let significanceLabel = SIGNIFICANCE_LABEL['not-provided'];
  if (clinvar) {
    significance = normalizeSignificance(clinvar.significance) ?? 'not-provided';
    significanceLabel = clinvar.significance || significanceLabel;
    significanceSource = 'clinvar-live';
    evidence = CLINVAR_EVIDENCE(clinvar.reviewStatus);
    notes.push(`Live ClinVar lookup: "${clinvar.significance}" (review status: ${clinvar.reviewStatus}).`);
    sources.unshift({ name: 'ClinVar', label: `ClinVar record ${clinvar.uid}: ${clinvar.title}`, url: clinvar.url });
  } else if (v.reportedSignificance) {
    significance = normalizeSignificance(v.reportedSignificance) ?? 'not-provided';
    significanceLabel = `${v.reportedSignificance} (as reported)`;
    significanceSource = 'report';
    evidence = v.source === 'vcf' ? 'limited' : 'moderate';
    notes.push(
      v.source === 'vcf'
        ? 'The classification comes from an annotation inside the file and was not independently verified.'
        : 'The classification comes from the laboratory report; GeneGuard has no independent data about this exact variant.',
    );
  }
  const condition = v.reportedCondition ?? clinvar?.conditions[0] ?? condInfo?.name ?? 'Not established';
  const inheritance = info?.inheritance === 'dominant' ? 'Autosomal dominant (gene level)' : info?.inheritance === 'recessive' ? 'Autosomal recessive (gene level)' : 'Unknown';
  const exact = Boolean(v.hgvsC || v.hgvsP || v.legacyName || v.rsId);

  let risk: RiskLevel = 'average';
  let headline: string = MESSAGES.unknownVariant;
  let text = `${MESSAGES.unknownVariant} ${MESSAGES.evidenceInsufficient}`;
  let carrier = false;
  let relevant = false;
  let confidence: Confidence = 'insufficient';
  let reason = 'There is no curated evidence about this variant in the GeneGuard knowledge base.';
  const group = sigGroup(significance);

  if (group === 'P') {
    relevant = true;
    confidence = minConf(data.level, exact ? 'medium' : 'low');
    reason = `${data.reason} Interpretation relies on the reported classification${info ? ' and general information about the gene' : ''}.`;
    const recessive = info?.inheritance === 'recessive';
    if (recessive && v.zygosity === 'heterozygous') {
      risk = 'low';
      carrier = true;
      headline = 'Carrier of a reported pathogenic variant';
      text = `A variant classified as ${significanceLabel.toLowerCase()} was found in one copy of ${gene}. Conditions linked to ${gene} are usually recessive, so one copy typically means carrier status. This is relevant for family planning.`;
    } else if (recessive && v.zygosity !== 'homozygous') {
      risk = 'average';
      headline = 'Reported pathogenic variant — number of copies unknown';
      text = `${MESSAGES.insufficient} Whether this means carrier status or a higher risk depends on the number of copies. ${MESSAGES.uncertain}`;
      confidence = 'low';
    } else if (info) {
      risk = 'high';
      headline = `Reported pathogenic variant in ${gene}`;
      text = `The ${significanceSource === 'clinvar-live' ? 'ClinVar database' : 'submitted data'} classifies this ${gene} variant as ${significanceLabel.toLowerCase()}. ${gene} variants of this kind are associated with ${lowerFirst(condition)}. This does not mean the condition is present or certain; it should be confirmed and discussed with a genetic specialist.`;
    } else {
      risk = 'elevated';
      headline = 'Reported pathogenic variant in a gene not covered by GeneGuard';
      text = `The variant is classified as ${significanceLabel.toLowerCase()}, but GeneGuard has no curated information about the associated condition. ${MESSAGES.uncertain}`;
      confidence = 'low';
    }
  } else if (group === 'U') {
    risk = 'average';
    headline = 'Variant of uncertain significance (VUS)';
    text =
      'A variant of uncertain significance means there is not yet enough evidence to say whether it affects health. VUS results should not be used to make medical decisions; many are later reclassified as benign.';
    confidence = minConf(data.level, 'medium');
    reason = `${data.reason} The variant itself has uncertain significance.`;
  } else if (group === 'B') {
    risk = 'low';
    headline = 'Classified as benign / likely benign';
    text = 'This variant is classified as benign or likely benign, so it is not expected to cause disease. Lower estimated genetic risk does not eliminate the possibility of disease.';
    confidence = minConf(data.level, 'medium');
    reason = `${data.reason} Classification from ${significanceSource === 'clinvar-live' ? 'ClinVar' : 'the submitted data'}.`;
  } else if (group === 'R') {
    risk = 'average';
    headline = 'Reported as a risk factor — size of effect unknown';
    text = `The variant is reported as a risk factor or association, but GeneGuard cannot estimate the size of its effect. ${MESSAGES.uncertain}`;
    confidence = 'low';
    reason = `${data.reason} Effect size not available.`;
  }
  if (!exact) {
    notes.push('The exact variant (HGVS notation or rsID) was not found in your data, so only gene-level information can be used.');
    confidence = minConf(confidence, 'low');
  }
  if (v.fictional) notes.push('This is a fictional demonstration variant, included to show how GeneGuard handles a variant it cannot interpret.');

  return {
    id: makeId('f'),
    category: info?.category === 'multifactorial' ? 'multifactorial' : 'monogenic',
    variantIds: [v.id],
    gene,
    variantLabel: label,
    rsId: v.rsId,
    genotype: v.genotype,
    zygosity: v.zygosity,
    condition,
    conditionKey: condInfo?.key,
    inheritance,
    significance,
    significanceLabel,
    significanceSource,
    evidence,
    confidence,
    confidenceReason: reason,
    risk,
    riskHeadline: headline,
    interpretation: text,
    explanation: gene
      ? plainExplanation(gene, condInfo?.name ?? 'health conditions', undefined, inheritance)
      : 'A genetic variant was found, but without a gene name GeneGuard cannot explain what it might affect.',
    explanationSource: 'built-in',
    carrier,
    clinicallyRelevant: relevant,
    requiresConfirmation: group === 'P' || group === 'U' || group === undefined,
    sources,
    notes,
    demo: v.demo,
  };
}

function apoeFromText(legacy: string | undefined): ApoeGenotype | undefined {
  const m = /ε?([234])\s*\/\s*ε?([234])/.exec(legacy ?? '');
  if (!m) return undefined;
  const [a, b] = [m[1], m[2]].sort();
  return `e${a}/e${b}` as ApoeGenotype;
}

function apoeFinding(variants: ExtractedVariant[], obs: Map<string, SnpObservation>, input: ParsedInput): Finding | undefined {
  const textual = variants.find((v) => v.gene === 'APOE' && apoeFromText(v.legacyName));
  const s4 = obs.get('rs429358');
  const s2 = obs.get('rs7412');
  let genotype: ApoeGenotype | undefined;
  let how = '';
  let conf: Confidence = 'high';
  let reason = '';
  const ids: string[] = [];
  const source = textual ?? variants.find((v) => v.rsId === 'rs429358' || v.rsId === 'rs7412');
  if (!source) return undefined;
  const data = dataConfidence(source, input);

  if (textual) {
    genotype = apoeFromText(textual.legacyName);
    how = `reported as ${textual.legacyName}`;
    ids.push(textual.id);
    conf = data.level;
    reason = data.reason;
  } else {
    const count = (o: SnpObservation | undefined, allele: string) => {
      const al = genotypeAlleles(o?.genotype);
      return al.length === 2 ? al.filter((a) => a === allele).length : undefined;
    };
    const c4 = count(s4, APOE_SNPS.rs429358.effectAllele);
    const t2 = count(s2, APOE_SNPS.rs7412.effectAllele);
    for (const v of variants) if (v.rsId === 'rs429358' || v.rsId === 'rs7412') ids.push(v.id);
    if (c4 === undefined && t2 === undefined) return undefined;
    how = `rs429358 ${s4?.genotype ?? 'not tested'}, rs7412 ${s2?.genotype ?? 'not tested'}`;
    reason = data.reason;
    conf = data.level;
    if (c4 !== undefined && t2 !== undefined) {
      const table: Record<string, ApoeGenotype> = { '0,0': 'e3/e3', '1,0': 'e3/e4', '2,0': 'e4/e4', '0,1': 'e2/e3', '0,2': 'e2/e2', '1,1': 'e2/e4' };
      genotype = table[`${c4},${t2}`];
      if (!genotype) {
        return {
          ...baseApoe(ids, how, source),
          risk: 'average',
          riskHeadline: 'Unusual APOE combination',
          interpretation: `This combination of APOE SNPs is very rare or may reflect a genotyping error. ${MESSAGES.uncertain}`,
          confidence: 'low',
          confidenceReason: 'Unusual genotype combination.',
          significance: 'not-provided',
          significanceLabel: SIGNIFICANCE_LABEL['not-provided'],
          clinicallyRelevant: false,
        };
      }
    } else if (c4 !== undefined) {
      conf = 'low';
      reason = 'Only one of the two SNPs that define APOE alleles (rs429358) was available.';
      genotype = c4 === 0 ? 'e3/e3' : c4 === 1 ? 'e3/e4' : 'e4/e4';
      how += ' — ε2 status unknown';
    } else {
      return undefined; // rs7412 alone cannot tell anything about ε4
    }
  }
  if (!genotype) return undefined;
  const interp = APOE_INTERPRETATION[genotype];
  const hasE4 = genotype.includes('e4');
  const hasE2 = genotype.includes('e2');
  return {
    ...baseApoe(ids, how, source),
    variantLabel: `${interp.label}${how.startsWith('reported') ? '' : ` (${how})`}`,
    significance: hasE4 ? 'risk-factor' : hasE2 ? 'protective' : 'association',
    significanceLabel: hasE4 ? 'Established risk factor (ε4 allele)' : hasE2 ? 'Associated with lower risk (ε2 allele)' : 'Reference (most common) genotype',
    confidence: conf,
    confidenceReason: reason,
    risk: interp.risk,
    riskHeadline: interp.headline,
    interpretation: interp.text,
    clinicallyRelevant: interp.clinicallyRelevant,
    requiresConfirmation: hasE4,
  };
}

function baseApoe(ids: string[], how: string, source: ExtractedVariant): Finding {
  const cond = CONDITIONS.alzheimers;
  return {
    id: makeId('f'),
    category: 'multifactorial',
    variantIds: ids,
    gene: 'APOE',
    variantLabel: `APOE (${how})`,
    rsId: undefined,
    genotype: undefined,
    condition: cond.name,
    conditionKey: cond.key,
    inheritance: 'Complex — APOE is a risk factor, not a direct cause',
    significance: 'association',
    significanceLabel: '',
    significanceSource: 'knowledge-base',
    evidence: 'high',
    confidence: 'medium',
    confidenceReason: '',
    risk: 'average',
    riskHeadline: '',
    interpretation: '',
    explanation:
      'APOE comes in three common versions — ε2, ε3 and ε4 — and everyone has two copies. The gene helps carry cholesterol and other fats in the blood and brain. The ε4 version is the strongest common genetic risk factor for late-onset Alzheimer’s disease, but it is neither necessary nor sufficient for the disease.',
    explanationSource: 'built-in',
    carrier: false,
    clinicallyRelevant: false,
    requiresConfirmation: false,
    knowledgeBaseId: 'apoe',
    sources: [...APOE_SOURCES, ...GENES.APOE.sources, ...cond.sources],
    notes: ['APOE alleles are defined by two SNPs: rs429358 (C = ε4) and rs7412 (T = ε2).'],
    demo: source.demo,
  };
}

/** Rules that depend on more than one variant in the same gene. */
function applyCombinationRules(findings: Finding[]) {
  const byGene = new Map<string, Finding[]>();
  for (const f of findings) if (f.gene) byGene.set(f.gene, [...(byGene.get(f.gene) ?? []), f]);

  const hbs = findings.find((f) => f.knowledgeBaseId === 'hbb-hbs' && f.carrier);
  const hbc = findings.find((f) => f.knowledgeBaseId === 'hbb-hbc' && f.carrier);
  if (hbs && hbc) {
    for (const f of [hbs, hbc]) {
      f.risk = 'high';
      f.carrier = false;
      f.riskHeadline = 'HbS and HbC together — possible HbSC disease';
      f.interpretation =
        'One copy each of HbS and HbC may indicate HbSC disease (a form of sickle cell disease) if they are on different copies of the gene. This needs confirmation by haemoglobin analysis.';
      f.requiresConfirmation = true;
    }
  }
  const c282y = findings.find((f) => f.knowledgeBaseId === 'hfe-c282y' && f.carrier);
  const h63d = findings.find((f) => f.knowledgeBaseId === 'hfe-h63d' && f.zygosity === 'heterozygous');
  if (c282y && h63d) {
    c282y.carrier = false;
    c282y.risk = 'average';
    c282y.riskHeadline = 'C282Y/H63D compound heterozygous — slightly increased risk';
    c282y.interpretation =
      'One copy each of C282Y and H63D is associated with a slightly higher chance of raised iron levels, but most people with this combination never develop iron overload.';
  }
  const fvl = findings.find((f) => f.knowledgeBaseId === 'f5-leiden' && f.risk !== 'low');
  const pt = findings.find((f) => f.knowledgeBaseId === 'f2-g20210a' && f.risk !== 'low');
  if (fvl && pt) for (const f of [fvl, pt]) f.notes.push('Factor V Leiden and prothrombin G20210A were both found; together they increase clotting risk more than either alone.');

  for (const gene of ['CFTR', 'HBB']) {
    const pathogenicCarriers = (byGene.get(gene) ?? []).filter((f) => f.carrier && f.knowledgeBaseId !== 'hbb-hbc' && f.knowledgeBaseId !== 'hbb-hbs');
    if (pathogenicCarriers.length >= 2) {
      for (const f of pathogenicCarriers) {
        f.carrier = false;
        f.risk = 'elevated';
        f.riskHeadline = `Two different pathogenic ${gene} variants — possible compound heterozygosity`;
        f.interpretation = `Two different pathogenic ${gene} variants were found. If they are on different copies of the gene (which this data cannot show), they may be associated with the condition. This must be clarified by a specialist. ${MESSAGES.uncertain}`;
        f.requiresConfirmation = true;
      }
    }
  }
}

export function interpretVariants(input: ParsedInput, clinvar: Record<string, ClinvarRecord> = {}): InterpretOutput {
  const findings: Finding[] = [];
  const warnings: ParseWarning[] = [];
  const testedNotDetected: InterpretOutput['testedNotDetected'] = [];
  const snpObservations = new Map<string, SnpObservation>();
  let notInterpreted = 0;
  let kbMatches = 0;
  const seenKb = new Set<string>();

  for (const v of input.variants) {
    const rs = resolveSnpRsId(v);
    if (rs && (PRS_SNP_INDEX.has(rs) || rs in APOE_SNPS)) {
      snpObservations.set(rs, { rsId: rs, genotype: v.genotype, zygosity: v.zygosity });
      kbMatches++;
      continue;
    }
    if (v.gene === 'APOE' && apoeFromText(v.legacyName)) {
      kbMatches++; // interpreted by the APOE rule below
      continue;
    }

    const match = findKnownVariant(v);
    if (match) {
      const { variant: kv, method } = match;
      const count = effectAlleleCount(v, kv);
      if ('mismatch' in count && count.mismatch) {
        warnings.push({ code: 'genotype-mismatch', message: `${kv.gene} ${kv.rsId ?? kv.name}: ${count.mismatch}` });
        continue;
      }
      kbMatches++;
      if (count.count === 0) {
        testedNotDetected.push({ gene: kv.gene, variant: kv.name, genotype: v.genotype });
        continue;
      }
      if (seenKb.has(kv.id)) continue; // the same variant listed twice
      seenKb.add(kv.id);
      findings.push(kbFinding(v, kv, method, count, input, warnings));
      continue;
    }

    if (v.zygosity === 'homozygous-reference') continue;
    const live = v.rsId ? clinvar[v.rsId] : undefined;
    const curatedGene = v.gene ? Boolean(GENES[v.gene]) : false;
    const fromDocument = v.source !== 'vcf' && v.source !== 'snp-array';
    if (live || fromDocument || curatedGene || (v.reportedSignificance && /pathogenic/i.test(v.reportedSignificance))) {
      findings.push(unknownFinding(v, input, live));
    } else {
      notInterpreted++;
    }
  }

  const apoe = apoeFinding(input.variants, snpObservations, input);
  if (apoe) findings.push(apoe);
  applyCombinationRules(findings);

  return { findings, snpObservations, testedNotDetected, notInterpreted, knowledgeBaseMatches: kbMatches, warnings };
}
