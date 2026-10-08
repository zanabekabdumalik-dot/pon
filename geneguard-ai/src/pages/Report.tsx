import { Download, Printer } from 'lucide-react';
import type { AnalysisReport, Category } from '../../shared/types';
import { MESSAGES, SYNTHETIC_NOTICE } from '../../shared/messages';
import { ordinal } from '../../shared/text';
import { EmptyState, PageHeader, RISK_META } from '../components/ui';
import { useSession } from '../state/session';

const CAT_LABEL: Record<Category, string> = { chromosomal: 'Chromosomal', monogenic: 'Monogenic', multifactorial: 'Multifactorial' };

function reportAsText(r: AnalysisReport): string {
  const lines: string[] = [];
  lines.push('GENEGUARD AI REPORT', `Generated: ${new Date(r.createdAt).toLocaleString('en-GB')}`, '');
  if (r.input.dataScope === 'synthetic-demo' || r.input.profile?.synthetic) lines.push(SYNTHETIC_NOTICE, '');
  lines.push(`Genetic data analyzed: ${r.input.dataScopeLabel}`, `Variants detected: ${r.input.variantsDetected}`, `Clinically relevant variants: ${r.input.clinicallyRelevant}`, '');
  lines.push('GENETIC RISK SUMMARY');
  for (const c of ['monogenic', 'multifactorial', 'chromosomal'] as Category[]) lines.push(`${CAT_LABEL[c]}: ${RISK_META[r.summary[c].risk].emoji} ${r.summary[c].headline}`);
  lines.push(MESSAGES.notDiagnosis, '', 'OVERVIEW', r.overview, '', 'IMPORTANT FINDINGS');
  r.findings.forEach((f, i) =>
    lines.push(
      `${i + 1}. ${f.gene ?? 'Variant'} — ${f.variantLabel}`,
      `   Clinical significance: ${f.significanceLabel}`,
      `   Evidence: ${f.evidence} · Confidence: ${f.confidence} · Risk: ${RISK_META[f.risk].label}`,
      `   ${f.interpretation}`,
    ),
  );
  if (r.prs.length) {
    lines.push('', 'POLYGENIC SCORES (educational)');
    for (const p of r.prs) lines.push(`- ${p.trait}: ${ordinal(p.percentile)} percentile, ${p.variantsUsed} variants, confidence ${p.confidence}`);
  }
  lines.push('', 'RECOMMENDATIONS');
  r.recommendations.slice(0, 8).forEach((x, i) => lines.push(`${i + 1}. ${x.title} — ${x.detail}`));
  lines.push('', ...r.disclaimers);
  return lines.join('\n');
}

export function ReportPage() {
  const { report } = useSession();
  if (!report) return <EmptyState />;
  const important = [...report.findings].sort((a, b) => {
    const order = ['high', 'elevated', 'average', 'low', 'not-assessable'];
    return Number(b.clinicallyRelevant) - Number(a.clinicallyRelevant) || order.indexOf(a.risk) - order.indexOf(b.risk);
  });
  const synthetic = report.input.dataScope === 'synthetic-demo' || report.input.profile?.synthetic;

  const download = () => {
    const blob = new Blob([reportAsText(report)], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'geneguard-report.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Risk report"
        title="Your GeneGuard report"
        actions={
          <>
            <button type="button" className="btn-primary" onClick={() => window.print()}>
              <Printer className="size-4" /> Print / save as PDF
            </button>
            <button type="button" className="btn-secondary" onClick={download}>
              <Download className="size-4" /> Download .txt
            </button>
          </>
        }
      >
        A one-page summary to read calmly or to take to a doctor or genetic counselor. The file is created in your browser.
      </PageHeader>

      <article className="card mx-auto max-w-4xl overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-nav px-6 py-5 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-teal-200 uppercase">GeneGuard AI Report</p>
              <p className="text-lg font-bold">Educational genetic risk interpretation</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-300">
            <p>{new Date(report.createdAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}</p>
            <p className="font-mono opacity-70">{report.id.split('-').slice(1, 3).join('-')}</p>
          </div>
        </header>

        <div className="space-y-8 px-6 py-6 sm:px-8">
          {synthetic && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{SYNTHETIC_NOTICE}</p>}

          <section className="grid gap-4 sm:grid-cols-3">
            <Metric label="Genetic data analyzed" value={report.input.dataScopeLabel} />
            <Metric label="Variants detected" value={String(report.input.variantsDetected)} />
            <Metric label="Clinically relevant variants" value={String(report.input.clinicallyRelevant)} />
          </section>

          <section>
            <h2 className="text-sm font-bold tracking-[0.15em] text-muted uppercase">Genetic risk summary</h2>
            <div className="mt-3 divide-y divide-line rounded-xl border border-line">
              {(['monogenic', 'multifactorial', 'chromosomal'] as Category[]).map((c) => {
                const s = report.summary[c];
                return (
                  <div key={c} className="grid gap-1 p-4 sm:grid-cols-[160px_1fr]">
                    <p className="font-semibold text-ink">{CAT_LABEL[c]}</p>
                    <div>
                      <p className="font-medium text-ink">
                        <span aria-hidden>{RISK_META[s.risk].emoji}</span> {s.headline}
                      </p>
                      <p className="text-sm text-muted">{s.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted italic">{MESSAGES.notDiagnosis}</p>
          </section>

          <section>
            <h2 className="text-sm font-bold tracking-[0.15em] text-muted uppercase">Overview</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{report.overview}</p>
          </section>

          <section>
            <h2 className="text-sm font-bold tracking-[0.15em] text-muted uppercase">Important findings</h2>
            {important.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No individual variant findings. {report.summary.monogenic.detail}</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {important.map((f, i) => (
                  <li key={f.id} className="card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-ink">
                        {i + 1}. {f.gene ?? 'Variant'} <span className="font-mono text-sm font-normal text-ink-2">{f.variantLabel}</span>
                      </p>
                      <span className="text-sm font-medium">
                        {RISK_META[f.risk].emoji} {RISK_META[f.risk].label}
                      </span>
                    </div>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="inline text-muted">Clinical significance: </dt>
                        <dd className="inline text-ink">{f.significanceLabel}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">Evidence: </dt>
                        <dd className="inline text-ink capitalize">{f.evidence}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted">Confidence: </dt>
                        <dd className="inline text-ink capitalize">{f.confidence}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-sm text-ink-2">{f.interpretation}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {report.prs.length > 0 && (
            <section>
              <h2 className="text-sm font-bold tracking-[0.15em] text-muted uppercase">Polygenic scores (educational)</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted uppercase">
                    <tr>
                      <th className="py-2 pr-3">Trait</th>
                      <th className="py-2 pr-3">Percentile</th>
                      <th className="py-2 pr-3">Variants</th>
                      <th className="py-2 pr-3">Confidence</th>
                      <th className="py-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.prs.map((p) => (
                      <tr key={p.traitKey} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3 font-medium text-ink">{p.trait}</td>
                        <td className="py-2 pr-3">{ordinal(p.percentile)}</td>
                        <td className="py-2 pr-3">
                          {p.variantsUsed}/{p.variantsInModel}
                        </td>
                        <td className="py-2 pr-3 capitalize">{p.confidence}</td>
                        <td className="py-2">
                          {RISK_META[p.risk].emoji} {RISK_META[p.risk].label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">A percentile compares your combination of variants with a reference population. It is not a probability of developing a disease.</p>
            </section>
          )}

          <section>
            <h2 className="text-sm font-bold tracking-[0.15em] text-muted uppercase">Recommendations</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
              {report.recommendations.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <strong className="text-ink">{r.title}.</strong> {r.detail}
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-1.5 rounded-xl bg-surface-2 p-4 text-xs leading-relaxed text-muted">
            {report.disclaimers.map((d) => (
              <p key={d}>{d}</p>
            ))}
            <p>{MESSAGES.predispositionNotDestiny}</p>
          </section>
        </div>
      </article>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}
