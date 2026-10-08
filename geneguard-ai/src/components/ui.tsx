import { AlertTriangle, ExternalLink, Info, ShieldAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Confidence, EvidenceLevel, RiskLevel, SourceRef } from '../../shared/types';
import { MESSAGES } from '../../shared/messages';

export const RISK_META: Record<RiskLevel, { emoji: string; label: string; cls: string; dot: string }> = {
  low: {
    emoji: '🟢',
    label: 'Low / lower genetic risk',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    dot: 'bg-emerald-500',
  },
  average: {
    emoji: '🟡',
    label: 'Average / uncertain',
    cls: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    dot: 'bg-amber-400',
  },
  elevated: {
    emoji: '🟠',
    label: 'Elevated',
    cls: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
    dot: 'bg-orange-500',
  },
  high: {
    emoji: '🔴',
    label: 'High genetic risk',
    cls: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    dot: 'bg-rose-500',
  },
  'not-assessable': {
    emoji: '⚪',
    label: 'Not assessable',
    cls: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

export function RiskBadge({ risk, label, showNote = true, size = 'md' }: { risk: RiskLevel; label?: string; showNote?: boolean; size?: 'sm' | 'md' }) {
  const m = RISK_META[risk];
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${m.cls} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}>
        <span aria-hidden>{m.emoji}</span>
        {label ?? m.label}
      </span>
      {showNote && <span className="pl-1 text-[11px] text-muted italic">{MESSAGES.notDiagnosis}</span>}
    </span>
  );
}

const CONF_META: Record<Confidence, { label: string; bars: number; cls: string }> = {
  high: { label: 'High', bars: 3, cls: 'bg-teal-500' },
  medium: { label: 'Medium', bars: 2, cls: 'bg-sky-500' },
  low: { label: 'Low', bars: 1, cls: 'bg-amber-500' },
  insufficient: { label: 'Insufficient data', bars: 0, cls: 'bg-slate-400' },
};

export function ConfidenceBadge({ level, title }: { level: Confidence; title?: string }) {
  const m = CONF_META[level];
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-ink" title={title}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`w-1.5 rounded-sm ${i < m.bars ? m.cls : 'bg-line'}`} style={{ height: 6 + i * 4 }} />
        ))}
      </span>
      {m.label}
    </span>
  );
}

const EVIDENCE_META: Record<EvidenceLevel, { label: string; cls: string }> = {
  high: { label: 'High', cls: 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-900' },
  moderate: { label: 'Moderate', cls: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-900' },
  limited: { label: 'Limited', cls: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900' },
  unknown: { label: 'Unknown', cls: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900/60 dark:border-slate-700' },
};

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const m = EVIDENCE_META[level];
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${m.cls}`}>Evidence: {m.label}</span>;
}

type Tone = 'info' | 'warning' | 'danger' | 'neutral';
const TONE: Record<Tone, { cls: string; icon: ReactNode }> = {
  info: { cls: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200', icon: <Info className="size-5 shrink-0" /> },
  warning: {
    cls: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    icon: <AlertTriangle className="size-5 shrink-0" />,
  },
  danger: { cls: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200', icon: <XCircle className="size-5 shrink-0" /> },
  neutral: { cls: 'border-line bg-surface-2 text-ink-2', icon: <ShieldAlert className="size-5 shrink-0" /> },
};

export function Callout({ tone = 'info', title, children, className = '' }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-sm ${t.cls} ${className}`} role={tone === 'danger' ? 'alert' : undefined}>
      {t.icon}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="mb-1 text-xs font-bold tracking-[0.18em] text-teal-600 uppercase dark:text-teal-400">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {children && <div className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{children}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className={`mt-0.5 text-sm break-words text-ink ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}

export function SourceLinks({ sources, max = 8 }: { sources: SourceRef[]; max?: number }) {
  const unique = sources.filter((s, i) => sources.findIndex((x) => x.url === s.url) === i).slice(0, max);
  if (!unique.length) return <p className="text-sm text-muted">{MESSAGES.evidenceInsufficient}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {unique.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-ink-2 hover:border-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
          >
            <span className="font-semibold text-teal-700 dark:text-teal-400">{s.name}</span>
            <span className="max-w-[16rem] truncate">{s.label.replace(`${s.name}: `, '')}</span>
            <ExternalLink className="size-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ title = 'No analysis yet', children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500/15 to-indigo-500/15 text-3xl">🧬</div>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{children ?? 'Upload a genetic report or start the demo to see results here.'}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/upload?mode=demo" className="btn-primary">
          Try Demo
        </Link>
        <Link to="/upload" className="btn-secondary">
          Upload genetic report
        </Link>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-500 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500/40 dark:bg-slate-700" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
      <span className="text-sm">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Very small renderer for assistant text: **bold**, bullet lines and paragraphs. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>));
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*([•\-*]|\d+\.)\s/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([•\-*]|\d+\.)\s/, ''))}</li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {/^\s*[•\-*]\s/.test(l) ? <span className="mr-1">•</span> : null}
                {inline(l.replace(/^\s*[•\-*]\s/, ''))}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
