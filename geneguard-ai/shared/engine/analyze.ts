import type {
  AnalysisReport,
  CategorySummary,
  ClinvarRecord,
  DataScope,
  Finding,
  ParsedInput,
  PrsResult,
  SourceRef,
} from '../types';
import { PRS_MODELS } from '../knowledge/prs';
import { ACMG_GUIDELINE, PREDISPOSITION, PRS_FACTSHEET } from '../knowledge/sources';
import { CLINICAL_CONTEXT, DISCLAIMER, MESSAGES } from '../messages';
import { makeId } from '../parsing/ids';
import { lowerFirst } from '../text';
import { assessChromosomal } from './chromosomal';
import { interpretVariants, maxRisk } from './interpret';
import { computePrs } from './prs';
import { buildRecommendations } from './recommendations';

export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  'targeted-report': 'Targeted genetic report',
  'partial-report': 'Partial genetic report',
  'snp-genotyping': 'SNP genotyping data (consumer array)',
  vcf: 'Variant call format (VCF) file',
  'cytogenetic-report': 'Chromosome / cytogenetic report',
  manual: 'Manually entered genetic data',
  'synthetic-demo': 'Synthetic demonstration profile',
  unknown: 'Unknown data type',
};

const genesOf = (list: Finding[]) => [...new Set(list.map((f) => f.gene).filter(Boolean))].join(', ');

function monogenicSummary(findings: Finding[], tested: AnalysisReport['testedNotDetected'], input: ParsedInput): CategorySummary {
  const mono = findings.filter((f) => f.category === 'monogenic');
  const risk = maxRisk(mono.map((f) => f.risk));
  const carriers = mono.filter((f) => f.carrier);
  if (mono.length === 0) {
    const anyData = tested.length > 0 || input.warnings.some((w) => w.message.startsWith('Report states'));
    return anyData
      ? {
          category: 'monogenic',
          risk: 'low',
          headline: 'No clinically significant variant identified in analyzed genes',
          detail: 'Only the genes and positions included in your data were evaluated. Lower estimated genetic risk does not eliminate the possibility of disease.',
        }
      : {
          category: 'monogenic',
          risk: 'not-assessable',
          headline: 'No single-gene variants in the submitted data',
          detail: 'The data did not include variants in genes linked to single-gene (monogenic) conditions.',
        };
  }
  const by = (r: string) => mono.filter((f) => f.risk === r);
  switch (risk) {
    case 'high':
      return {
        category: 'monogenic',
        risk,
        headline: `Clinically significant variant identified (${genesOf(by('high'))})`,
        detail: 'A pathogenic variant associated with an inherited condition or susceptibility was found. This is not a diagnosis; it should be confirmed and discussed with a specialist.',
      };
    case 'elevated':
      return {
        category: 'monogenic',
        risk,
        headline: `Variant associated with increased risk (${genesOf(by('elevated'))})`,
        detail: 'At least one variant is associated with a moderately increased risk. Most people with such variants never develop the condition.',
      };
    case 'average':
      return {
        category: 'monogenic',
        risk,
        headline: 'Variant(s) with uncertain or limited interpretation',
        detail: `${MESSAGES.uncertain}`,
      };
    default:
      return carriers.length
        ? {
            category: 'monogenic',
            risk: 'low',
            headline: `Carrier status identified (${genesOf(carriers)})`,
            detail: 'Carriers of recessive conditions usually have no symptoms. Carrier status can matter for family planning.',
          }
        : {
            category: 'monogenic',
            risk: 'low',
            headline: 'No clinically significant variant identified in analyzed genes',
            detail: 'Lower estimated genetic risk based on the available data does not eliminate the possibility of disease.',
          };
  }
}

function multifactorialSummary(findings: Finding[], prs: PrsResult[]): CategorySummary {
  const multi = findings.filter((f) => f.category === 'multifactorial');
  const risk = maxRisk([...multi.map((f) => f.risk), ...prs.map((p) => p.risk)]);
  if (multi.length === 0 && prs.length === 0)
    return {
      category: 'multifactorial',
      risk: 'not-assessable',
      headline: 'No multifactorial risk variants in the submitted data',
      detail: 'Common diseases depend on many variants and on lifestyle and environment; none of the variants used by GeneGuard were present.',
    };
  if (risk === 'high' || risk === 'elevated')
    return {
      category: 'multifactorial',
      risk,
      headline: 'Several variants may influence risk',
      detail: 'Some common variants are associated with higher average risk. For common diseases, lifestyle and environment usually matter as much or more.',
    };
  if (risk === 'average')
    return {
      category: 'multifactorial',
      risk,
      headline: 'Average estimated genetic risk for the analysed traits',
      detail: 'Your combination of the analysed variants is common in the reference population.',
    };
  return {
    category: 'multifactorial',
    risk: 'low',
    headline: 'Lower estimated genetic risk based on the available data',
    detail: 'Lower estimated genetic risk based on the available data does not eliminate the possibility of disease.',
  };
}

function chromosomalSummary(chrom: AnalysisReport['chromosomal']): CategorySummary {
  if (!chrom.assessable)
    return { category: 'chromosomal', risk: 'not-assessable', headline: 'Not assessable from submitted data', detail: chrom.reason };
  const detected = chrom.results.filter((r) => r.status === 'detected');
  const screen = chrom.results.filter((r) => r.status === 'screen-positive');
  if (detected.length)
    return {
      category: 'chromosomal',
      risk: 'high',
      headline: `Chromosomal change reported: ${detected.map((r) => r.name).join(', ')}`,
      detail: 'The report describes a chromosomal change. It requires review by a clinical geneticist.',
    };
  if (screen.length)
    return {
      category: 'chromosomal',
      risk: 'elevated',
      headline: `Screening result needs follow-up: ${screen.map((r) => r.name).join(', ')}`,
      detail: 'A positive screening result is not a diagnosis; diagnostic testing is needed to confirm or rule it out.',
    };
  if (chrom.results.some((r) => r.status === 'not-detected'))
    return {
      category: 'chromosomal',
      risk: 'low',
      headline: 'No chromosomal abnormality reported',
      detail: 'Based on the result written in the report, at the resolution of the test that was used.',
    };
  return { category: 'chromosomal', risk: 'not-assessable', headline: 'Insufficient data', detail: chrom.reason };
}

function builtInOverview(report: Omit<AnalysisReport, 'overview' | 'overviewSource'>): string {
  const { input, findings, prs, summary } = report;
  const parts: string[] = [];
  parts.push(
    `GeneGuard analysed ${lowerFirst(input.dataScopeLabel)}${input.fileName ? ` (“${input.fileName}”)` : ''}: ${input.variantsDetected} variant${input.variantsDetected === 1 ? '' : 's'} detected, ${input.knowledgeBaseMatches} matched the knowledge base and ${input.clinicallyRelevant} ${input.clinicallyRelevant === 1 ? 'is' : 'are'} considered clinically relevant.`,
  );
  const order = ['high', 'elevated', 'average', 'low'];
  const top = [...findings].filter((f) => f.category === 'monogenic' && f.risk !== 'low').sort((a, b) => order.indexOf(a.risk) - order.indexOf(b.risk))[0];
  if (top)
    parts.push(
      `The most important single-gene finding is ${top.gene ?? 'a variant'} ${top.variantLabel} (${top.significanceLabel.toLowerCase()}), linked to ${lowerFirst(top.condition)}: ${lowerFirst(top.riskHeadline)}.`,
    );
  const carriers = findings.filter((f) => f.carrier);
  if (carriers.length) parts.push(`Carrier status was found for ${carriers.map((f) => (f.gene && !f.condition.includes(f.gene) ? `${lowerFirst(f.condition)} (${f.gene})` : lowerFirst(f.condition))).join(' and ')}, which usually does not affect the carrier’s own health.`);
  const elevatedPrs = prs.filter((p) => p.risk === 'elevated');
  if (elevatedPrs.length) parts.push(`Polygenic scores were above average for ${elevatedPrs.map((p) => lowerFirst(p.trait)).join(' and ')} (low confidence, small number of variants).`);
  const apoe = findings.find((f) => f.gene === 'APOE');
  if (apoe)
    parts.push(
      apoe.significance === 'risk-factor'
        ? `The APOE result (${apoe.variantLabel}) is a risk factor for late-onset Alzheimer’s disease, not a prediction.`
        : `The APOE result (${apoe.variantLabel}) is associated with average or lower Alzheimer’s risk, which does not eliminate the possibility of disease.`,
    );
  if (summary.chromosomal.risk === 'not-assessable') parts.push('Chromosomal conditions could not be assessed from this type of data.');
  else parts.push(summary.chromosomal.headline + '.');
  parts.push(`${MESSAGES.notDiagnosis} ${MESSAGES.predispositionNotDestiny}`);
  return parts.join(' ');
}

function dedupeSources(list: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}

export interface AnalyzeOptions {
  clinvar?: Record<string, ClinvarRecord>;
}

/** Deterministic, rule-based analysis. AI (if enabled) only rewrites explanations afterwards. */
export function analyze(input: ParsedInput, opts: AnalyzeOptions = {}): AnalysisReport {
  const interpreted = interpretVariants(input, opts.clinvar);
  const prs = PRS_MODELS.map((m) => computePrs(m, interpreted.snpObservations)).filter((p): p is PrsResult => Boolean(p));
  const chromosomal = assessChromosomal(input);

  const variantsDetected = input.variants.filter((v) => v.zygosity !== 'homozygous-reference').length;
  const clinicallyRelevant = interpreted.findings.filter((f) => f.clinicallyRelevant).length;
  const reportInput: AnalysisReport['input'] = {
    kind: input.kind,
    dataScope: input.dataScope,
    dataScopeLabel: DATA_SCOPE_LABEL[input.dataScope],
    fileName: input.fileName,
    profile: input.profile,
    variantsDetected,
    markersGenotyped: input.stats.markersGenotyped,
    knowledgeBaseMatches: interpreted.knowledgeBaseMatches,
    clinicallyRelevant,
  };
  const summary = {
    chromosomal: chromosomalSummary(chromosomal),
    monogenic: monogenicSummary(interpreted.findings, interpreted.testedNotDetected, input),
    multifactorial: multifactorialSummary(interpreted.findings, prs),
  };
  const { recommendations, changeable, doctorQuestions } = buildRecommendations(interpreted.findings, prs, chromosomal.results, reportInput);

  const warnings = [...input.warnings, ...interpreted.warnings];
  if (interpreted.notInterpreted > 0)
    warnings.push({
      code: 'info',
      message: `${interpreted.notInterpreted} variant(s) have no entry in the GeneGuard knowledge base and no reported classification, so they were not interpreted.`,
    });

  const base: Omit<AnalysisReport, 'overview' | 'overviewSource'> = {
    id: makeId('report'),
    createdAt: new Date().toISOString(),
    input: reportInput,
    summary,
    findings: interpreted.findings,
    chromosomal,
    prs,
    testedNotDetected: interpreted.testedNotDetected,
    notInterpreted: interpreted.notInterpreted,
    recommendations,
    changeable,
    doctorQuestions,
    sources: dedupeSources([
      ...interpreted.findings.flatMap((f) => f.sources),
      ...prs.flatMap((p) => p.sources),
      ...chromosomal.results.flatMap((r) => r.sources),
      ACMG_GUIDELINE,
      PRS_FACTSHEET,
      PREDISPOSITION,
    ]),
    warnings,
    ai: { used: false, clinvarLive: Boolean(opts.clinvar && Object.keys(opts.clinvar).length) },
    disclaimers: [
      DISCLAIMER,
      CLINICAL_CONTEXT,
      'This analysis only covers the variants present in the submitted data. Genes and variants that were not included were not evaluated.',
      MESSAGES.notDiagnosis,
    ],
  };
  return { ...base, overview: builtInOverview(base), overviewSource: 'built-in' };
}
