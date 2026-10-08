import { CheckCircle2, FileSearch, Plus, RotateCcw, ScanLine, Sparkles, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ChromosomalObservation, ExtractedVariant, ParsedInput, Zygosity } from '../../shared/types';
import { CHROMOSOMAL_BY_KEY } from '../../shared/knowledge/chromosomal';
import { isRecognisedGene } from '../../shared/knowledge/genes';
import { MESSAGES } from '../../shared/messages';
import { makeId, variantIsIncomplete } from '../../shared/parsing';
import { DATA_SCOPE_LABEL } from '../../shared/engine/analyze';
import { ConfirmAction } from '../components/ConfirmAction';
import { Callout, EmptyState, PageHeader, Toggle } from '../components/ui';
import { fileKind } from '../lib/files';
import { usePipeline } from '../state/pipeline';
import { useSession } from '../state/session';

const KIND_LABEL: Record<ParsedInput['kind'], string> = {
  photo: 'Photo / screenshot',
  pdf: 'PDF document',
  vcf: 'VCF file',
  'snp-array': 'Raw genotype file',
  text: 'Text',
  manual: 'Manual entry',
  demo: 'Synthetic demo',
};

type EditableKey = 'gene' | 'hgvsC' | 'hgvsP' | 'legacyName' | 'rsId' | 'chromosome' | 'position' | 'genotype' | 'reportedSignificance' | 'reportedCondition' | 'labInterpretation';

const FIELDS: { key: EditableKey; label: string; placeholder: string; validate?: (v: string) => string | undefined }[] = [
  { key: 'gene', label: 'Gene', placeholder: 'e.g. BRCA1', validate: (v) => (v && !isRecognisedGene(v) ? 'Not in the reference gene list — check spelling' : undefined) },
  { key: 'hgvsC', label: 'Variant (c.)', placeholder: 'c.5266dupC', validate: (v) => (v && !/^c\./.test(v) ? 'cDNA notation starts with “c.”' : undefined) },
  { key: 'hgvsP', label: 'Protein (p.)', placeholder: 'p.Gln1756Profs*74', validate: (v) => (v && !/^p\./.test(v) ? 'Protein notation starts with “p.”' : undefined) },
  { key: 'legacyName', label: 'Common name', placeholder: 'e.g. F508del' },
  { key: 'rsId', label: 'rsID', placeholder: 'rs80357906', validate: (v) => (v && !/^rs\d+$/.test(v) ? 'Format: rs followed by digits' : undefined) },
  { key: 'chromosome', label: 'Chromosome', placeholder: '17', validate: (v) => (v && !/^(chr)?(\d{1,2}|X|Y|MT)$/i.test(v) ? '1–22, X, Y or MT' : undefined) },
  { key: 'position', label: 'Position', placeholder: '43057062', validate: (v) => (v && !/^\d+$/.test(v) ? 'Whole number' : undefined) },
  { key: 'genotype', label: 'Genotype', placeholder: 'C/T', validate: (v) => (v && !/^[ACGTDI]+\/?[ACGTDI]*$/i.test(v) ? 'Alleles such as C/T' : undefined) },
  { key: 'reportedSignificance', label: 'Pathogenicity (as reported)', placeholder: 'Pathogenic' },
  { key: 'reportedCondition', label: 'Condition (as reported)', placeholder: 'Cystic fibrosis' },
  { key: 'labInterpretation', label: 'Laboratory interpretation', placeholder: '—' },
];

function finalize(input: ParsedInput): ParsedInput {
  const incomplete = input.variants.filter(variantIsIncomplete);
  const warnings = input.warnings.filter((w) => w.code !== 'insufficient' && !(w.code === 'no-genetic-info' && (input.variants.length || input.chromosomal.length)));
  for (const v of incomplete) {
    const name = [v.gene, v.hgvsC ?? v.legacyName ?? v.rsId].filter(Boolean).join(' ') || 'A variant';
    warnings.push({ code: 'insufficient', message: `${MESSAGES.insufficient} ${name}: the exact variant or zygosity/genotype is missing.` });
  }
  return { ...input, warnings };
}

export function ReviewPage() {
  const { parsed, setParsed, uploaded, aiAvailable, status, consentAi, setConsentAi, consentClinvar, setConsentClinvar } = useSession();
  const { runAnalysis, runVision } = usePipeline();
  const navigate = useNavigate();

  const counts = useMemo(() => {
    if (!parsed) return null;
    const by = (code: string) => parsed.warnings.filter((w) => w.code === code);
    return {
      none: by('no-genetic-info'),
      partial: by('partial'),
      insufficient: by('insufficient'),
      lowOcr: by('low-ocr-confidence'),
      other: parsed.warnings.filter((w) => !['no-genetic-info', 'partial', 'insufficient', 'low-ocr-confidence'].includes(w.code)),
    };
  }, [parsed]);

  if (!parsed || !counts) return <EmptyState title="Nothing to review yet">Upload a file, photo or PDF first — the extracted data will appear here for checking.</EmptyState>;

  const updateVariant = (id: string, patch: Partial<ExtractedVariant>) =>
    setParsed({ ...parsed, variants: parsed.variants.map((v) => (v.id === id ? { ...v, ...patch, userEdited: true } : v)) });
  const removeVariant = (id: string) => setParsed({ ...parsed, variants: parsed.variants.filter((v) => v.id !== id) });
  const removeChrom = (id: string) => setParsed({ ...parsed, chromosomal: parsed.chromosomal.filter((c) => c.id !== id) });
  const addVariant = () =>
    setParsed({ ...parsed, variants: [...parsed.variants, { id: makeId('man'), source: parsed.kind === 'demo' ? 'manual' : parsed.kind === 'snp-array' ? 'manual' : parsed.kind, userEdited: true }] });

  const nothing = parsed.variants.length === 0 && parsed.chromosomal.length === 0;
  const canVision = aiAvailable && uploaded?.file && fileKind(uploaded.file) === 'image';
  const big = parsed.variants.length > 40;

  return (
    <div>
      <PageHeader
        eyebrow="Step 2"
        title="Review extracted data"
        actions={
          <Link to="/upload" className="btn-secondary">
            <RotateCcw className="size-4" /> Start over
          </Link>
        }
      >
        Check what GeneGuard read from your data and correct any recognition errors. Empty fields were not found — they are never filled in by guessing.
      </PageHeader>

      <div className="card mb-5 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Source" value={KIND_LABEL[parsed.kind]} sub={parsed.fileName} />
        <Stat label="Data type" value={DATA_SCOPE_LABEL[parsed.dataScope]} />
        <Stat
          label="Detected"
          value={`${parsed.variants.length} variant${parsed.variants.length === 1 ? '' : 's'}`}
          sub={[parsed.chromosomal.length ? `${parsed.chromosomal.length} chromosomal result(s)` : '', parsed.stats.markersGenotyped ? `${parsed.stats.markersGenotyped.toLocaleString('en')} markers in file` : '']
            .filter(Boolean)
            .join(' · ')}
        />
        <Stat
          label="Text recognition"
          value={parsed.ocrEngine ? (parsed.ocrConfidence !== undefined ? `${Math.round(parsed.ocrConfidence)}% confidence` : 'AI transcription') : 'Not needed'}
          sub={parsed.ocrEngine}
        />
      </div>

      <div className="mb-5 space-y-3">
        {nothing && (
          <Callout tone="danger" title={MESSAGES.noGeneticInfo}>
            <p>No genes, variants, rsIDs, genotypes or chromosome results were found. If this is a genetic report, try a sharper photo, the PDF version, or enter the values manually.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/upload?mode=photo" className="btn-secondary py-1.5 text-xs">
                Try another photo
              </Link>
              <Link to="/upload?mode=manual" className="btn-secondary py-1.5 text-xs">
                Enter manually
              </Link>
              <button type="button" className="btn-secondary py-1.5 text-xs" onClick={addVariant}>
                <Plus className="size-3.5" /> Add a variant here
              </button>
            </div>
          </Callout>
        )}
        {!nothing && counts.partial.length > 0 && <Callout tone="warning" title={MESSAGES.partial} />}
        {counts.insufficient.length > 0 && (
          <Callout tone="warning" title={MESSAGES.insufficient}>
            <ul className="list-disc pl-5">
              {counts.insufficient.map((w) => (
                <li key={w.message}>{w.message.replace(`${MESSAGES.insufficient} `, '')}</li>
              ))}
            </ul>
          </Callout>
        )}
        {counts.lowOcr.map((w) => (
          <Callout key={w.message} tone="warning" title="Low recognition confidence">
            {w.message}
          </Callout>
        ))}
        {counts.other.length > 0 && (
          <Callout tone="info" title="Notes">
            <ul className="list-disc space-y-0.5 pl-5">
              {counts.other.map((w) => (
                <li key={w.message}>{w.message}</li>
              ))}
            </ul>
          </Callout>
        )}
      </div>

      {canVision && (
        <div className="card mb-5 flex flex-col gap-3 border-indigo-200 p-4 sm:flex-row sm:items-center dark:border-indigo-900">
          <Sparkles className="size-6 shrink-0 text-indigo-500" />
          <p className="flex-1 text-sm text-ink-2">
            <strong className="text-ink">Recognition looks wrong?</strong> Re-read the image with Claude Vision. <span className="text-muted">This sends the image to Anthropic’s API for transcription only.</span>
          </p>
          <ConfirmAction
            className="btn-secondary"
            align="right"
            question="Send this image to Anthropic (Claude) for text transcription? GeneGuard does not store it."
            confirmLabel="Send image"
            onConfirm={() => void runVision(uploaded!.file!)}
          >
            <ScanLine className="size-4" /> Re-read with AI Vision
          </ConfirmAction>
        </div>
      )}

      {parsed.variants.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <FileSearch className="size-5 text-teal-600" /> Detected variants
          </h2>
          {big ? (
            <CompactTable variants={parsed.variants} onRemove={removeVariant} />
          ) : (
            parsed.variants.map((v, i) => <VariantCard key={v.id} index={i} v={v} onChange={(p) => updateVariant(v.id, p)} onRemove={() => removeVariant(v.id)} />)
          )}
        </section>
      )}

      {parsed.chromosomal.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-bold text-ink">Chromosome-level results</h2>
          {parsed.chromosomal.map((c) => (
            <ChromCard key={c.id} c={c} onRemove={() => removeChrom(c.id)} />
          ))}
        </section>
      )}

      {parsed.rawText && (
        <details className="card mt-6 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Show recognised text</summary>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface-2 p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">{parsed.rawText}</pre>
        </details>
      )}

      <div className="card mt-6 space-y-4 p-5">
        <h2 className="font-semibold text-ink">Analysis options</h2>
        <Toggle
          checked={consentAi && aiAvailable}
          disabled={!aiAvailable}
          onChange={setConsentAi}
          label={aiAvailable ? `Use Claude AI (${status?.ai.model}) to write plain-language explanations` : 'AI explanations (need the GeneGuard server with an API key)'}
          description={
            aiAvailable
              ? 'The extracted variant list (genes, variants, genotypes — not your file, name or document text) is sent to Anthropic’s API. Risk levels are always decided by GeneGuard’s rules, not by the AI.'
              : 'GeneGuard will use its built-in explanations. No data is sent to any external service.'
          }
        />
        {status?.clinvarLookup && (
          <Toggle
            checked={consentClinvar}
            onChange={setConsentClinvar}
            label="Look up unknown rsIDs in NCBI ClinVar (live)"
            description="Only rsIDs that are not in the built-in knowledge base are sent to NCBI (U.S. National Library of Medicine)."
          />
        )}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <button type="button" className="btn-primary" disabled={nothing} onClick={() => void runAnalysis(finalize(parsed))}>
            <CheckCircle2 className="size-4" /> Confirm extracted data
          </button>
          <button type="button" className="btn-secondary" onClick={addVariant}>
            <Plus className="size-4" /> Add variant
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/upload')}>
            Cancel
          </button>
        </div>
        {counts.partial.length > 0 && !nothing && <p className="text-xs text-amber-700 dark:text-amber-300">{MESSAGES.partial}</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  );
}

function VariantCard({ v, index, onChange, onRemove }: { v: ExtractedVariant; index: number; onChange: (p: Partial<ExtractedVariant>) => void; onRemove: () => void }) {
  const found = FIELDS.filter((f) => v[f.key] !== undefined && v[f.key] !== '').length + (v.zygosity ? 1 : 0);
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-lg bg-teal-500/10 text-sm font-bold text-teal-700 dark:text-teal-300">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            Detected: {v.gene ?? 'Unknown gene'} {v.hgvsC ?? v.legacyName ?? v.rsId ?? ''}
          </p>
          <p className="text-xs text-muted">
            {found} of {FIELDS.length + 1} fields found{v.userEdited ? ' · edited by you' : ''}
            {v.demo ? ' · synthetic demo data' : ''}
          </p>
        </div>
        <button type="button" className="btn-ghost px-2.5 text-rose-600" onClick={onRemove} aria-label="Remove variant">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((f) => {
          const raw = v[f.key];
          const value = raw === undefined ? '' : String(raw);
          const err = f.validate?.(value);
          return (
            <label key={f.key} className={f.key === 'labInterpretation' || f.key === 'reportedCondition' ? 'lg:col-span-2' : ''}>
              <span className="label flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${value ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                {f.label}
              </span>
              <input
                className={`input ${err ? 'border-amber-400' : ''}`}
                value={value}
                placeholder="Not detected"
                title={`Example: ${f.placeholder}`}
                onChange={(e) => {
                  const t = e.target.value;
                  onChange({ [f.key]: f.key === 'position' ? (t ? Number(t.replace(/\D/g, '')) || undefined : undefined) : t || undefined } as Partial<ExtractedVariant>);
                }}
              />
              {err && <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-300">{err}</span>}
            </label>
          );
        })}
        <label>
          <span className="label flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${v.zygosity ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
            Zygosity
          </span>
          <select className="input" value={v.zygosity ?? ''} onChange={(e) => onChange({ zygosity: (e.target.value || undefined) as Zygosity | undefined })}>
            <option value="">Not detected</option>
            <option value="heterozygous">Heterozygous (1 copy)</option>
            <option value="homozygous">Homozygous (2 copies)</option>
            <option value="hemizygous">Hemizygous</option>
            <option value="homozygous-reference">Homozygous reference (no variant)</option>
          </select>
        </label>
      </div>
      {(v.quality !== undefined || v.filter || v.ref) && (
        <p className="mt-3 font-mono text-xs text-muted">
          REF {v.ref ?? '—'} · ALT {v.alt ?? '—'} · QUAL {v.quality ?? '—'} · FILTER {v.filter ?? '—'}
          {v.genotypeQuality !== undefined ? ` · GQ ${v.genotypeQuality}` : ''}
          {v.readDepth !== undefined ? ` · DP ${v.readDepth}` : ''}
        </p>
      )}
      {v.sourceText && (
        <div className="mt-3 rounded-lg border border-dashed border-line bg-surface-2 p-2.5">
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Read from</p>
          <pre className="mt-1 font-mono text-xs whitespace-pre-wrap text-ink-2">{v.sourceText}</pre>
        </div>
      )}
    </div>
  );
}

function CompactTable({ variants, onRemove }: { variants: ExtractedVariant[]; onRemove: (id: string) => void }) {
  const shown = variants.slice(0, 300);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-line tracking-wide text-muted uppercase">
          <tr>
            {['Gene', 'rsID', 'Chr', 'Position', 'REF', 'ALT', 'Genotype', 'Zygosity', 'QUAL', 'FILTER', ''].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {shown.map((v) => (
            <tr key={v.id} className="border-b border-line last:border-0">
              <td className="px-3 py-1.5 font-sans font-semibold text-ink">{v.gene ?? '—'}</td>
              <td className="px-3 py-1.5">{v.rsId ?? '—'}</td>
              <td className="px-3 py-1.5">{v.chromosome ?? '—'}</td>
              <td className="px-3 py-1.5">{v.position ?? '—'}</td>
              <td className="max-w-20 truncate px-3 py-1.5">{v.ref ?? '—'}</td>
              <td className="max-w-20 truncate px-3 py-1.5">{v.alt ?? '—'}</td>
              <td className="px-3 py-1.5">{v.genotype ?? '—'}</td>
              <td className="px-3 py-1.5 font-sans">{v.zygosity ?? '—'}</td>
              <td className="px-3 py-1.5">{v.quality ?? '—'}</td>
              <td className="px-3 py-1.5">{v.filter ?? '—'}</td>
              <td className="px-3 py-1.5">
                <button type="button" className="text-rose-600" onClick={() => onRemove(v.id)} aria-label="Remove">
                  <Trash2 className="size-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {variants.length > shown.length && <p className="p-3 text-xs text-muted">…and {variants.length - shown.length} more (all will be analysed).</p>}
    </div>
  );
}

function ChromCard({ c, onRemove }: { c: ChromosomalObservation; onRemove: () => void }) {
  const cond = c.conditionKey ? CHROMOSOMAL_BY_KEY[c.conditionKey] : undefined;
  const label =
    c.result === 'normal' ? 'Normal result reported' : c.result === 'screen-negative' ? 'Low-risk screening result' : c.result === 'screen-positive' ? 'Positive screening result' : 'Abnormal result reported';
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-semibold text-ink">{c.raw}</p>
        <p className="text-sm text-muted">
          {label}
          {cond ? ` — ${cond.name}` : c.conditionKey === 'other' ? ' — structural change' : ''}
          {c.method ? ` · ${c.method}` : ''}
          {c.mosaic ? ' · mosaic' : ''}
        </p>
      </div>
      <button type="button" className="btn-ghost px-2.5 text-rose-600" onClick={onRemove} aria-label="Remove">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
