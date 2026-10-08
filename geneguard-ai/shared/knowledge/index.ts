import type { ExtractedVariant } from '../types';
import { aliasKey, hgvsKey, proteinKey } from '../parsing/normalize';
import { CONDITIONS, type ConditionInfo } from './conditions';
import { GENES, type GeneInfo } from './genes';
import { PRS_SNP_INDEX } from './prs';
import { APOE_SNPS, KNOWN_VARIANTS, type KnownVariant } from './variants';

export * from './conditions';
export * from './genes';
export * from './prs';
export * from './variants';
export * from './chromosomal';
export * from './sources';

/** All rsIDs the knowledge base can interpret — used to pre-filter very large SNP files in the browser. */
export const KNOWN_RSIDS: Set<string> = new Set([
  ...KNOWN_VARIANTS.flatMap((v) => (v.rsId ? [v.rsId] : [])),
  ...PRS_SNP_INDEX.keys(),
  ...Object.keys(APOE_SNPS),
]);

export const geneInfo = (symbol: string | undefined): GeneInfo | undefined => (symbol ? GENES[symbol.toUpperCase()] : undefined);

export const conditionInfo = (key: string | undefined): ConditionInfo | undefined => (key ? CONDITIONS[key] : undefined);

export type MatchMethod = 'rsid' | 'hgvs-c' | 'hgvs-p' | 'alias' | 'position';

/** Finds a curated variant matching the extracted data. Returns how it matched so the UI can explain it. */
export function findKnownVariant(v: ExtractedVariant): { variant: KnownVariant; method: MatchMethod } | undefined {
  if (v.rsId) {
    const byRs = KNOWN_VARIANTS.find((k) => k.rsId === v.rsId);
    if (byRs && (!v.gene || v.gene === byRs.gene)) return { variant: byRs, method: 'rsid' };
  }
  const candidates = v.gene ? KNOWN_VARIANTS.filter((k) => k.gene === v.gene) : KNOWN_VARIANTS;
  const c = hgvsKey(v.hgvsC);
  if (c) {
    const hit = candidates.find((k) => hgvsKey(k.hgvsC) === c || k.aliases.some((a) => a.startsWith('c.') && hgvsKey(a) === c));
    if (hit && v.gene) return { variant: hit, method: 'hgvs-c' };
  }
  const p = proteinKey(v.hgvsP);
  if (p) {
    const hit = candidates.find((k) => proteinKey(k.hgvsP) === p || k.aliases.some((a) => proteinKey(a) === p));
    if (hit && v.gene) return { variant: hit, method: 'hgvs-p' };
  }
  for (const name of [v.legacyName, v.hgvsC, v.hgvsP]) {
    if (!name) continue;
    const key = aliasKey(name);
    const hit = candidates.find((k) => k.aliases.some((a) => aliasKey(a) === key));
    // Legacy names are only trusted together with a gene symbol, except a few unambiguous ones.
    if (hit && (v.gene || /f508del|factorvleiden|g20210a|c282y/.test(key))) return { variant: hit, method: 'alias' };
  }
  if (v.chromosome && v.position && v.ref && v.alt) {
    const chrom = v.chromosome.replace(/^chr/i, '');
    const hit = KNOWN_VARIANTS.find(
      (k) => k.grch38 && k.grch38.chrom === chrom && k.grch38.pos === v.position && k.grch38.ref === v.ref && k.grch38.alt === v.alt,
    );
    if (hit) return { variant: hit, method: 'position' };
  }
  return undefined;
}

/** Resolves an rsID for PRS / APOE SNPs, also from GRCh38 coordinates when the file has no rsIDs. */
export function resolveSnpRsId(v: ExtractedVariant): string | undefined {
  if (v.rsId) return v.rsId;
  if (!v.chromosome || !v.position) return undefined;
  const chrom = v.chromosome.replace(/^chr/i, '');
  for (const [rsId, snp] of PRS_SNP_INDEX) if (snp.grch38 && snp.grch38.chrom === chrom && snp.grch38.pos === v.position) return rsId;
  for (const [rsId, snp] of Object.entries(APOE_SNPS)) if (snp.grch38.chrom === chrom && snp.grch38.pos === v.position) return rsId;
  return undefined;
}

export function findConditionInText(text: string | undefined): ConditionInfo | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return Object.values(CONDITIONS).find((c) => c.aliases.some((a) => lower.includes(a)));
}
