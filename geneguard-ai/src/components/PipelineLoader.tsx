import { Check, Loader2 } from 'lucide-react';
import { ON_DEVICE } from '../lib/env';
import { DnaHelix } from './DnaHelix';

export const PIPELINE_STEPS = [
  { title: 'User data', detail: 'Your file, photo or entered data' },
  { title: 'File / Photo / PDF', detail: `Reading the document ${ON_DEVICE}` },
  { title: 'OCR / Document parsing', detail: 'Recognising text and structure' },
  { title: 'Genetic variant extraction', detail: 'Genes, variants, rsIDs, genotypes' },
  { title: 'Variant validation', detail: 'Format, alleles and data quality checks' },
  { title: 'Genetic knowledge base', detail: 'ClinVar · dbSNP · OMIM · GWAS Catalog snapshot' },
  { title: 'AI genetic interpreter', detail: 'Plain-language explanations' },
  { title: 'Risk assessment', detail: 'Chromosomal · monogenic · multifactorial' },
  { title: 'Prevention recommendations', detail: 'Safe, general guidance' },
  { title: 'User-friendly report', detail: 'Summary, evidence and sources' },
];

export interface PipelineView {
  active: number; // index of the step in progress
  detail?: string;
  progress?: number; // 0–1 for long steps like OCR
  title?: string;
}

export function PipelineLoader({ view }: { view: PipelineView }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-live="polite">
      <div className="card relative w-full max-w-3xl overflow-hidden p-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(20,184,166,0.16),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(99,102,241,0.14),transparent_50%)]" />
        <div className="relative grid gap-0 md:grid-cols-[220px_1fr]">
          <div className="relative flex flex-col items-center justify-center gap-3 border-b border-line bg-nav px-6 py-6 text-teal-200 md:border-r md:border-b-0">
            <div className="relative h-36 md:h-64">
              <DnaHelix className="h-full w-auto" rungs={12} height={300} speed={1.8} />
              <div className="absolute inset-x-0 h-0.5 animate-scan bg-gradient-to-r from-transparent via-teal-300 to-transparent shadow-[0_0_12px_2px_rgba(45,212,191,0.6)]" />
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <h2 className="text-lg font-bold text-ink sm:text-xl">{view.title ?? 'Analyzing your genetic report...'}</h2>
            <p className="mt-1 min-h-5 text-sm text-muted">{view.detail}</p>
            {view.progress !== undefined && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-label="Progress">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${Math.round(view.progress * 100)}%` }} />
              </div>
            )}
            <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {PIPELINE_STEPS.map((s, i) => {
                const done = i < view.active;
                const current = i === view.active;
                return (
                  <li
                    key={s.title}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${current ? 'bg-teal-500/10 text-ink' : done ? 'text-ink-2' : 'text-muted/70'}`}
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? 'bg-teal-500 text-white' : current ? 'bg-surface text-teal-600 ring-2 ring-teal-500' : 'bg-surface-2 text-muted'}`}
                    >
                      {done ? <Check className="size-3.5" /> : current ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.title}</span>
                      {current && <span className="block truncate text-xs text-muted">{s.detail}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
