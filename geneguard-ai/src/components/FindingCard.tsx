import { AlertTriangle, Bot, ChevronDown, Stethoscope } from 'lucide-react';
import type { ChromosomalResult, Finding } from '../../shared/types';
import { MESSAGES } from '../../shared/messages';
import { ConfidenceBadge, EvidenceBadge, Field, RiskBadge, SourceLinks } from './ui';

const ZYG: Record<string, string> = {
  heterozygous: 'Heterozygous (1 copy)',
  homozygous: 'Homozygous (2 copies)',
  hemizygous: 'Hemizygous',
  'homozygous-reference': 'No variant (reference)',
  unknown: 'Not provided',
};

export function ExplanationBox({ text, source }: { text: string; source: 'built-in' | 'ai' }) {
  return (
    <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-teal-50 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-teal-950/20">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-indigo-700 uppercase dark:text-indigo-300">
        <Bot className="size-4" /> AI explanation <span className="font-medium normal-case opacity-70">· {source === 'ai' ? 'written by Claude' : 'built-in interpreter'}</span>
      </p>
      <p className="text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}

export function FindingCard({ f }: { f: Finding }) {
  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-ink">{f.gene ?? 'Unknown gene'}</h3>
            <span className="font-mono text-sm text-ink-2">{f.variantLabel}</span>
            {f.carrier && <span className="chip border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">Carrier</span>}
            {f.demo && <span className="chip">Synthetic demo</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-ink-2">{f.riskHeadline}</p>
        </div>
        <RiskBadge risk={f.risk} />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
          <Field label="Gene">{f.gene ?? '—'}</Field>
          <Field label="Variant" mono>
            {f.variantLabel}
          </Field>
          <Field label="Condition">{f.condition}</Field>
          <Field label="Inheritance">{f.inheritance}</Field>
          <Field label="Clinical significance">
            {f.significanceLabel}
            {f.significanceSource === 'report' && <span className="block text-xs text-muted">from the submitted data</span>}
            {f.significanceSource === 'clinvar-live' && <span className="block text-xs text-muted">live ClinVar lookup</span>}
          </Field>
          <Field label="Evidence level">
            <EvidenceBadge level={f.evidence} />
          </Field>
          <Field label="Confidence">
            <ConfidenceBadge level={f.confidence} title={f.confidenceReason} />
          </Field>
          <Field label="Zygosity / genotype">
            {f.zygosity ? ZYG[f.zygosity] : 'Not provided'}
            {f.genotype && <span className="block font-mono text-xs text-muted">{f.genotype}</span>}
          </Field>
        </dl>

        <div>
          <p className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">Risk interpretation</p>
          <p className="text-sm leading-relaxed text-ink">{f.interpretation}</p>
          <p className="mt-1 text-xs text-muted italic">{MESSAGES.notDiagnosis}</p>
        </div>

        <ExplanationBox text={f.explanation} source={f.explanationSource} />

        {f.requiresConfirmation && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <Stethoscope className="mt-0.5 size-4 shrink-0" />
            Discuss with a doctor or genetic counselor; confirm with appropriate clinical testing.
          </p>
        )}
        {f.confidence === 'low' && (
          <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {MESSAGES.uncertain}
          </p>
        )}

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-teal-700 dark:text-teal-400">
            <ChevronDown className="size-4 transition group-open:rotate-180" /> Details, confidence and sources
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-ink-2">
              <strong className="text-ink">Why this confidence:</strong> {f.confidenceReason}
            </p>
            {f.notes.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-ink-2">
                {f.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <SourceLinks sources={f.sources} />
          </div>
        </details>
      </div>
    </article>
  );
}

const STATUS: Record<ChromosomalResult['status'], { label: string; cls: string }> = {
  detected: { label: 'Detected (as reported)', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200' },
  'screen-positive': { label: 'Screening positive', cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200' },
  'not-detected': { label: 'Not detected (as reported)', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' },
  'insufficient-data': { label: 'Insufficient data', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

export function ChromosomalCard({ r }: { r: ChromosomalResult }) {
  const s = STATUS[r.status];
  return (
    <article className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{r.name}</h3>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
        </div>
        {r.status !== 'insufficient-data' ? <RiskBadge risk={r.risk} size="sm" label={r.status === 'not-detected' ? 'Not reported' : undefined} /> : <RiskBadge risk="not-assessable" size="sm" showNote={false} />}
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="What this change means">{r.meaning}</Field>
        </div>
        <Field label="How reliable is the result">
          <ConfidenceBadge level={r.reliability} />
          <span className="mt-1 block text-xs text-muted">{r.reliabilityReason}</span>
        </Field>
        <Field label="Specialist confirmation">
          {r.requiresConfirmation ? 'Required — a clinical geneticist should review this result.' : r.status === 'insufficient-data' ? 'Not applicable — no result available.' : 'Discuss with a doctor if you have questions.'}
          {r.evidenceText && <span className="mt-1 block font-mono text-xs text-muted">Report: {r.evidenceText}</span>}
        </Field>
      </dl>
      {r.sources.length > 0 && (
        <div className="mt-3">
          <SourceLinks sources={r.sources} max={3} />
        </div>
      )}
    </article>
  );
}
