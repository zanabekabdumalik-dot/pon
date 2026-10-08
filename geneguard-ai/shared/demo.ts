import type { ExtractedVariant, ParsedInput } from './types';
import { SYNTHETIC_NOTICE } from './messages';
import { makeId } from './parsing/ids';
import { extractChromosomal } from './parsing/karyotype';

// Synthetic demonstration profiles. They are artificial: no real person has
// these data. Well-documented public variants are placed in an artificial
// profile so the knowledge base has something real to explain, plus one
// fictional variant to show how unknown variants are handled.

export interface DemoProfile {
  key: string;
  title: string;
  subtitle: string;
  highlights: string[];
  build: () => ParsedInput;
}

const v = (fields: Omit<ExtractedVariant, 'id' | 'source' | 'demo'>): ExtractedVariant => ({
  id: makeId('demo'),
  source: 'demo',
  demo: true,
  ...fields,
});

const snp = (gene: string, rsId: string, chromosome: string, genotype: string, position?: number) =>
  v({ gene, rsId, chromosome, genotype, position, sourceText: `${gene} ${rsId} ${genotype}` });

export const DEMO_PROFILES: DemoProfile[] = [
  {
    key: 'anna',
    title: 'Demo Patient — “Anna”',
    subtitle: 'Age 30 · Female · synthetic mixed panel',
    highlights: ['BRCA1 demonstration variant', 'CFTR demonstration variant (carrier)', 'APOE demonstration genotype', 'Multifactorial SNPs', 'One fictional unknown variant'],
    build: () => ({
      kind: 'demo',
      dataScope: 'synthetic-demo',
      fileName: 'GeneGuard demo profile',
      profile: { label: 'Demo Patient “Anna”', age: 30, sex: 'Female', synthetic: true },
      variants: [
        v({
          gene: 'BRCA1',
          hgvsC: 'c.5266dupC',
          hgvsP: 'p.Gln1756Profs*74',
          legacyName: '5382insC',
          rsId: 'rs80357906',
          chromosome: '17',
          zygosity: 'heterozygous',
          reportedSignificance: 'Pathogenic',
          reportedCondition: 'Hereditary breast and ovarian cancer',
          labInterpretation: 'Demonstration entry — synthetic data.',
          sourceText: 'BRCA1 c.5266dupC (p.Gln1756Profs*74) heterozygous — Pathogenic',
        }),
        v({
          gene: 'CFTR',
          hgvsC: 'c.1521_1523delCTT',
          hgvsP: 'p.Phe508del',
          legacyName: 'F508del',
          rsId: 'rs113993960',
          chromosome: '7',
          zygosity: 'heterozygous',
          reportedSignificance: 'Pathogenic',
          reportedCondition: 'Cystic fibrosis',
          sourceText: 'CFTR c.1521_1523delCTT (p.Phe508del) heterozygous — Pathogenic',
        }),
        snp('APOE', 'rs429358', '19', 'C/T', 44908684),
        snp('APOE', 'rs7412', '19', 'C/C', 44908822),
        v({
          gene: 'FBN1',
          hgvsC: 'c.9999G>T',
          chromosome: '15',
          zygosity: 'heterozygous',
          fictional: true,
          sourceText: 'FBN1 c.9999G>T heterozygous — fictional demonstration variant',
        }),
        snp('TCF7L2', 'rs7903146', '10', 'C/T', 112998590),
        snp('PPARG', 'rs1801282', '3', 'C/C'),
        snp('KCNJ11', 'rs5219', '11', 'C/T'),
        snp('SLC30A8', 'rs13266634', '8', 'C/T'),
        snp('FTO', 'rs9939609', '16', 'A/A', 53786615),
        snp('MC4R', 'rs17782313', '18', 'C/T'),
        snp('TMEM18', 'rs6548238', '2', 'C/T'),
        snp('CDKN2B-AS1', 'rs1333049', '9', 'C/G'),
        snp('LPA', 'rs10455872', '6', 'A/A'),
        snp('PCSK9', 'rs11591147', '1', 'G/G'),
        snp('ATP2B1', 'rs17249754', '12', 'A/G'),
        snp('AGT', 'rs699', '1', 'A/G'),
        snp('AGTR1', 'rs5186', '3', 'A/A'),
        snp('MTHFR', 'rs1801133', '1', 'A/G', 11796321),
        snp('HFE', 'rs1800562', '6', 'G/G', 26092913),
      ],
      chromosomal: [],
      warnings: [{ code: 'info', message: SYNTHETIC_NOTICE }],
      stats: { totalRecords: 20, keptRecords: 20, skippedLines: 0 },
    }),
  },
  {
    key: 'lowrisk',
    title: 'Demo — Lower-risk SNP panel',
    subtitle: 'Age 45 · Male · synthetic genotyping data',
    highlights: ['Mostly lower-risk common variants', 'APOE ε2/ε3', 'HFE carrier', 'Shows that “lower risk” ≠ “no risk”'],
    build: () => ({
      kind: 'demo',
      dataScope: 'synthetic-demo',
      fileName: 'GeneGuard lower-risk demo',
      profile: { label: 'Demo profile “Lower-risk panel”', age: 45, sex: 'Male', synthetic: true },
      variants: [
        snp('TCF7L2', 'rs7903146', '10', 'C/C', 112998590),
        snp('PPARG', 'rs1801282', '3', 'C/G'),
        snp('KCNJ11', 'rs5219', '11', 'C/C'),
        snp('SLC30A8', 'rs13266634', '8', 'T/T'),
        snp('FTO', 'rs9939609', '16', 'T/T', 53786615),
        snp('MC4R', 'rs17782313', '18', 'T/T'),
        snp('TMEM18', 'rs6548238', '2', 'C/T'),
        snp('CDKN2B-AS1', 'rs1333049', '9', 'G/G'),
        snp('LPA', 'rs10455872', '6', 'A/A'),
        snp('PCSK9', 'rs11591147', '1', 'G/T'),
        snp('ATP2B1', 'rs17249754', '12', 'A/G'),
        snp('AGT', 'rs699', '1', 'A/A'),
        snp('AGTR1', 'rs5186', '3', 'A/A'),
        snp('APOE', 'rs429358', '19', 'T/T', 44908684),
        snp('APOE', 'rs7412', '19', 'C/T', 44908822),
        snp('HFE', 'rs1800562', '6', 'A/G', 26092913),
        snp('F5', 'rs6025', '1', 'C/C', 169549811),
        snp('MTHFR', 'rs1801133', '1', 'G/G', 11796321),
      ],
      chromosomal: [],
      warnings: [{ code: 'info', message: SYNTHETIC_NOTICE }],
      stats: { totalRecords: 18, keptRecords: 18, skippedLines: 0, markersGenotyped: 18 },
    }),
  },
  {
    key: 'karyotype',
    title: 'Demo — Chromosome analysis report',
    subtitle: 'Synthetic cytogenetic report · karyotype 47,XX,+21',
    highlights: ['Chromosomal category', 'Trisomy 21 reported by a (synthetic) laboratory', 'Shows “requires specialist confirmation”'],
    build: () => {
      const text = [
        'SYNTHETIC CYTOGENETICS REPORT — FOR DEMONSTRATION ONLY',
        'Test: Chromosome analysis (G-banded karyotype), peripheral blood',
        'Cells counted: 20   Band level: 550',
        'Result: 47,XX,+21',
        'Interpretation: Abnormal female karyotype with an additional chromosome 21, consistent with trisomy 21.',
      ].join('\n');
      return {
        kind: 'demo',
        dataScope: 'cytogenetic-report',
        fileName: 'Synthetic cytogenetics report',
        profile: { label: 'Demo profile “Chromosome report”', sex: 'Female', synthetic: true },
        variants: [],
        chromosomal: extractChromosomal(text),
        rawText: text,
        warnings: [{ code: 'info', message: SYNTHETIC_NOTICE }],
        stats: { totalRecords: 1, keptRecords: 1, skippedLines: 0 },
      };
    },
  },
];

export const demoProfile = (key: string) => DEMO_PROFILES.find((d) => d.key === key);
