import type { Category, EvidenceLevel, RiskLevel, Significance, SourceRef } from '../types';
import { clinvarRs, clinvarTerm, dbsnp } from './sources';

// Curated snapshot of well-documented variants used by this educational
// prototype. Classifications follow public resources (ClinVar, OMIM,
// MedlinePlus Genetics) at the time of writing, simplified for teaching.
// Real clinical interpretation must use up-to-date databases and a laboratory.

export interface CopyInterpretation {
  risk: RiskLevel;
  headline: string;
  text: string;
  carrier?: boolean;
  clinicallyRelevant: boolean;
}

export interface KnownVariant {
  id: string;
  gene: string;
  name: string; // display label
  hgvsC?: string;
  hgvsP?: string;
  aliases: string[]; // legacy / common names, matched case-insensitively
  rsId?: string;
  grch38?: { chrom: string; pos: number; ref: string; alt: string };
  effectAllele?: string; // plus-strand allele that carries the effect (for SNP genotype data)
  otherAllele?: string;
  category: Category;
  conditionKey: string;
  conditionLabel?: string; // overrides the condition name for this variant
  significance: Significance;
  significanceLabel: string;
  inheritance: string;
  evidence: EvidenceLevel;
  mechanism: string;
  copies: { 1: CopyInterpretation; 2: CopyInterpretation };
  notes?: string[];
  sources: SourceRef[];
}

const AD = 'Autosomal dominant';
const AR = 'Autosomal recessive';

const brcaOne = (gene: string, cancers: string): CopyInterpretation => ({
  risk: 'high',
  headline: 'Increased inherited susceptibility to certain cancers',
  text: `Pathogenic ${gene} variant detected (one copy). This is associated with an increased inherited susceptibility to ${cancers}. It does not mean that cancer is present or guaranteed — many people with this variant never develop cancer. Specialist-guided screening and prevention options exist, and a genetic counselor can explain them.`,
  clinicallyRelevant: true,
});

const brcaTwo = (gene: string): CopyInterpretation => ({
  risk: 'high',
  headline: 'Unusual result — two copies reported',
  text: `Two copies of a pathogenic ${gene} variant is an extremely rare result and may indicate a data or reporting error. It must be reviewed by a clinical geneticist and confirmed with clinical testing.`,
  clinicallyRelevant: true,
});

const recessiveCarrier = (variant: string, condition: string): CopyInterpretation => ({
  risk: 'low',
  carrier: true,
  headline: `Carrier of a ${condition} variant`,
  text: `One copy of the pathogenic ${variant} variant was found. ${condition[0].toUpperCase()}${condition.slice(1)} is inherited in an autosomal recessive way, so people with one copy are carriers and usually have no symptoms. Carrier status can matter for family planning: a child who inherits a disease-causing variant from both parents may have the condition.`,
  clinicallyRelevant: true,
});

export const KNOWN_VARIANTS: KnownVariant[] = [
  {
    id: 'brca1-5266dupc',
    gene: 'BRCA1',
    name: 'c.5266dupC (p.Gln1756Profs*74)',
    hgvsC: 'c.5266dupC',
    hgvsP: 'p.Gln1756Profs*74',
    aliases: ['5382insC', '5382insc', 'c.5266dup', '5266dupC'],
    rsId: 'rs80357906',
    category: 'monogenic',
    conditionKey: 'hboc',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AD,
    evidence: 'high',
    mechanism:
      'One extra DNA letter (C) is inserted. This shifts the "reading frame" of the gene, so the BRCA1 protein is cut short and cannot repair DNA properly.',
    copies: {
      1: brcaOne('BRCA1', 'breast and ovarian cancer, and to a lesser degree some other cancers'),
      2: brcaTwo('BRCA1'),
    },
    sources: [clinvarRs('rs80357906'), dbsnp('rs80357906')],
  },
  {
    id: 'brca1-68-69delag',
    gene: 'BRCA1',
    name: 'c.68_69delAG (p.Glu23Valfs*17)',
    hgvsC: 'c.68_69delAG',
    hgvsP: 'p.Glu23Valfs*17',
    aliases: ['185delAG', '185delag', 'c.68_69del'],
    category: 'monogenic',
    conditionKey: 'hboc',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AD,
    evidence: 'high',
    mechanism: 'Two DNA letters (AG) are deleted, shifting the reading frame so the BRCA1 protein is cut short.',
    copies: {
      1: brcaOne('BRCA1', 'breast and ovarian cancer, and to a lesser degree some other cancers'),
      2: brcaTwo('BRCA1'),
    },
    sources: [clinvarTerm('BRCA1', 'c.68_69del')],
  },
  {
    id: 'brca2-5946delt',
    gene: 'BRCA2',
    name: 'c.5946delT (p.Ser1982Argfs*22)',
    hgvsC: 'c.5946delT',
    hgvsP: 'p.Ser1982Argfs*22',
    aliases: ['6174delT', '6174delt', 'c.5946del'],
    rsId: 'rs80359550',
    category: 'monogenic',
    conditionKey: 'hboc',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AD,
    evidence: 'high',
    mechanism: 'One DNA letter (T) is deleted, shifting the reading frame so the BRCA2 protein is cut short.',
    copies: {
      1: brcaOne('BRCA2', 'breast cancer (including male breast cancer), ovarian, prostate and pancreatic cancer'),
      2: brcaTwo('BRCA2'),
    },
    sources: [clinvarRs('rs80359550'), dbsnp('rs80359550')],
  },
  {
    id: 'cftr-f508del',
    gene: 'CFTR',
    name: 'c.1521_1523delCTT (p.Phe508del, F508del)',
    hgvsC: 'c.1521_1523delCTT',
    hgvsP: 'p.Phe508del',
    aliases: ['F508del', 'ΔF508', 'deltaF508', 'delta F508', 'delF508', 'dF508', 'Phe508del', 'c.1521_1523del'],
    rsId: 'rs113993960',
    category: 'monogenic',
    conditionKey: 'cf',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AR,
    evidence: 'high',
    mechanism:
      'Three DNA letters are missing, which removes one amino acid (phenylalanine 508). The CFTR protein folds incorrectly and rarely reaches the cell surface.',
    copies: {
      1: recessiveCarrier('F508del', 'cystic fibrosis'),
      2: {
        risk: 'high',
        headline: 'Two copies — associated with cystic fibrosis',
        text: 'Two copies of F508del are associated with cystic fibrosis. This result alone is not a diagnosis: cystic fibrosis is diagnosed by doctors using clinical evaluation and tests such as a sweat chloride test. Please discuss this result with a doctor.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs113993960'), dbsnp('rs113993960')],
  },
  {
    id: 'cftr-g551d',
    gene: 'CFTR',
    name: 'c.1652G>A (p.Gly551Asp, G551D)',
    hgvsC: 'c.1652G>A',
    hgvsP: 'p.Gly551Asp',
    aliases: ['G551D', 'Gly551Asp'],
    rsId: 'rs75527207',
    category: 'monogenic',
    conditionKey: 'cf',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AR,
    evidence: 'high',
    mechanism: 'One amino acid is changed so the CFTR channel reaches the cell surface but does not open properly (a "gating" variant).',
    copies: {
      1: recessiveCarrier('G551D', 'cystic fibrosis'),
      2: {
        risk: 'high',
        headline: 'Two copies — associated with cystic fibrosis',
        text: 'Two copies of G551D are associated with cystic fibrosis. Diagnosis requires clinical evaluation and tests such as a sweat chloride test.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs75527207'), dbsnp('rs75527207')],
  },
  {
    id: 'cftr-r117h',
    gene: 'CFTR',
    name: 'c.350G>A (p.Arg117His, R117H)',
    hgvsC: 'c.350G>A',
    hgvsP: 'p.Arg117His',
    aliases: ['R117H', 'Arg117His'],
    rsId: 'rs78655421',
    category: 'monogenic',
    conditionKey: 'cf',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic (variable clinical consequence)',
    inheritance: AR,
    evidence: 'moderate',
    mechanism:
      'Reduces how well the CFTR channel works. Its effect varies a lot and depends on a nearby DNA feature called the poly-T tract.',
    copies: {
      1: recessiveCarrier('R117H', 'cystic fibrosis'),
      2: {
        risk: 'elevated',
        headline: 'Two copies — may be associated with a CFTR-related disorder',
        text: 'Two copies of R117H may be associated with a CFTR-related condition, but the severity varies widely and depends on other DNA features. Specialist evaluation is needed.',
        clinicallyRelevant: true,
      },
    },
    notes: ['Clinical consequence depends on the poly-T (5T/7T/9T) tract in cis, which most reports do not include.'],
    sources: [clinvarRs('rs78655421'), dbsnp('rs78655421')],
  },
  {
    id: 'hbb-hbs',
    gene: 'HBB',
    name: 'c.20A>T (p.Glu7Val, HbS)',
    hgvsC: 'c.20A>T',
    hgvsP: 'p.Glu7Val',
    aliases: ['HbS', 'Hb S', 'Glu6Val', 'E6V', 'Glu7Val', 'E7V', 'sickle'],
    rsId: 'rs334',
    grch38: { chrom: '11', pos: 5227002, ref: 'T', alt: 'A' },
    effectAllele: 'A',
    otherAllele: 'T',
    category: 'monogenic',
    conditionKey: 'scd',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AR,
    evidence: 'high',
    mechanism:
      'Changes one amino acid in beta-globin (glutamic acid → valine). When oxygen is low, this haemoglobin sticks together and red blood cells take on a sickle shape.',
    copies: {
      1: {
        risk: 'low',
        carrier: true,
        headline: 'Sickle cell trait (carrier)',
        text: 'One copy of the HbS variant (sickle cell trait). People with sickle cell trait usually do not have symptoms of sickle cell disease. Rarely, problems can occur under extreme conditions such as severe dehydration or very intense exertion. This status is important for family planning.',
        clinicallyRelevant: true,
      },
      2: {
        risk: 'high',
        headline: 'Two copies — associated with sickle cell disease',
        text: 'Two copies of HbS are associated with sickle cell disease (HbSS). This needs to be confirmed with clinical testing such as haemoglobin analysis by a doctor.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs334'), dbsnp('rs334')],
  },
  {
    id: 'hbb-hbc',
    gene: 'HBB',
    name: 'c.19G>A (p.Glu7Lys, HbC)',
    hgvsC: 'c.19G>A',
    hgvsP: 'p.Glu7Lys',
    aliases: ['HbC', 'Hb C', 'Glu6Lys', 'E6K', 'Glu7Lys', 'E7K'],
    rsId: 'rs33930165',
    effectAllele: 'T',
    otherAllele: 'C',
    category: 'monogenic',
    conditionKey: 'scd',
    conditionLabel: 'Hemoglobin C trait / HbSC disease',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AR,
    evidence: 'high',
    mechanism: 'Changes one amino acid in beta-globin (glutamic acid → lysine), producing haemoglobin C.',
    copies: {
      1: {
        risk: 'low',
        carrier: true,
        headline: 'Hemoglobin C trait (carrier)',
        text: 'One copy of HbC (hemoglobin C trait) usually causes no health problems. Together with HbS from the other parent it can cause HbSC disease, a form of sickle cell disease, so it is relevant for family planning.',
        clinicallyRelevant: true,
      },
      2: {
        risk: 'elevated',
        headline: 'Two copies — associated with hemoglobin C disease',
        text: 'Two copies of HbC are associated with hemoglobin C disease, which usually causes mild anaemia. Confirmation by haemoglobin analysis is needed.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs33930165'), dbsnp('rs33930165')],
  },
  {
    id: 'hfe-c282y',
    gene: 'HFE',
    name: 'c.845G>A (p.Cys282Tyr, C282Y)',
    hgvsC: 'c.845G>A',
    hgvsP: 'p.Cys282Tyr',
    aliases: ['C282Y', 'Cys282Tyr'],
    rsId: 'rs1800562',
    grch38: { chrom: '6', pos: 26092913, ref: 'G', alt: 'A' },
    effectAllele: 'A',
    otherAllele: 'G',
    category: 'monogenic',
    conditionKey: 'hemochromatosis',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic (low penetrance)',
    inheritance: AR,
    evidence: 'high',
    mechanism: 'Changes one amino acid so the HFE protein cannot reach the cell surface, weakening the body’s brake on iron absorption.',
    copies: {
      1: {
        risk: 'low',
        carrier: true,
        headline: 'Carrier of the main hemochromatosis variant',
        text: 'One copy of C282Y. Carriers usually do not develop iron overload.',
        clinicallyRelevant: true,
      },
      2: {
        risk: 'elevated',
        headline: 'Two copies — increased risk of iron overload',
        text: 'Two copies of C282Y are the most common genetic cause of hereditary hemochromatosis. Penetrance is low: many people with this genotype never develop symptoms. Iron levels can be checked with simple blood tests — discuss this with a doctor.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs1800562'), dbsnp('rs1800562')],
  },
  {
    id: 'hfe-h63d',
    gene: 'HFE',
    name: 'c.187C>G (p.His63Asp, H63D)',
    hgvsC: 'c.187C>G',
    hgvsP: 'p.His63Asp',
    aliases: ['H63D', 'His63Asp'],
    rsId: 'rs1799945',
    grch38: { chrom: '6', pos: 26090951, ref: 'C', alt: 'G' },
    effectAllele: 'G',
    otherAllele: 'C',
    category: 'monogenic',
    conditionKey: 'hemochromatosis',
    significance: 'risk-factor',
    significanceLabel: 'Low-penetrance risk factor',
    inheritance: AR,
    evidence: 'moderate',
    mechanism: 'A common amino-acid change with only a small effect on iron regulation.',
    copies: {
      1: {
        risk: 'low',
        headline: 'Common variant — usually not significant on its own',
        text: 'One copy of H63D very rarely leads to iron overload on its own.',
        clinicallyRelevant: false,
      },
      2: {
        risk: 'low',
        headline: 'Two copies — usually not significant',
        text: 'Two copies of H63D are only rarely associated with clinically significant iron overload.',
        clinicallyRelevant: false,
      },
    },
    sources: [clinvarRs('rs1799945'), dbsnp('rs1799945')],
  },
  {
    id: 'f5-leiden',
    gene: 'F5',
    name: 'c.1601G>A (p.Arg534Gln, Factor V Leiden)',
    hgvsC: 'c.1601G>A',
    hgvsP: 'p.Arg534Gln',
    aliases: ['Factor V Leiden', 'FVL', 'R506Q', 'Arg506Gln', 'R534Q', 'G1691A'],
    rsId: 'rs6025',
    grch38: { chrom: '1', pos: 169549811, ref: 'C', alt: 'T' },
    effectAllele: 'T',
    otherAllele: 'C',
    category: 'monogenic',
    conditionKey: 'fvl',
    significance: 'risk-factor',
    significanceLabel: 'Established risk factor (incomplete penetrance)',
    inheritance: 'Autosomal dominant risk factor',
    evidence: 'high',
    mechanism: 'Makes factor V resistant to being switched off by activated protein C, so clotting stays "on" a little longer.',
    copies: {
      1: {
        risk: 'elevated',
        headline: 'Increased tendency to form blood clots',
        text: 'One copy of Factor V Leiden is associated with a moderately increased risk of clots in the veins compared with people without it. Most people with this variant never have a clot. It is useful for doctors to know about it, for example before surgery or when estrogen-containing medicines or pregnancy are considered.',
        clinicallyRelevant: true,
      },
      2: {
        risk: 'high',
        headline: 'Two copies — substantially increased clotting tendency',
        text: 'Two copies of Factor V Leiden are associated with a higher risk of venous clots than one copy. This should be confirmed with clinical testing and discussed with a doctor.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs6025'), dbsnp('rs6025')],
  },
  {
    id: 'f2-g20210a',
    gene: 'F2',
    name: 'c.*97G>A (G20210A)',
    hgvsC: 'c.*97G>A',
    aliases: ['G20210A', '20210G>A', 'prothrombin 20210'],
    rsId: 'rs1799963',
    grch38: { chrom: '11', pos: 46739505, ref: 'G', alt: 'A' },
    effectAllele: 'A',
    otherAllele: 'G',
    category: 'monogenic',
    conditionKey: 'prothrombin',
    significance: 'risk-factor',
    significanceLabel: 'Established risk factor (incomplete penetrance)',
    inheritance: 'Autosomal dominant risk factor',
    evidence: 'high',
    mechanism: 'A change outside the protein-coding part of the gene that increases the amount of prothrombin made.',
    copies: {
      1: {
        risk: 'elevated',
        headline: 'Increased tendency to form blood clots',
        text: 'One copy of prothrombin G20210A is associated with a moderately increased risk of venous clots. Most people with it never have a clot. It is useful for doctors to know about it, for example before surgery or during pregnancy.',
        clinicallyRelevant: true,
      },
      2: {
        risk: 'high',
        headline: 'Two copies — substantially increased clotting tendency',
        text: 'Two copies of G20210A are rare and associated with a higher risk of venous clots. Confirm with clinical testing and discuss with a doctor.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs1799963'), dbsnp('rs1799963')],
  },
  {
    id: 'apob-r3527q',
    gene: 'APOB',
    name: 'c.10580G>A (p.Arg3527Gln, R3527Q)',
    hgvsC: 'c.10580G>A',
    hgvsP: 'p.Arg3527Gln',
    aliases: ['R3527Q', 'R3500Q', 'Arg3527Gln', 'Arg3500Gln'],
    rsId: 'rs5742904',
    effectAllele: 'T',
    otherAllele: 'C',
    category: 'monogenic',
    conditionKey: 'fh',
    conditionLabel: 'Familial hypercholesterolemia (familial defective apoB)',
    significance: 'pathogenic',
    significanceLabel: 'Pathogenic',
    inheritance: AD,
    evidence: 'high',
    mechanism: 'Changes the part of apolipoprotein B that binds the LDL receptor, so LDL cholesterol is cleared from the blood more slowly.',
    copies: {
      1: {
        risk: 'high',
        headline: 'Associated with familial hypercholesterolemia',
        text: 'This variant is associated with higher LDL cholesterol from an early age (familial defective apolipoprotein B, a form of familial hypercholesterolemia). Cholesterol can be measured with a simple blood test and high cholesterol is treatable — discuss testing with a doctor.',
        clinicallyRelevant: true,
      },
      2: {
        risk: 'high',
        headline: 'Two copies — associated with familial hypercholesterolemia',
        text: 'Two copies are rare and associated with higher LDL cholesterol than one copy. Discuss lipid testing with a doctor.',
        clinicallyRelevant: true,
      },
    },
    sources: [clinvarRs('rs5742904'), dbsnp('rs5742904')],
  },
  {
    id: 'mthfr-c677t',
    gene: 'MTHFR',
    name: 'c.665C>T (p.Ala222Val, legacy C677T)',
    hgvsC: 'c.665C>T',
    hgvsP: 'p.Ala222Val',
    aliases: ['C677T', '677C>T', 'Ala222Val', 'A222V'],
    rsId: 'rs1801133',
    grch38: { chrom: '1', pos: 11796321, ref: 'G', alt: 'A' },
    effectAllele: 'A',
    otherAllele: 'G',
    category: 'multifactorial',
    conditionKey: 'homocysteine',
    significance: 'association',
    significanceLabel: 'Common variant — limited clinical significance',
    inheritance: 'Common variant',
    evidence: 'limited',
    mechanism: 'Makes the MTHFR enzyme slightly less stable, lowering its activity a little.',
    copies: {
      1: {
        risk: 'low',
        headline: 'One copy of a very common MTHFR variant',
        text: 'This variant is very common in many populations. One copy has little or no effect on health.',
        clinicallyRelevant: false,
      },
      2: {
        risk: 'low',
        headline: 'Two copies — possible mildly higher homocysteine',
        text: 'Two copies may be associated with mildly higher homocysteine, especially with low folate intake. Professional guidelines do not recommend MTHFR testing to assess the risk of blood clots or pregnancy loss, because the evidence for health effects is weak.',
        clinicallyRelevant: false,
      },
    },
    sources: [clinvarRs('rs1801133'), dbsnp('rs1801133')],
  },
];

/** APOE is interpreted from two SNPs that together define the ε2/ε3/ε4 alleles. */
export const APOE_SNPS = {
  rs429358: { effectAllele: 'C', otherAllele: 'T', grch38: { chrom: '19', pos: 44908684, ref: 'T', alt: 'C' } },
  rs7412: { effectAllele: 'T', otherAllele: 'C', grch38: { chrom: '19', pos: 44908822, ref: 'C', alt: 'T' } },
} as const;

export type ApoeGenotype = 'e2/e2' | 'e2/e3' | 'e2/e4' | 'e3/e3' | 'e3/e4' | 'e4/e4';

export const APOE_INTERPRETATION: Record<ApoeGenotype, CopyInterpretation & { label: string }> = {
  'e3/e3': {
    label: 'ε3/ε3',
    risk: 'average',
    headline: 'Most common APOE genotype',
    text: 'ε3/ε3 is the most common APOE combination and is used as the reference for comparing Alzheimer’s risk. It does not mean Alzheimer’s disease cannot develop.',
    clinicallyRelevant: false,
  },
  'e2/e3': {
    label: 'ε2/ε3',
    risk: 'low',
    headline: 'Associated with lower average Alzheimer’s risk',
    text: 'The ε2 allele is associated with a somewhat lower average risk of late-onset Alzheimer’s compared with ε3/ε3. Lower estimated genetic risk does not eliminate the possibility of disease.',
    clinicallyRelevant: false,
  },
  'e2/e2': {
    label: 'ε2/ε2',
    risk: 'low',
    headline: 'Lower average Alzheimer’s risk; relevant for blood lipids',
    text: 'ε2/ε2 is associated with lower average Alzheimer’s risk, but in a minority of people it is linked to a cholesterol disorder (type III hyperlipoproteinemia). A routine lipid test can be discussed with a doctor.',
    clinicallyRelevant: false,
  },
  'e2/e4': {
    label: 'ε2/ε4',
    risk: 'elevated',
    headline: 'One ε4 allele — modestly increased average risk',
    text: 'One ε4 allele is associated with a higher average risk of late-onset Alzheimer’s disease; the ε2 allele may partly offset this. Many people with ε4 never develop Alzheimer’s. (This SNP combination can rarely also represent ε1/ε3.)',
    clinicallyRelevant: true,
  },
  'e3/e4': {
    label: 'ε3/ε4',
    risk: 'elevated',
    headline: 'One ε4 allele — increased average risk',
    text: 'One copy of APOE ε4 is associated with a higher average risk of late-onset Alzheimer’s disease — in studies of people of European ancestry roughly 2–3 times the risk of ε3/ε3. This is a comparison of averages, not a prediction: many people with ε4 never develop Alzheimer’s, and the effect differs between populations.',
    clinicallyRelevant: true,
  },
  'e4/e4': {
    label: 'ε4/ε4',
    risk: 'high',
    headline: 'Two ε4 alleles — substantially increased average risk',
    text: 'Two copies of APOE ε4 are associated with a substantially higher average risk of late-onset Alzheimer’s disease than ε3/ε3. It is still not a diagnosis or a certainty: some people with ε4/ε4 never develop Alzheimer’s. Genetic counselling is strongly recommended before acting on this result.',
    clinicallyRelevant: true,
  },
};

export const APOE_SOURCES: SourceRef[] = [clinvarRs('rs429358'), clinvarRs('rs7412'), dbsnp('rs429358'), dbsnp('rs7412')];
