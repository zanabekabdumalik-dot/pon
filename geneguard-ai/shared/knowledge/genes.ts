import type { Category, SourceRef } from '../types';
import { medlineGene, ncbiGene, omimEntry } from './sources';

export interface GeneInfo {
  symbol: string;
  name: string;
  chromosome: string;
  category: Category;
  role: string; // plain-language function
  conditionKeys: string[];
  inheritance?: 'dominant' | 'recessive' | 'complex';
  sources: SourceRef[];
}

const g = (
  symbol: string,
  name: string,
  chromosome: string,
  category: Category,
  role: string,
  conditionKeys: string[],
  inheritance: GeneInfo['inheritance'],
  extra: SourceRef[] = [],
): GeneInfo => ({
  symbol,
  name,
  chromosome,
  category,
  role,
  conditionKeys,
  inheritance,
  sources: [...extra, ncbiGene(symbol)],
});

export const GENES: Record<string, GeneInfo> = Object.fromEntries(
  [
    g('BRCA1', 'BRCA1 DNA repair associated', '17', 'monogenic', 'helps repair damaged DNA and acts as a tumour suppressor', ['hboc'], 'dominant', [
      medlineGene('brca1', 'BRCA1'),
      omimEntry('113705', 'BRCA1'),
    ]),
    g('BRCA2', 'BRCA2 DNA repair associated', '13', 'monogenic', 'helps repair damaged DNA and acts as a tumour suppressor', ['hboc'], 'dominant', [
      medlineGene('brca2', 'BRCA2'),
      omimEntry('600185', 'BRCA2'),
    ]),
    g(
      'CFTR',
      'CF transmembrane conductance regulator',
      '7',
      'monogenic',
      'makes a channel that moves chloride (a part of salt) across cell membranes, which keeps mucus thin',
      ['cf'],
      'recessive',
      [medlineGene('cftr', 'CFTR'), omimEntry('602421', 'CFTR')],
    ),
    g(
      'HBB',
      'Hemoglobin subunit beta',
      '11',
      'monogenic',
      'makes beta-globin, part of haemoglobin — the protein in red blood cells that carries oxygen',
      ['scd'],
      'recessive',
      [medlineGene('hbb', 'HBB'), omimEntry('141900', 'HBB')],
    ),
    g(
      'FBN1',
      'Fibrillin 1',
      '15',
      'monogenic',
      'makes fibrillin-1, a protein that gives strength and flexibility to connective tissue',
      ['marfan'],
      'dominant',
      [medlineGene('fbn1', 'FBN1'), omimEntry('134797', 'FBN1')],
    ),
    g('LDLR', 'Low density lipoprotein receptor', '19', 'monogenic', 'makes the receptor that removes LDL ("bad") cholesterol from the blood', ['fh'], 'dominant', [
      medlineGene('ldlr', 'LDLR'),
      omimEntry('606945', 'LDLR'),
    ]),
    g(
      'APOB',
      'Apolipoprotein B',
      '2',
      'monogenic',
      'makes apolipoprotein B, the protein on LDL particles that the LDL receptor recognises',
      ['fh'],
      'dominant',
      [medlineGene('apob', 'APOB'), omimEntry('107730', 'APOB')],
    ),
    g(
      'PCSK9',
      'Proprotein convertase subtilisin/kexin type 9',
      '1',
      'monogenic',
      'controls how many LDL receptors sit on liver cells',
      ['fh', 'cad'],
      'dominant',
      [medlineGene('pcsk9', 'PCSK9'), omimEntry('607786', 'PCSK9')],
    ),
    g(
      'APOE',
      'Apolipoprotein E',
      '19',
      'multifactorial',
      'makes apolipoprotein E, which carries cholesterol and other fats in the blood and brain',
      ['alzheimers'],
      'complex',
      [medlineGene('apoe', 'APOE'), omimEntry('107741', 'APOE')],
    ),
    g('HFE', 'Homeostatic iron regulator', '6', 'monogenic', 'helps control how much iron the body absorbs from food', ['hemochromatosis'], 'recessive', [
      medlineGene('hfe', 'HFE'),
      omimEntry('613609', 'HFE'),
    ]),
    g('F5', 'Coagulation factor V', '1', 'monogenic', 'makes factor V, one of the proteins that make blood clot', ['fvl'], 'dominant', [
      medlineGene('f5', 'F5'),
      omimEntry('612309', 'F5'),
    ]),
    g('F2', 'Coagulation factor II, thrombin', '11', 'monogenic', 'makes prothrombin, a key blood-clotting protein', ['prothrombin'], 'dominant', [
      medlineGene('f2', 'F2'),
      omimEntry('176930', 'F2'),
    ]),
    g(
      'MTHFR',
      'Methylenetetrahydrofolate reductase',
      '1',
      'multifactorial',
      'makes an enzyme that helps process folate and the amino acid homocysteine',
      ['homocysteine'],
      'complex',
      [medlineGene('mthfr', 'MTHFR'), omimEntry('607093', 'MTHFR')],
    ),
    g('TCF7L2', 'Transcription factor 7 like 2', '10', 'multifactorial', 'a gene switch involved in insulin release and blood-sugar control', ['t2d'], 'complex', [
      omimEntry('602228', 'TCF7L2'),
    ]),
    g(
      'FTO',
      'FTO alpha-ketoglutarate dependent dioxygenase',
      '16',
      'multifactorial',
      'a gene region linked to appetite and body-weight regulation (the exact mechanism is still being studied)',
      ['obesity', 't2d'],
      'complex',
      [omimEntry('610966', 'FTO')],
    ),
    g('MC4R', 'Melanocortin 4 receptor', '18', 'multifactorial', 'makes a brain receptor that helps regulate appetite and energy balance', ['obesity'], 'complex'),
    g(
      'TMEM18',
      'Transmembrane protein 18',
      '2',
      'multifactorial',
      'a gene repeatedly linked to body mass index in large studies; its role in the brain is still being studied',
      ['obesity'],
      'complex',
    ),
    g(
      'CDKN2B-AS1',
      'CDKN2B antisense RNA 1 (chromosome 9p21 region)',
      '9',
      'multifactorial',
      'a non-coding region on chromosome 9p21 that is one of the most replicated genetic signals for coronary artery disease',
      ['cad'],
      'complex',
    ),
    g('LPA', 'Lipoprotein(a)', '6', 'multifactorial', 'makes apolipoprotein(a), part of lipoprotein(a) — a cholesterol particle linked to heart disease', ['cad'], 'complex'),
    g('PPARG', 'Peroxisome proliferator activated receptor gamma', '3', 'multifactorial', 'regulates fat-cell development and insulin sensitivity', ['t2d'], 'complex'),
    g(
      'KCNJ11',
      'Potassium inwardly rectifying channel subfamily J member 11',
      '11',
      'multifactorial',
      'part of a potassium channel in insulin-producing cells that controls insulin release',
      ['t2d'],
      'complex',
    ),
    g('SLC30A8', 'Solute carrier family 30 member 8', '8', 'multifactorial', 'a zinc transporter in insulin-producing cells', ['t2d'], 'complex'),
    g('AGT', 'Angiotensinogen', '1', 'multifactorial', 'makes angiotensinogen, part of the hormone system that regulates blood pressure', ['hypertension'], 'complex'),
    g('ATP2B1', 'ATPase plasma membrane Ca2+ transporting 1', '12', 'multifactorial', 'a calcium pump in blood-vessel cells associated with blood pressure', ['hypertension'], 'complex'),
    g('AGTR1', 'Angiotensin II receptor type 1', '3', 'multifactorial', 'makes a receptor for the blood-pressure hormone angiotensin II', ['hypertension'], 'complex'),
  ].map((gene) => [gene.symbol, gene]),
);

/**
 * Additional HGNC gene symbols commonly found in clinical genetic reports.
 * They are recognised during extraction (so they are not mistaken for random
 * words) but have no curated interpretation in this prototype.
 */
export const RECOGNISED_GENE_SYMBOLS = new Set<string>([
  ...Object.keys(GENES),
  'ATM', 'CHEK2', 'PALB2', 'TP53', 'PTEN', 'CDH1', 'STK11', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 'EPCAM', 'APC', 'MUTYH',
  'RAD51C', 'RAD51D', 'BRIP1', 'BARD1', 'NBN', 'NF1', 'NF2', 'RET', 'VHL', 'MEN1', 'RB1', 'WT1', 'MYH7', 'MYBPC3',
  'TNNT2', 'TNNI3', 'KCNQ1', 'KCNH2', 'SCN5A', 'LMNA', 'TTN', 'DSP', 'PKP2', 'RYR1', 'RYR2', 'CACNA1S', 'SMN1', 'DMD',
  'FMR1', 'HTT', 'GBA', 'GBA1', 'G6PD', 'PAH', 'HEXA', 'HBA1', 'HBA2', 'SERPINA1', 'ATP7B', 'GJB2', 'COL1A1', 'COL1A2',
  'COL3A1', 'COL4A5', 'TGFBR1', 'TGFBR2', 'ACTA2', 'MYH11', 'SMAD3', 'PKD1', 'PKD2', 'CYP2C19', 'CYP2D6', 'CYP2C9',
  'VKORC1', 'SLCO1B1', 'DPYD', 'TPMT', 'NUDT15', 'UGT1A1', 'LCT', 'MCM6', 'ACE', 'ADD1', 'NOS3', 'TSC1', 'TSC2',
  'OTC', 'GAA', 'GLA', 'IDUA', 'ASPA', 'BTD', 'ACADM', 'CBS', 'SLC26A4', 'MECP2', 'PTPN11', 'SOS1', 'RAF1', 'KRAS',
  'NRAS', 'BRAF', 'EGFR', 'ALK', 'ERBB2', 'PIK3CA', 'CDKN2A', 'CDK4', 'POLE', 'POLD1', 'SDHB', 'SDHD', 'MITF', 'HOXB13',
  'APOA5', 'LPL', 'ABCA1', 'CETP', 'HMGCR', 'SORT1', 'CELSR2', 'IL6', 'TNF', 'HLA-B', 'HLA-DQA1', 'HLA-DQB1',
]);

export function isRecognisedGene(symbol: string): boolean {
  return RECOGNISED_GENE_SYMBOLS.has(symbol.toUpperCase());
}
