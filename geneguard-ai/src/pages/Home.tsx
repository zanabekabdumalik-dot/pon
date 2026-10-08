import { ArrowRight, Camera, CirclePlay, Dna, FileText, FileUp, Keyboard, Layers, Network, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { CLINICAL_CONTEXT, DISCLAIMER, MESSAGES } from '../../shared/messages';
import { demoProfile } from '../../shared/demo';
import { DnaHelix } from '../components/DnaHelix';
import { Dropzone } from '../components/Dropzone';
import { PIPELINE_STEPS } from '../components/PipelineLoader';
import { usePipeline } from '../state/pipeline';

const ACTIONS = [
  { to: '/upload?mode=file', icon: FileUp, title: 'Upload genetic report', text: 'VCF, raw-data TXT/CSV or any report file' },
  { to: '/upload?mode=photo', icon: Camera, title: 'Upload photo', text: 'Photo or screenshot of a lab report — read with OCR' },
  { to: '/upload?mode=pdf', icon: FileText, title: 'Upload PDF', text: 'Digital or scanned laboratory PDF' },
  { to: '/upload?mode=manual', icon: Keyboard, title: 'Enter genetic data manually', text: 'Type genes, variants and genotypes' },
];

const CATEGORIES = [
  {
    icon: Layers,
    title: 'Chromosomal',
    text: 'Changes in the number or structure of whole chromosomes, such as trisomy 21. Needs a karyotype, microarray or screening report — a SNP list cannot rule them out.',
  },
  {
    icon: Dna,
    title: 'Monogenic',
    text: 'Conditions mainly linked to one gene — CFTR (cystic fibrosis), HBB (sickle cell), FBN1 (Marfan), LDLR (familial hypercholesterolemia), BRCA1/BRCA2 (hereditary cancer susceptibility).',
  },
  {
    icon: Network,
    title: 'Multifactorial',
    text: 'Common conditions shaped by many variants plus lifestyle and environment — type 2 diabetes, hypertension, coronary artery disease, obesity-related risk.',
  },
];

export function HomePage() {
  const { runAnalysis } = usePipeline();
  const startDemo = () => void runAnalysis(demoProfile('anna')!.build(), { demo: true });

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-nav px-6 py-10 text-white shadow-2xl sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(45,212,191,0.28),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(129,140,248,0.3),transparent_45%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="max-w-2xl animate-fade-up">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-teal-100">
              <Sparkles className="size-3.5" /> AI × Genetics · School science project
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              GeneGuard{' '}
              <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">AI</span>
            </h1>
            <p className="mt-3 text-xl font-medium text-teal-50 sm:text-2xl">Understand your genes. Understand your risks.</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Upload a genetic test result and GeneGuard explains it in plain language: what each variant is linked to, how strong the evidence is, what is
              and isn’t known — and what you can do. An estimate of risk, never a diagnosis.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={startDemo} className="btn-primary px-5 py-3 text-base">
                <CirclePlay className="size-5" /> Try Demo
              </button>
              <Link to="/upload" className="btn border border-white/20 bg-white/10 px-5 py-3 text-base text-white hover:bg-white/15">
                <FileUp className="size-5" /> Upload genetic report
              </Link>
            </div>
          </div>
          <div className="hidden justify-center text-teal-200 md:flex">
            <div className="animate-float">
              <DnaHelix className="h-80 w-auto drop-shadow-[0_0_30px_rgba(45,212,191,0.35)]" rungs={16} height={360} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Dropzone />
        <div className="grid gap-3 sm:grid-cols-2">
          {ACTIONS.map(({ to, icon: Icon, title, text }) => (
            <Link key={title} to={to} className="card group flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:border-teal-400">
              <Icon className="size-6 text-teal-600 dark:text-teal-400" />
              <span className="font-semibold text-ink">{title}</span>
              <span className="text-sm text-muted">{text}</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={startDemo}
            className="group flex flex-col gap-2 rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 p-4 text-left text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 sm:col-span-2"
          >
            <span className="flex items-center gap-2 font-semibold">
              <CirclePlay className="size-6" /> Try demo analysis
              <ArrowRight className="ml-auto size-5 transition group-hover:translate-x-1" />
            </span>
            <span className="text-sm text-white/85">Synthetic profile: BRCA1, CFTR and APOE demonstration variants plus common risk SNPs. No real person’s data.</span>
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink">How GeneGuard works</h2>
        <p className="mt-1 text-sm text-muted">From your document to a report you can understand — every step is shown while it runs.</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE_STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-4">
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-1 text-sm font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-xs text-muted">{s.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-bold text-ink">Three kinds of genetic risk</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {CATEGORIES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-semibold text-ink">{title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
          <p className="text-xs font-bold tracking-[0.18em] uppercase opacity-80">Key idea</p>
          <p className="mt-2 text-2xl font-extrabold">{MESSAGES.predispositionNotDestiny}</p>
          <p className="mt-2 text-sm text-white/85">Genes can raise or lower the chance of a condition. Lifestyle, environment and medical monitoring matter too.</p>
        </div>
        <div className="card flex gap-4 p-6">
          <ShieldCheck className="size-8 shrink-0 text-amber-500" />
          <div className="space-y-2 text-sm leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">{DISCLAIMER}</p>
            <p>{CLINICAL_CONTEXT}</p>
            <Link to="/privacy" className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400">
              How your data is handled <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
