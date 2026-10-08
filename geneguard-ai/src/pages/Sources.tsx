import { Database, ExternalLink } from 'lucide-react';
import { CHROMOSOMAL_CONDITIONS } from '../../shared/knowledge/chromosomal';
import { GENES } from '../../shared/knowledge/genes';
import { PRS_MODELS } from '../../shared/knowledge/prs';
import { ACMG_GUIDELINE, DATABASES, PREDISPOSITION, PRS_FACTSHEET } from '../../shared/knowledge/sources';
import { KNOWN_VARIANTS } from '../../shared/knowledge/variants';
import { MESSAGES } from '../../shared/messages';
import { Callout, EvidenceBadge, PageHeader, SourceLinks } from '../components/ui';
import { useSession } from '../state/session';

const LEVELS = [
  { level: 'high' as const, text: 'Replicated in many studies or classified by expert panels; widely accepted (e.g. BRCA1 c.5266dupC, APOE ε4).' },
  { level: 'moderate' as const, text: 'Supported by several studies or laboratories, but with some open questions about size of effect or penetrance.' },
  { level: 'limited' as const, text: 'Few or inconsistent studies; the association may be weak or not clinically useful (e.g. MTHFR C677T for disease risk).' },
  { level: 'unknown' as const, text: `No curated evidence available for this variant. ${MESSAGES.evidenceInsufficient}` },
];

export function SourcesPage() {
  const { report } = useSession();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Evidence" title="Evidence & Sources">
        Every result links to the public resources it is based on. GeneGuard uses a curated offline snapshot of these databases so it works without sending your data anywhere.
      </PageHeader>

      <section>
        <h2 className="text-lg font-bold text-ink">Evidence levels</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {LEVELS.map((l) => (
            <div key={l.level} className="card flex gap-3 p-4">
              <EvidenceBadge level={l.level} />
              <p className="text-sm text-ink-2">{l.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Evidence level describes the science. Confidence (shown separately on each result) describes how reliable your data and its interpretation are — for example a blurry photo lowers
          confidence, not evidence.
        </p>
      </section>

      {report ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink">Sources for your results</h2>
          {report.findings.map((f) => (
            <div key={f.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {f.gene ?? 'Variant'} <span className="font-mono text-sm font-normal text-ink-2">{f.variantLabel}</span>
                </p>
                <EvidenceBadge level={f.evidence} />
              </div>
              {f.evidence === 'unknown' && <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">{MESSAGES.evidenceInsufficient}</p>}
              <div className="mt-3">
                <SourceLinks sources={f.sources} max={10} />
              </div>
            </div>
          ))}
          {report.prs.map((p) => (
            <div key={p.traitKey} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">Polygenic score — {p.trait}</p>
                <EvidenceBadge level={p.evidence} />
              </div>
              <div className="mt-3">
                <SourceLinks sources={p.sources} max={10} />
              </div>
            </div>
          ))}
          {report.chromosomal.results
            .filter((r) => r.status !== 'insufficient-data')
            .map((r) => (
              <div key={r.name} className="card p-4">
                <p className="font-semibold text-ink">{r.name}</p>
                <div className="mt-3">
                  <SourceLinks sources={r.sources} />
                </div>
              </div>
            ))}
        </section>
      ) : (
        <Callout tone="info" title="No analysis in this session">
          After an analysis, this page lists the sources for each of your results.
        </Callout>
      )}

      <section>
        <h2 className="text-lg font-bold text-ink">Databases and references</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {DATABASES.map((d) => (
            <a key={d.name} href={d.url} target="_blank" rel="noreferrer noopener" className="card group flex flex-col gap-1.5 p-4 transition hover:border-teal-400">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Database className="size-4 text-teal-600" /> {d.name}
                <ExternalLink className="ml-auto size-3.5 text-muted group-hover:text-teal-600" />
              </p>
              <p className="text-xs text-muted">{d.by}</p>
              <p className="text-sm text-ink-2">{d.what}</p>
            </a>
          ))}
        </div>
        <div className="mt-3">
          <SourceLinks sources={[ACMG_GUIDELINE, PRS_FACTSHEET, PREDISPOSITION]} />
        </div>
      </section>

      <section className="card p-5 text-sm text-ink-2">
        <h2 className="font-bold text-ink">About the built-in knowledge base</h2>
        <p className="mt-2">
          The snapshot contains {Object.keys(GENES).length} genes, {KNOWN_VARIANTS.length} well-documented single-gene variants, APOE ε2/ε3/ε4 interpretation, {PRS_MODELS.length} educational
          polygenic models ({PRS_MODELS.reduce((n, m) => n + m.snps.length, 0)} SNP weights) and {CHROMOSOMAL_CONDITIONS.length} chromosomal conditions. Classifications were simplified for
          teaching; effect sizes and allele frequencies are rounded, illustrative values from published GWAS.
        </p>
        <p className="mt-2">
          Variants outside the snapshot are reported as “{MESSAGES.unknownVariant}” unless the submitted report contains a laboratory classification, or the optional live ClinVar lookup is
          enabled on the server.
        </p>
      </section>
    </div>
  );
}
