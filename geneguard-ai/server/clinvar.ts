import type { ClinvarRecord } from '../shared/types';
import { config } from './config';

// Optional live lookup in NCBI ClinVar through the public E-utilities API.
// Only rsIDs are sent (never names, files or full reports), and only when the
// server enables it AND the user opts in for that analysis.

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SummaryRecord {
  uid: string;
  title?: string;
  genes?: { symbol?: string }[];
  germline_classification?: { description?: string; review_status?: string; trait_set?: { trait_name?: string }[] };
  clinical_significance?: { description?: string; review_status?: string };
  trait_set?: { trait_name?: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'GeneGuardAI-education/1.0' } });
  if (!res.ok) throw new Error(`NCBI responded ${res.status}`);
  return (await res.json()) as T;
}

export async function lookupClinvar(rsIds: string[]): Promise<{ records: Record<string, ClinvarRecord>; errors: number }> {
  const records: Record<string, ClinvarRecord> = {};
  let errors = 0;
  const key = config.clinvar.apiKey ? `&api_key=${encodeURIComponent(config.clinvar.apiKey)}` : '';
  const delay = config.clinvar.apiKey ? 110 : 350; // NCBI allows 3 req/s without a key, 10 with a key

  for (const rsId of rsIds.slice(0, 15)) {
    if (!/^rs\d{1,12}$/.test(rsId)) continue;
    try {
      const search = await getJson<{ esearchresult?: { idlist?: string[] } }>(
        `${EUTILS}/esearch.fcgi?db=clinvar&retmode=json&retmax=3&term=${encodeURIComponent(rsId)}${key}`,
      );
      const ids = search.esearchresult?.idlist ?? [];
      await sleep(delay);
      if (!ids.length) continue;
      const summary = await getJson<{ result?: Record<string, SummaryRecord> & { uids?: string[] } }>(
        `${EUTILS}/esummary.fcgi?db=clinvar&retmode=json&id=${ids.join(',')}${key}`,
      );
      await sleep(delay);
      const uid = summary.result?.uids?.[0];
      const rec = uid ? (summary.result?.[uid] as SummaryRecord | undefined) : undefined;
      if (!rec) continue;
      const cls = rec.germline_classification ?? rec.clinical_significance;
      const traits = rec.germline_classification?.trait_set ?? rec.trait_set ?? [];
      records[rsId] = {
        rsId,
        uid: rec.uid,
        title: rec.title ?? rsId,
        gene: rec.genes?.[0]?.symbol,
        significance: cls?.description ?? 'not provided',
        reviewStatus: cls?.review_status ?? 'not provided',
        conditions: traits.map((t) => t.trait_name).filter((t): t is string => Boolean(t) && t !== 'not provided' && t !== 'not specified'),
        url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${rec.uid}/`,
      };
    } catch {
      errors++;
    }
  }
  return { records, errors };
}
