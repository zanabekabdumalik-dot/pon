import { useMemo, useState } from 'react';
import type { PrsResult } from '../../shared/types';
import { ordinal } from '../../shared/text';
import { ExplanationBox } from './FindingCard';
import { ConfidenceBadge, EvidenceBadge, Field, RiskBadge, SourceLinks } from './ui';

const BINS = 24;

function useBins(p: PrsResult) {
  return useMemo(() => {
    const scores = p.distribution.map((d) => d.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const span = max - min || 1;
    const bins = Array.from({ length: BINS }, (_, i) => ({ from: min + (i * span) / BINS, to: min + ((i + 1) * span) / BINS, probability: 0 }));
    const idx = (s: number) => Math.min(BINS - 1, Math.floor(((s - min) / span) * BINS));
    for (const d of p.distribution) bins[idx(d.score)].probability += d.probability;
    return { bins, you: idx(p.rawScore) };
  }, [p]);
}

/** Bars: expected distribution of the educational score in the reference population; highlighted bar: this person. */
function DistributionChart({ p }: { p: PrsResult }) {
  const { bins, you } = useBins(p);
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = 180;
  const top = 18;
  const base = H - 22;
  const maxP = Math.max(...bins.map((b) => b.probability)) || 1;
  const bw = W / BINS;
  const shown = hover ?? you;
  const fmt = (x: number) => (x < 0.001 ? '<0.1' : (x * 100).toFixed(x < 0.01 ? 2 : 1));
  const tip = bins[shown];
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Score distribution in the reference population; your score is in the ${ordinal(p.percentile)} percentile`}>
        {bins.map((b, i) => {
          const h = b.probability > 0 ? Math.max(3, ((base - top) * b.probability) / maxP) : 0;
          const x = i * bw + 1;
          const w = bw - 2;
          const isYou = i === you;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * bw} y={top} width={bw} height={base - top} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${base} V${base - h + 4} Q${x},${base - h} ${x + 4},${base - h} H${x + w - 4} Q${x + w},${base - h} ${x + w},${base - h + 4} V${base} Z`}
                  className={isYou ? 'fill-teal-600 dark:fill-teal-400' : hover === i ? 'fill-slate-400 dark:fill-slate-500' : 'fill-slate-300 dark:fill-slate-700'}
                />
              )}
              {isYou && (
                <text x={x + w / 2} y={Math.max(12, base - h - 6)} textAnchor="middle" className="fill-teal-700 text-[12px] font-bold dark:fill-teal-300">
                  You
                </text>
              )}
            </g>
          );
        })}
        <line x1={0} x2={W} y1={base} y2={base} className="stroke-line" strokeWidth={1} />
        <text x={0} y={H - 6} className="fill-muted text-[11px]">
          ← lower score
        </text>
        <text x={W} y={H - 6} textAnchor="end" className="fill-muted text-[11px]">
          higher score →
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {hover === null ? 'Your bar' : 'Hovered bar'}: about <strong className="text-ink">{fmt(tip.probability)}%</strong> of the reference population have a score in this range.
        </span>
      </div>
      <figcaption className="mt-1 text-xs text-muted">Expected spread of this educational score in the reference population (grey) and your score (teal).</figcaption>
    </figure>
  );
}

function PercentileBar({ value }: { value: number }) {
  return (
    <div>
      <div className="relative mt-6 h-3 rounded-full">
        <div className="absolute inset-0 flex gap-0.5 overflow-hidden rounded-full">
          <div className="h-full bg-emerald-400/80" style={{ width: '20%' }} />
          <div className="h-full bg-amber-300/80" style={{ width: '60%' }} />
          <div className="h-full bg-orange-400/80" style={{ width: '20%' }} />
        </div>
        <div className="absolute -top-6 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-ink" style={{ left: `${value}%` }}>
          {ordinal(value)}
        </div>
        <div className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-surface" style={{ left: `${value}%` }} />
      </div>
      <div className="mt-1.5 grid grid-cols-[20%_60%_20%] text-[11px] text-muted">
        <span>Lower</span>
        <span className="text-center">Average</span>
        <span className="text-right">Above average</span>
      </div>
    </div>
  );
}

export function PrsCard({ p }: { p: PrsResult }) {
  return (
    <article className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-bold tracking-wide text-teal-600 uppercase dark:text-teal-400">Polygenic risk score (educational)</p>
          <h3 className="text-lg font-bold text-ink">{p.trait}</h3>
        </div>
        <RiskBadge risk={p.risk} />
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="PRS">
            {p.rawScore.toFixed(3)} <span className="text-xs text-muted">(z = {p.zScore})</span>
          </Field>
          <Field label="Percentile">{ordinal(p.percentile)}</Field>
          <Field label="Reference population">
            <span className="text-xs">{p.referencePopulation}</span>
          </Field>
          <Field label="Number of variants">
            {p.variantsUsed} of {p.variantsInModel} in model
          </Field>
          <Field label="Confidence">
            <ConfidenceBadge level={p.confidence} />
          </Field>
        </dl>

        <div className="rounded-xl bg-surface-2 p-4">
          <p className="font-semibold text-ink">{p.statement}</p>
          <p className="mt-1 text-sm text-muted">This is not a probability of developing the condition. {p.confidenceReason}</p>
          <PercentileBar value={p.percentile} />
        </div>

        <DistributionChart p={p} />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 pr-3">Gene</th>
                <th className="py-2 pr-3">rsID</th>
                <th className="py-2 pr-3">Genotype</th>
                <th className="py-2 pr-3">Risk allele</th>
                <th className="py-2 pr-3">Copies</th>
                <th className="py-2">≈ OR per allele</th>
              </tr>
            </thead>
            <tbody>
              {p.contributions.map((c) => (
                <tr key={c.rsId} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-semibold text-ink">{c.gene}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{c.rsId}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{c.genotype}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{c.riskAllele}</td>
                  <td className="py-2 pr-3">{c.riskAlleleCount}</td>
                  <td className="py-2">
                    {c.oddsRatio}
                    {c.oddsRatio < 1 && <span className="ml-1 text-xs text-emerald-600">protective</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(p.missing.length > 0 || p.excluded.length > 0) && (
            <p className="mt-2 text-xs text-muted">
              {p.missing.length > 0 && <>Not in your data: {p.missing.join(', ')}. </>}
              {p.excluded.map((e) => `${e.rsId} excluded — ${e.reason}.`).join(' ')}
            </p>
          )}
        </div>

        <ExplanationBox text={p.explanation} source={p.explanationSource} />
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge level={p.evidence} />
          <SourceLinks sources={p.sources} max={6} />
        </div>
      </div>
    </article>
  );
}
