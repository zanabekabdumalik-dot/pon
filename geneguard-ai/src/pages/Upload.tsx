import { Camera, CirclePlay, FileImage, FileScan, FileText, FileUp, Keyboard, Lock, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DEMO_PROFILES } from '../../shared/demo';
import { SYNTHETIC_NOTICE } from '../../shared/messages';
import { Dropzone } from '../components/Dropzone';
import { ManualEntry } from '../components/ManualEntry';
import { Callout, PageHeader } from '../components/ui';
import { EMBEDDED, asset } from '../lib/env';
import { sampleFile } from '../lib/files';
import { usePipeline } from '../state/pipeline';
import { useSession } from '../state/session';

const MODES = [
  { key: 'file', label: 'Any file', icon: FileUp },
  { key: 'photo', label: 'Photo', icon: Camera },
  { key: 'pdf', label: 'PDF', icon: FileText },
  { key: 'manual', label: 'Manual entry', icon: Keyboard },
  { key: 'demo', label: 'Demo & samples', icon: CirclePlay },
] as const;

type Mode = (typeof MODES)[number]['key'];

export const SAMPLES = [
  { path: asset('samples/sample-lab-report.png'), name: 'sample-lab-report.png', type: 'image/png', title: 'Lab report photo', text: 'Full synthetic panel report — real OCR runs in your browser', icon: FileImage },
  { path: asset('samples/sample-partial-screenshot.png'), name: 'sample-partial-screenshot.png', type: 'image/png', title: 'Partial screenshot', text: 'Shows the “only partial information” warning', icon: FileImage },
  { path: asset('samples/sample-lab-report.pdf'), name: 'sample-lab-report.pdf', type: 'application/pdf', title: 'Digital PDF report', text: 'Text layer extracted with pdf.js', icon: FileText },
  { path: asset('samples/sample-scanned-report.pdf'), name: 'sample-scanned-report.pdf', type: 'application/pdf', title: 'Scanned PDF', text: 'Image-only PDF — OCR is applied page by page', icon: FileScan },
  { path: asset('samples/sample-karyotype-report.png'), name: 'sample-karyotype-report.png', type: 'image/png', title: 'Chromosome report photo', text: 'Karyotype 47,XY,+21 (chromosomal category)', icon: FileImage },
  { path: asset('samples/sample-variants.vcf'), name: 'sample-variants.vcf', type: 'text/plain', title: 'VCF file', text: 'Includes a low-quality call and an invalid line', icon: FileText },
  { path: asset('samples/sample-raw-data.txt'), name: 'sample-raw-data.txt', type: 'text/plain', title: 'Raw genotype data', text: '23andMe-style rsID / genotype file', icon: FileText },
  { path: asset('samples/not-genetic-photo.png'), name: 'not-genetic-photo.png', type: 'image/png', title: 'Non-genetic photo', text: 'Shows “Unable to identify genetic information”', icon: FileImage },
];

export function UploadPage() {
  const [params, setParams] = useSearchParams();
  const mode = (MODES.some((m) => m.key === params.get('mode')) ? params.get('mode') : 'file') as Mode;
  const { runFile, runAnalysis } = usePipeline();
  const { aiAvailable } = useSession();
  const camera = useRef<HTMLInputElement>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  const loadSample = async (s: (typeof SAMPLES)[number]) => {
    setSampleError(null);
    try {
      await runFile(await sampleFile(s.path, s.name, s.type));
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : 'Could not load the sample.');
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Step 1" title="Upload genetic data">
        Choose how to provide your genetic result. Files are read in your browser; you will review everything GeneGuard extracts before anything is analysed.
      </PageHeader>

      <div className="no-print mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1" role="tablist">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setParams({ mode: key })}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${mode === key ? 'bg-nav text-white shadow' : 'text-ink-2 hover:bg-surface-2'}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === 'file' && (
        <div className="space-y-4">
          <Dropzone />
          <FormatTable />
        </div>
      )}

      {mode === 'photo' && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <Dropzone accept="image/*" title="Drop a photo or screenshot of your report" hint="JPG, PNG or WEBP. Text is recognised with OCR directly in your browser." />
            <button type="button" className="btn-secondary w-full sm:hidden" onClick={() => camera.current?.click()}>
              <Camera className="size-4" /> Take a photo with the camera
            </button>
            <input
              ref={camera}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runFile(f);
              }}
            />
          </div>
          <div className="card p-5 text-sm">
            <h3 className="font-semibold text-ink">Tips for a readable photo</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
              <li>Lay the page flat in good, even light — avoid shadows and glare.</li>
              <li>Fill the frame with the results table; keep the text sharp.</li>
              <li>A screenshot of a digital report works best.</li>
              <li>You can correct every recognised field before the analysis.</li>
            </ul>
            {aiAvailable && (
              <p className="mt-3 flex gap-2 rounded-lg bg-indigo-500/10 p-3 text-xs text-indigo-900 dark:text-indigo-200">
                <Sparkles className="size-4 shrink-0" /> For hard-to-read photos you can optionally re-read the image with Claude Vision on the review screen.
              </p>
            )}
          </div>
        </div>
      )}

      {mode === 'pdf' && (
        <div className="space-y-4">
          <Dropzone accept=".pdf,application/pdf" title="Drop a PDF genetic report" hint="Digital PDFs are read from their text layer; scanned pages are recognised with OCR." />
          <Callout tone="info" title="Laboratory reports keep their context">
            Each variant keeps the lines it was found in (gene, variant, zygosity, classification, condition, interpretation) so you can verify it on the review screen.
          </Callout>
        </div>
      )}

      {mode === 'manual' && <ManualEntry />}

      {mode === 'demo' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-ink">Demo profiles</h2>
            <Callout tone="warning" className="mt-2">
              {SYNTHETIC_NOTICE}
            </Callout>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {DEMO_PROFILES.map((d) => (
                <div key={d.key} className="card flex flex-col p-5">
                  <p className="text-xs font-bold tracking-wide text-teal-600 uppercase dark:text-teal-400">Synthetic</p>
                  <h3 className="mt-1 font-semibold text-ink">{d.title}</h3>
                  <p className="text-sm text-muted">{d.subtitle}</p>
                  <ul className="mt-3 flex-1 space-y-1 text-sm text-ink-2">
                    {d.highlights.map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                  <button type="button" className="btn-primary mt-4" onClick={() => void runAnalysis(d.build(), { demo: true })}>
                    <CirclePlay className="size-4" /> Run demo
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-ink">Sample files — run the real pipeline</h2>
            <p className="mt-1 text-sm text-muted">These synthetic documents go through the same OCR, parsing and review steps as your own files.</p>
            {sampleError && (
              <Callout tone="danger" className="mt-3">
                {sampleError}
              </Callout>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLES.map((s) => (
                <div key={s.path} className="card flex flex-col gap-2 p-4">
                  <s.icon className="size-6 text-teal-600 dark:text-teal-400" />
                  <p className="font-semibold text-ink">{s.title}</p>
                  <p className="flex-1 text-xs text-muted">{s.text}</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary flex-1 py-2 text-xs" onClick={() => void loadSample(s)}>
                      Analyze
                    </button>
                    {!EMBEDDED && (
                      <a className="btn-ghost py-2 text-xs" href={s.path} download>
                        Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <p className="mt-8 flex items-center gap-2 text-xs text-muted">
        <Lock className="size-3.5" /> GeneGuard keeps data only in this browser tab. See the Privacy page for details.
      </p>
    </div>
  );
}

function FormatTable() {
  const rows = [
    ['Photo / screenshot', 'JPG, PNG, WEBP', 'OCR in the browser (Tesseract.js); optional Claude Vision'],
    ['PDF report', 'PDF (digital or scanned)', 'Text layer via pdf.js; OCR for scanned pages'],
    ['VCF', '.vcf, .vcf.gz', 'CHROM, POS, ID/rsID, REF, ALT, QUAL, FILTER, INFO, GT'],
    ['Raw genotype data', '.txt, .csv (23andMe / AncestryDNA style)', 'rsID, chromosome, position, genotype'],
    ['Report text', '.txt or pasted text', 'Genes, HGVS variants, rsIDs, zygosity, classifications, karyotypes'],
  ];
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
          <tr>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Formats</th>
            <th className="px-4 py-3">What is read</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-medium text-ink">{r[0]}</td>
              <td className="px-4 py-3 text-ink-2">{r[1]}</td>
              <td className="px-4 py-3 text-muted">{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
