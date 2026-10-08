import type { SourceRef } from '../types';

// Link builders for public genetics resources. Search-style URLs are used where
// a stable record ID is not part of the local knowledge base, so links never
// point at a guessed record.

export const clinvarRs = (rsId: string): SourceRef => ({
  name: 'ClinVar',
  label: `ClinVar: ${rsId}`,
  url: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(rsId)}`,
});

export const clinvarTerm = (gene: string, variant: string): SourceRef => ({
  name: 'ClinVar',
  label: `ClinVar: ${gene} ${variant}`,
  url: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(`${gene}[gene] AND "${variant}"`)}`,
});

export const clinvarGene = (gene: string): SourceRef => ({
  name: 'ClinVar',
  label: `ClinVar: variants in ${gene}`,
  url: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(`${gene}[gene]`)}`,
});

export const dbsnp = (rsId: string): SourceRef => ({
  name: 'dbSNP',
  label: `dbSNP: ${rsId}`,
  url: `https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(rsId)}`,
});

export const ncbiGene = (symbol: string): SourceRef => ({
  name: 'NCBI Gene',
  label: `NCBI Gene: ${symbol}`,
  url: `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(`${symbol}[sym] AND human[orgn]`)}`,
});

export const omimEntry = (mim: string, label: string): SourceRef => ({
  name: 'OMIM',
  label: `OMIM ${mim}: ${label}`,
  url: `https://omim.org/entry/${mim}`,
});

export const omimSearch = (term: string): SourceRef => ({
  name: 'OMIM',
  label: `OMIM: ${term}`,
  url: `https://omim.org/search?search=${encodeURIComponent(term)}`,
});

export const medlineGene = (slug: string, label: string): SourceRef => ({
  name: 'MedlinePlus Genetics',
  label: `MedlinePlus Genetics: ${label} gene`,
  url: `https://medlineplus.gov/genetics/gene/${slug}/`,
});

export const medlineCondition = (slug: string, label: string): SourceRef => ({
  name: 'MedlinePlus Genetics',
  label: `MedlinePlus Genetics: ${label}`,
  url: `https://medlineplus.gov/genetics/condition/${slug}/`,
});

export const medlineTopic = (page: string, label: string): SourceRef => ({
  name: 'MedlinePlus',
  label: `MedlinePlus: ${label}`,
  url: `https://medlineplus.gov/${page}`,
});

export const gwasVariant = (rsId: string): SourceRef => ({
  name: 'GWAS Catalog',
  label: `GWAS Catalog: ${rsId}`,
  url: `https://www.ebi.ac.uk/gwas/variants/${encodeURIComponent(rsId)}`,
});

export const gwasSearch = (term: string): SourceRef => ({
  name: 'GWAS Catalog',
  label: `GWAS Catalog: ${term}`,
  url: `https://www.ebi.ac.uk/gwas/search?query=${encodeURIComponent(term)}`,
});

export const pubmed = (pmid: string, label: string): SourceRef => ({
  name: 'PubMed (NIH)',
  label,
  url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
});

export const nih = (url: string, label: string): SourceRef => ({ name: 'NIH', label, url });

export const external = (name: string, url: string, label: string): SourceRef => ({ name, label, url });

export const ACMG_GUIDELINE = pubmed(
  '25741868',
  'Richards et al. 2015 — ACMG/AMP standards for interpreting sequence variants',
);

export const PRS_FACTSHEET = nih(
  'https://www.genome.gov/Health/Genomics-and-Medicine/Polygenic-risk-scores',
  'NHGRI: Polygenic risk scores',
);

export const PREDISPOSITION = nih(
  'https://medlineplus.gov/genetics/understanding/mutationsanddisorders/predisposition/',
  'MedlinePlus Genetics: What does it mean to have a genetic predisposition to a disease?',
);

/** Reference databases shown on the Sources page. */
export const DATABASES = [
  {
    name: 'ClinVar',
    url: 'https://www.ncbi.nlm.nih.gov/clinvar/',
    by: 'NCBI / NIH',
    what: 'Public archive of how laboratories classify genetic variants (pathogenic, benign, uncertain) and the evidence behind each classification.',
  },
  {
    name: 'dbSNP',
    url: 'https://www.ncbi.nlm.nih.gov/snp/',
    by: 'NCBI / NIH',
    what: 'Catalogue of genetic variation. Each common variant gets an "rs" identifier (rsID) with its position and alleles.',
  },
  {
    name: 'OMIM',
    url: 'https://omim.org/',
    by: 'Johns Hopkins University',
    what: 'Online Mendelian Inheritance in Man — expert-curated descriptions of genes and inherited conditions.',
  },
  {
    name: 'GWAS Catalog',
    url: 'https://www.ebi.ac.uk/gwas/',
    by: 'EMBL-EBI & NHGRI',
    what: 'Results of genome-wide association studies: which common variants are statistically associated with traits and diseases, and how strongly.',
  },
  {
    name: 'MedlinePlus Genetics',
    url: 'https://medlineplus.gov/genetics/',
    by: 'U.S. National Library of Medicine',
    what: 'Plain-language explanations of genes, genetic conditions and how genetics works.',
  },
  {
    name: 'NIH / NHGRI',
    url: 'https://www.genome.gov/',
    by: 'National Human Genome Research Institute',
    what: 'Educational resources on genomics, genetic testing and polygenic risk scores.',
  },
] as const;
