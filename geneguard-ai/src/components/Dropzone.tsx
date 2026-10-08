import { FileUp, Lock } from 'lucide-react';
import { useRef, useState } from 'react';
import { usePipeline } from '../state/pipeline';

export const ACCEPT_ALL = 'image/*,.pdf,application/pdf,.vcf,.vcf.gz,.gz,.txt,.csv,.tsv,text/plain';

export function Dropzone({ accept = ACCEPT_ALL, title, hint, compact = false }: { accept?: string; title?: string; hint?: string; compact?: boolean }) {
  const { runFile } = usePipeline();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void runFile(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed text-center transition ${
        over ? 'border-teal-500 bg-teal-500/10' : 'border-line bg-surface hover:border-teal-400 hover:bg-teal-500/5'
      } ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      aria-label="Upload a genetic report file"
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-500 text-white shadow-lg shadow-teal-500/25 transition group-hover:scale-105">
        <FileUp className="size-7" />
      </div>
      <div>
        <p className="font-semibold text-ink">{title ?? 'Drag & drop your genetic report here'}</p>
        <p className="mt-1 text-sm text-muted">{hint ?? 'Photo / screenshot (JPG, PNG), PDF, VCF, 23andMe-style raw data (TXT, CSV) — or click to choose'}</p>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Lock className="size-3.5" /> Read in your browser · nothing is uploaded until you confirm
      </p>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files)} onClick={(e) => ((e.target as HTMLInputElement).value = '')} />
    </div>
  );
}
