import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { ExtractedVariant, ParsedInput, Zygosity } from '../../shared/types';
import { GENES } from '../../shared/knowledge/genes';
import { makeId, normalizeGene, normalizeGenotype, normalizeHgvsC, normalizeRsId } from '../../shared/parsing';
import { variantIsIncomplete } from '../../shared/parsing';
import { MESSAGES } from '../../shared/messages';
import { usePipeline } from '../state/pipeline';

interface Row {
  key: string;
  gene: string;
  variant: string;
  rsId: string;
  genotype: string;
  zygosity: '' | Zygosity;
  classification: string;
  condition: string;
}

const empty = (): Row => ({ key: makeId('row'), gene: '', variant: '', rsId: '', genotype: '', zygosity: '', classification: '', condition: '' });

const EXAMPLES: Omit<Row, 'key'>[] = [
  { gene: 'CFTR', variant: 'F508del', rsId: 'rs113993960', genotype: '', zygosity: 'heterozygous', classification: 'Pathogenic', condition: 'Cystic fibrosis' },
  { gene: 'TCF7L2', variant: '', rsId: 'rs7903146', genotype: 'C/T', zygosity: '', classification: '', condition: '' },
  { gene: 'HBB', variant: 'c.20A>T', rsId: 'rs334', genotype: '', zygosity: 'heterozygous', classification: 'Pathogenic', condition: 'Sickle cell disease' },
];

function toVariant(r: Row): ExtractedVariant {
  const v = r.variant.trim();
  return {
    id: makeId('man'),
    gene: normalizeGene(r.gene),
    hgvsC: /^c\./i.test(v) ? normalizeHgvsC(v) : undefined,
    hgvsP: /^p\./i.test(v) ? v : undefined,
    legacyName: v && !/^[cp]\./i.test(v) ? v : undefined,
    rsId: normalizeRsId(r.rsId),
    genotype: normalizeGenotype(r.genotype),
    zygosity: r.zygosity || undefined,
    reportedSignificance: r.classification || undefined,
    reportedCondition: r.condition.trim() || undefined,
    source: 'manual',
    sourceText: [r.gene, r.variant, r.rsId, r.genotype, r.zygosity, r.classification].filter(Boolean).join(' '),
  };
}

export function ManualEntry() {
  const { runManual, runText } = usePipeline();
  const [rows, setRows] = useState<Row[]>([empty()]);
  const [text, setText] = useState('');
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.gene.trim() || r.rsId.trim() || r.variant.trim());

  const submit = () => {
    const variants = filled.map(toVariant);
    const incomplete = variants.filter(variantIsIncomplete);
    const input: ParsedInput = {
      kind: 'manual',
      dataScope: 'manual',
      fileName: 'Manual entry',
      variants,
      chromosomal: [],
      warnings: incomplete.length ? [{ code: 'insufficient', message: `${MESSAGES.insufficient} ${incomplete.length} entry(ies) lack the exact variant or genotype/zygosity.` }] : [],
      stats: { totalRecords: variants.length, keptRecords: variants.length, skippedLines: 0 },
    };
    runManual(input);
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">Enter variants</h3>
            <p className="text-sm text-muted">Copy the values exactly as they appear in your report. Leave unknown fields empty — they will never be guessed.</p>
          </div>
          <button type="button" className="btn-ghost text-xs" onClick={() => setRows(EXAMPLES.map((e) => ({ ...e, key: makeId('row') })))}>
            <Wand2 className="size-4" /> Fill with example values
          </button>
        </div>
        <datalist id="gg-genes">
          {Object.keys(GENES).map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.key} className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1fr_0.8fr_1fr_1.1fr_auto]">
              <label>
                <span className="label">Gene</span>
                <input className="input" list="gg-genes" value={r.gene} placeholder="e.g. BRCA1" onChange={(e) => update(r.key, { gene: e.target.value })} />
              </label>
              <label>
                <span className="label">Variant</span>
                <input className="input" value={r.variant} placeholder="c.5266dupC / F508del" onChange={(e) => update(r.key, { variant: e.target.value })} />
              </label>
              <label>
                <span className="label">rsID</span>
                <input className="input" value={r.rsId} placeholder="rs80357906" onChange={(e) => update(r.key, { rsId: e.target.value })} />
              </label>
              <label>
                <span className="label">Genotype</span>
                <input className="input" value={r.genotype} placeholder="C/T" onChange={(e) => update(r.key, { genotype: e.target.value })} />
              </label>
              <label>
                <span className="label">Zygosity</span>
                <select className="input" value={r.zygosity} onChange={(e) => update(r.key, { zygosity: e.target.value as Row['zygosity'] })}>
                  <option value="">Not provided</option>
                  <option value="heterozygous">Heterozygous (1 copy)</option>
                  <option value="homozygous">Homozygous (2 copies)</option>
                  <option value="hemizygous">Hemizygous</option>
                </select>
              </label>
              <label>
                <span className="label">Classification</span>
                <select className="input" value={r.classification} onChange={(e) => update(r.key, { classification: e.target.value })}>
                  <option value="">Not provided</option>
                  <option>Pathogenic</option>
                  <option>Likely pathogenic</option>
                  <option>Uncertain significance</option>
                  <option>Likely benign</option>
                  <option>Benign</option>
                  <option>Risk factor</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-ghost w-full px-2.5 text-rose-600"
                  aria-label={`Remove row ${i + 1}`}
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [empty()]))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, empty()])}>
            <Plus className="size-4" /> Add variant
          </button>
          <button type="button" className="btn-primary" disabled={!filled.length} onClick={submit}>
            Review {filled.length || ''} variant{filled.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink">…or paste the text of a report</h3>
        <p className="text-sm text-muted">GeneGuard will extract genes, variants, rsIDs, genotypes, karyotypes and classifications from the text.</p>
        <textarea
          className="input mt-3 min-h-36 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Gene: BRCA1   Variant: c.5266dupC   rsID: rs80357906\nZygosity: Heterozygous   Classification: Pathogenic'}
        />
        <button type="button" className="btn-primary mt-3" disabled={!text.trim()} onClick={() => void runText(text, 'text', 'Pasted text')}>
          Extract variants
        </button>
      </div>
    </div>
  );
}
