import { ClipboardList, Dna, HeartPulse, Layers, MessagesSquare, Network } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { AnalysisReport, Category } from '../../shared/types';
import { SYNTHETIC_NOTICE } from '../../shared/messages';
import { ChromosomalCard, FindingCard } from '../components/FindingCard';
import { PrsCard } from '../components/PrsCard';
import { Callout, EmptyState, PageHeader, RiskBadge } from '../components/ui';
import { useSession } from '../state/session';

const CAT: Record<Category, { title: string; icon: typeof Dna; intro: string }> = {
  chromosomal: {
    title: 'Chromosomal',
    icon: Layers,
    intro: 'Changes in the number or structure of chromosomes. They can only be assessed from a karyotype, chromosomal microarray or screening report.',
  },
  monogenic: {
    title: 'Monogenic',
    icon: Dna,
    intro: 'Conditions linked mainly to a single gene. A pathogenic variant can strongly change the chance of a condition — but rarely makes it certain.',
  },
  multifactorial: {
    title: 'Multifactorial',
    icon: Network,
    intro:
      'Common conditions depend on many genetic variants, each with a small effect, together with lifestyle and environment. Polygenic scores compare your combination of variants with a reference population.',
  },
};

export function SummaryStrip({ report }: { report: AnalysisReport }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {(['chromosomal', 'monogenic', 'multifactorial'] as Category[]).map((c) => {
        const s = report.summary[c];
        const Icon = CAT[c].icon;
        return (
          <div key={c} className="card p-4">
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-muted uppercase">
              <Icon className="size-4 text-teal-600" /> {CAT[c].title}
            </p>
            <div className="mt-2">
              <RiskBadge risk={s.risk} size="sm" label={s.risk === 'not-assessable' ? 'Not assessable' : undefined} showNote={false} />
            </div>
            <p className="mt-2 text-sm font-semibold text-ink">{s.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{s.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AnalysisPage() {
  const { report } = useSession();
  const [tab, setTab] = useState<'all' | Category>('all');
  if (!report) return <EmptyState />;

  const synthetic = report.input.dataScope === 'synthetic-demo' || report.input.profile?.synthetic;
  const findings = (c: Category) => report.findings.filter((f) => f.category === c);
  const counts: Record<Category, number> = {
    chromosomal: report.chromosomal.results.filter((r) => r.status !== 'insufficient-data').length,
    monogenic: findings('monogenic').length,
    multifactorial: findings('multifactorial').length + report.prs.length,
  };
  const show = (c: Category) => tab === 'all' || tab === c;
  const otherWarnings = report.warnings.filter((w) => w.message !== SYNTHETIC_NOTICE);

  return (
    <div>
      <PageHeader
        eyebrow="Step 3 · Analysis"
        title="Genetic interpretation"
        actions={
          <>
            <Link to="/report" className="btn-primary">
              <ClipboardList className="size-4" /> Risk report
            </Link>
            <Link to="/recommendations" className="btn-secondary">
              <HeartPulse className="size-4" /> What can I do?
            </Link>
            <Link to="/chat" className="btn-secondary">
              <MessagesSquare className="size-4" /> Ask
            </Link>
          </>
        }
      >
        {report.input.dataScopeLabel}
        {report.input.profile && ` · ${report.input.profile.label}${report.input.profile.age ? `, age ${report.input.profile.age}` : ''}${report.input.profile.sex ? `, ${report.input.profile.sex}` : ''}`}
        {' · '}
        {report.input.variantsDetected} variants detected · {report.input.clinicallyRelevant} clinically relevant
      </PageHeader>

      {synthetic && (
        <Callout tone="warning" title="Synthetic demonstration data" className="mb-4">
          {SYNTHETIC_NOTICE} Well-documented public variants were placed in an artificial profile so the knowledge base can demonstrate a real interpretation.
        </Callout>
      )}
      {report.ai.note && (
        <Callout tone="neutral" className="mb-4">
          {report.ai.note}
        </Callout>
      )}

      <SummaryStrip report={report} />

      <div className="card mt-4 p-4 text-sm leading-relaxed text-ink-2">
        <p className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">Overview · {report.overviewSource === 'ai' ? 'written by Claude' : 'built-in interpreter'}</p>
        {report.overview}
      </div>

      <div className="no-print sticky top-14 z-10 -mx-4 mt-6 bg-bg/90 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
          {(['all', 'chromosomal', 'monogenic', 'multifactorial'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition ${tab === t ? 'bg-nav text-white' : 'text-ink-2 hover:bg-surface-2'}`}
            >
              {t === 'all' ? 'All categories' : CAT[t].title}
              {t !== 'all' && <span className="ml-1.5 rounded-full bg-white/15 px-1.5 text-xs">{counts[t]}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-10">
        {show('monogenic') && (
          <Section c="monogenic">
            {findings('monogenic').length ? (
              findings('monogenic').map((f) => <FindingCard key={f.id} f={f} />)
            ) : (
              <Callout tone="neutral" title={report.summary.monogenic.headline}>
                {report.summary.monogenic.detail}
              </Callout>
            )}
            {report.testedNotDetected.some((t) => t.gene) && (
              <div className="card p-4 text-sm">
                <p className="font-semibold text-ink">Tested positions where the variant was not found</p>
                <ul className="mt-2 space-y-1 text-ink-2">
                  {report.testedNotDetected.map((t) => (
                    <li key={t.gene + t.variant}>
                      <strong>{t.gene}</strong> {t.variant} — not present{t.genotype ? ` (genotype ${t.genotype})` : ''}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Lower estimated genetic risk based on the available data does not eliminate the possibility of disease.</p>
              </div>
            )}
          </Section>
        )}

        {show('multifactorial') && (
          <Section c="multifactorial">
            {report.prs.map((p) => (
              <PrsCard key={p.traitKey} p={p} />
            ))}
            {findings('multifactorial').map((f) => (
              <FindingCard key={f.id} f={f} />
            ))}
            {!report.prs.length && !findings('multifactorial').length && (
              <Callout tone="neutral" title={report.summary.multifactorial.headline}>
                {report.summary.multifactorial.detail}
              </Callout>
            )}
          </Section>
        )}

        {show('chromosomal') && (
          <Section c="chromosomal">
            <Callout tone={report.chromosomal.assessable ? 'info' : 'neutral'} title={report.chromosomal.assessable ? 'Chromosome-level result found' : 'Not assessable from submitted data'}>
              {report.chromosomal.reason}
            </Callout>
            <div className="grid gap-3 lg:grid-cols-2">
              {report.chromosomal.results.map((r) => (
                <ChromosomalCard key={r.conditionKey + r.name} r={r} />
              ))}
            </div>
          </Section>
        )}

        {otherWarnings.length > 0 && (
          <Callout tone="info" title="Data notes">
            <ul className="list-disc space-y-0.5 pl-5">
              {otherWarnings.map((w) => (
                <li key={w.message}>{w.message}</li>
              ))}
            </ul>
          </Callout>
        )}
      </div>
    </div>
  );
}

function Section({ c, children }: { c: Category; children: ReactNode }) {
  const Icon = CAT[c].icon;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
          <span className="grid size-8 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Icon className="size-4.5" />
          </span>
          {CAT[c].title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{CAT[c].intro}</p>
      </div>
      {children}
    </section>
  );
}
