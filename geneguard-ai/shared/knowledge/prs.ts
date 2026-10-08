import type { EvidenceLevel } from '../types';

// Educational polygenic models. Each SNP lists the plus-strand risk allele,
// an approximate per-allele odds ratio and an approximate risk-allele
// frequency, rounded from well-replicated GWAS. These are ILLUSTRATIVE values:
// clinical polygenic scores use thousands to millions of variants and
// ancestry-matched reference data.

export interface PrsSnp {
  rsId: string;
  gene: string;
  riskAllele: string;
  otherAllele: string;
  oddsRatio: number; // per risk allele (values < 1 are protective)
  frequency: number; // risk-allele frequency in the reference population
  evidence: EvidenceLevel;
  grch38?: { chrom: string; pos: number; ref: string; alt: string };
}

export interface PrsModel {
  traitKey: string;
  trait: string;
  referencePopulation: string;
  snps: PrsSnp[];
}

export const REFERENCE_POPULATION =
  'Illustrative European-ancestry reference (approximate allele frequencies from published GWAS)';

export const PRS_MODELS: PrsModel[] = [
  {
    traitKey: 't2d',
    trait: 'Type 2 diabetes',
    referencePopulation: REFERENCE_POPULATION,
    snps: [
      {
        rsId: 'rs7903146',
        gene: 'TCF7L2',
        riskAllele: 'T',
        otherAllele: 'C',
        oddsRatio: 1.37,
        frequency: 0.29,
        evidence: 'high',
        grch38: { chrom: '10', pos: 112998590, ref: 'C', alt: 'T' },
      },
      { rsId: 'rs1801282', gene: 'PPARG', riskAllele: 'C', otherAllele: 'G', oddsRatio: 1.14, frequency: 0.88, evidence: 'high' },
      { rsId: 'rs5219', gene: 'KCNJ11', riskAllele: 'T', otherAllele: 'C', oddsRatio: 1.14, frequency: 0.36, evidence: 'high' },
      { rsId: 'rs13266634', gene: 'SLC30A8', riskAllele: 'C', otherAllele: 'T', oddsRatio: 1.12, frequency: 0.69, evidence: 'high' },
      {
        rsId: 'rs9939609',
        gene: 'FTO',
        riskAllele: 'A',
        otherAllele: 'T',
        oddsRatio: 1.15,
        frequency: 0.41,
        evidence: 'high',
        grch38: { chrom: '16', pos: 53786615, ref: 'T', alt: 'A' },
      },
    ],
  },
  {
    traitKey: 'cad',
    trait: 'Coronary artery disease',
    referencePopulation: REFERENCE_POPULATION,
    snps: [
      { rsId: 'rs1333049', gene: 'CDKN2B-AS1', riskAllele: 'C', otherAllele: 'G', oddsRatio: 1.29, frequency: 0.48, evidence: 'high' },
      { rsId: 'rs10455872', gene: 'LPA', riskAllele: 'G', otherAllele: 'A', oddsRatio: 1.5, frequency: 0.07, evidence: 'high' },
      { rsId: 'rs11591147', gene: 'PCSK9', riskAllele: 'T', otherAllele: 'G', oddsRatio: 0.7, frequency: 0.02, evidence: 'moderate' },
    ],
  },
  {
    traitKey: 'obesity',
    trait: 'Obesity-related risk (BMI)',
    referencePopulation: REFERENCE_POPULATION,
    snps: [
      {
        rsId: 'rs9939609',
        gene: 'FTO',
        riskAllele: 'A',
        otherAllele: 'T',
        oddsRatio: 1.31,
        frequency: 0.41,
        evidence: 'high',
        grch38: { chrom: '16', pos: 53786615, ref: 'T', alt: 'A' },
      },
      { rsId: 'rs17782313', gene: 'MC4R', riskAllele: 'C', otherAllele: 'T', oddsRatio: 1.12, frequency: 0.24, evidence: 'high' },
      { rsId: 'rs6548238', gene: 'TMEM18', riskAllele: 'C', otherAllele: 'T', oddsRatio: 1.15, frequency: 0.83, evidence: 'moderate' },
    ],
  },
  {
    traitKey: 'hypertension',
    trait: 'Hypertension (high blood pressure)',
    referencePopulation: REFERENCE_POPULATION,
    snps: [
      { rsId: 'rs17249754', gene: 'ATP2B1', riskAllele: 'G', otherAllele: 'A', oddsRatio: 1.1, frequency: 0.84, evidence: 'moderate' },
      { rsId: 'rs699', gene: 'AGT', riskAllele: 'G', otherAllele: 'A', oddsRatio: 1.08, frequency: 0.41, evidence: 'limited' },
      { rsId: 'rs5186', gene: 'AGTR1', riskAllele: 'C', otherAllele: 'A', oddsRatio: 1.1, frequency: 0.28, evidence: 'limited' },
    ],
  },
];

/** Every SNP used by any model, keyed by rsID (the first definition wins for gene/allele metadata). */
export const PRS_SNP_INDEX: Map<string, PrsSnp> = new Map();
for (const model of PRS_MODELS) {
  for (const snp of model.snps) if (!PRS_SNP_INDEX.has(snp.rsId)) PRS_SNP_INDEX.set(snp.rsId, snp);
}
