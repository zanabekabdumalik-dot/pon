import type { Confidence, EvidenceLevel, PrsContribution, PrsResult, RiskLevel } from '../types';
import type { PrsModel } from '../knowledge/prs';
import { gwasVariant, PRS_FACTSHEET } from '../knowledge/sources';
import { genotypeAlleles } from '../parsing/normalize';

export interface SnpObservation {
  rsId: string;
  genotype?: string;
  zygosity?: string;
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/**
 * Exact distribution of the score in the reference population, assuming
 * Hardy–Weinberg equilibrium and independent SNPs: each SNP contributes 0, 1 or
 * 2 risk alleles with probabilities (1-p)², 2p(1-p), p².
 */
function scoreDistribution(snps: { weight: number; p: number }[]): Map<number, number> {
  let dist = new Map<number, number>([[0, 1]]);
  for (const { weight, p } of snps) {
    const next = new Map<number, number>();
    const options: [number, number][] = [
      [0, (1 - p) ** 2],
      [weight, 2 * p * (1 - p)],
      [2 * weight, p ** 2],
    ];
    for (const [score, prob] of dist)
      for (const [add, q] of options) {
        const key = Math.round((score + add) * 1e9) / 1e9;
        next.set(key, (next.get(key) ?? 0) + prob * q);
      }
    dist = next;
  }
  return dist;
}

export function computePrs(model: PrsModel, observations: Map<string, SnpObservation>): PrsResult | undefined {
  const contributions: PrsContribution[] = [];
  const excluded: { rsId: string; reason: string }[] = [];
  const missing: string[] = [];
  const used: { weight: number; p: number }[] = [];

  for (const snp of model.snps) {
    const obs = observations.get(snp.rsId);
    if (!obs) {
      missing.push(`${snp.gene} ${snp.rsId}`);
      continue;
    }
    let count: number | undefined;
    const alleles = genotypeAlleles(obs.genotype);
    if (alleles.length === 2) {
      if (!alleles.every((a) => a === snp.riskAllele || a === snp.otherAllele)) {
        excluded.push({
          rsId: snp.rsId,
          reason: `genotype ${obs.genotype} does not match the expected alleles ${snp.otherAllele}/${snp.riskAllele} (possible strand or assembly difference)`,
        });
        continue;
      }
      count = alleles.filter((a) => a === snp.riskAllele).length;
    } else if (obs.zygosity === 'heterozygous') {
      count = 1; // a biallelic heterozygote always carries exactly one risk allele
    } else {
      excluded.push({ rsId: snp.rsId, reason: 'genotype not provided, so the number of risk alleles is unknown' });
      continue;
    }
    const weight = Math.log(snp.oddsRatio);
    used.push({ weight, p: snp.frequency });
    contributions.push({
      rsId: snp.rsId,
      gene: snp.gene,
      riskAllele: snp.riskAllele,
      genotype: obs.genotype ?? (count === 1 ? `${snp.otherAllele}/${snp.riskAllele}` : '?'),
      riskAlleleCount: count,
      oddsRatio: snp.oddsRatio,
      weight,
    });
  }
  if (contributions.length === 0) return undefined;

  const rawScore = contributions.reduce((s, c) => s + c.riskAlleleCount * c.weight, 0);
  const dist = scoreDistribution(used);
  const key = Math.round(rawScore * 1e9) / 1e9;
  let below = 0;
  let equal = 0;
  for (const [score, prob] of dist) {
    if (score < key - 1e-9) below += prob;
    else if (Math.abs(score - key) <= 1e-9) equal += prob;
  }
  const percentile = Math.min(99, Math.max(1, Math.round(100 * (below + equal / 2))));
  const mean = used.reduce((s, u) => s + 2 * u.p * u.weight, 0);
  const sd = Math.sqrt(used.reduce((s, u) => s + 2 * u.p * (1 - u.p) * u.weight ** 2, 0));
  const zScore = sd > 0 ? (rawScore - mean) / sd : 0;

  const n = contributions.length;
  const confidence: Confidence = n <= 1 ? 'insufficient' : 'low';
  let risk: RiskLevel = percentile < 20 ? 'low' : percentile < 80 ? 'average' : 'elevated';
  if (confidence === 'insufficient' && risk === 'elevated') risk = 'average';

  const evidenceRank: EvidenceLevel[] = ['high', 'moderate', 'limited', 'unknown'];
  const evidence = model.snps
    .filter((s) => contributions.some((c) => c.rsId === s.rsId))
    .map((s) => s.evidence)
    .reduce<EvidenceLevel>((worst, e) => (evidenceRank.indexOf(e) > evidenceRank.indexOf(worst) ? e : worst), 'high');

  const higher = contributions.filter((c) => c.riskAlleleCount > 0 && c.oddsRatio > 1).map((c) => `${c.gene} (${c.rsId})`);
  const statement = `Your calculated polygenic score is in the ${ordinal(percentile)} percentile compared with the selected reference population.`;
  const explanation =
    `This educational score adds up ${n} common variant${n === 1 ? '' : 's'} that each have a small effect on ${model.trait.toLowerCase()}. ` +
    (higher.length ? `Risk-increasing alleles were found in ${higher.join(', ')}. ` : 'No risk-increasing alleles were found among the analysed variants. ') +
    `The percentile compares your combination with the expected spread in the reference population — it is not a probability of developing the condition. ` +
    `Lifestyle, environment and many variants not tested here have a large influence.`;

  return {
    traitKey: model.traitKey,
    trait: model.trait,
    rawScore: Math.round(rawScore * 1000) / 1000,
    zScore: Math.round(zScore * 100) / 100,
    percentile,
    referencePopulation: model.referencePopulation,
    variantsUsed: n,
    variantsInModel: model.snps.length,
    missing,
    excluded,
    confidence,
    confidenceReason:
      confidence === 'insufficient'
        ? 'Only one variant was available — a score cannot be meaningfully estimated.'
        : `Based on ${n} of ${model.snps.length} variants in this educational model. Clinical polygenic scores use thousands to millions of variants and an ancestry-matched reference, so this estimate is rough.`,
    risk,
    statement,
    explanation,
    explanationSource: 'built-in',
    contributions,
    distribution: [...dist.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([score, probability]) => ({ score: Math.round(score * 1000) / 1000, probability })),
    evidence,
    sources: [...contributions.map((c) => gwasVariant(c.rsId)), PRS_FACTSHEET],
  };
}
