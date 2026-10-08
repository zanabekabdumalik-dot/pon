import type { ParsedInput } from '../../shared/types';
import { parseTextInput } from '../../shared/parsing';
import { EMBEDDED, NATIVE_APP, asset } from './env';
import { createOcrSession, prepareImage } from './ocr';
import { readPdf } from './pdf';

// Reads any supported file entirely in the browser and turns it into a
// reviewable list of extracted variants. Nothing is uploaded here.

export type FileKind = 'image' | 'pdf' | 'text' | 'gzip' | 'unsupported';

export interface ProgressUpdate {
  step: 'read' | 'ocr' | 'extract';
  message: string;
  progress?: number; // 0–1 for OCR
}

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|gif)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;
const TEXT_EXT = /\.(vcf|txt|csv|tsv|tab|text|md)$/i;

export function fileKind(file: File): FileKind {
  if (HEIC_EXT.test(file.name) || /heic|heif/.test(file.type)) return 'unsupported';
  if (file.type.startsWith('image/') || IMAGE_EXT.test(file.name)) return 'image';
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (/\.gz$/i.test(file.name) || file.type === 'application/gzip') return 'gzip';
  if (file.type.startsWith('text/') || TEXT_EXT.test(file.name) || file.type === '') return 'text';
  return 'unsupported';
}

const MB = 1024 * 1024;

async function gunzipToText(file: Blob): Promise<string> {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .gz files. Please decompress the file first.');
  const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function looksBinary(text: string): boolean {
  const sample = text.slice(0, 4000);
  const weird = sample.replace(/[\x09\x0A\x0D\x20-\x7E -￿]/g, '').length;
  return weird > sample.length * 0.05;
}

export async function processFile(file: File, onProgress: (u: ProgressUpdate) => void): Promise<ParsedInput> {
  const kind = fileKind(file);
  if (kind === 'unsupported') {
    throw new Error(
      HEIC_EXT.test(file.name)
        ? 'HEIC photos cannot be read in most browsers. Please export the photo as JPG/PNG or take a screenshot.'
        : 'Unsupported file type. Please upload a photo (JPG/PNG), a PDF, a VCF file or a text file.',
    );
  }

  if (kind === 'image') {
    if (file.size > 25 * MB) throw new Error('The image is larger than 25 MB.');
    onProgress({ step: 'read', message: 'Preparing image…' });
    const canvas = await prepareImage(file);
    onProgress({ step: 'ocr', message: 'Recognising text (OCR)…', progress: 0 });
    const session = await createOcrSession((p) => onProgress({ step: 'ocr', message: 'Recognising text (OCR)…', progress: p }));
    try {
      const res = await session.recognize(canvas);
      onProgress({ step: 'extract', message: 'Looking for genetic variants…' });
      return parseTextInput(res.text, { kind: 'photo', fileName: file.name, ocrConfidence: res.confidence, ocrEngine: NATIVE_APP ? 'Tesseract.js (on this device)' : 'Tesseract.js (in your browser)' });
    } finally {
      await session.terminate();
    }
  }

  if (kind === 'pdf') {
    if (file.size > 50 * MB) throw new Error('The PDF is larger than 50 MB.');
    onProgress({ step: 'read', message: 'Reading PDF…' });
    const pdf = await readPdf(file, (stage, p) =>
      onProgress(stage === 'ocr' ? { step: 'ocr', message: 'Scanned pages found — recognising text (OCR)…', progress: p } : { step: 'read', message: 'Extracting PDF text…' }),
    );
    onProgress({ step: 'extract', message: 'Looking for genetic variants…' });
    const parsed = parseTextInput(pdf.text, {
      kind: 'pdf',
      fileName: file.name,
      ocrConfidence: pdf.ocrPages ? pdf.ocrConfidence : undefined,
      ocrEngine: pdf.ocrPages ? `Tesseract.js OCR on ${pdf.ocrPages} of ${pdf.pages} page(s)` : undefined,
    });
    if (parsed.kind === 'pdf' && pdf.pages > 1)
      parsed.warnings.push({ code: 'info', message: `${pdf.pages} PDF pages were read${pdf.ocrPages ? `, ${pdf.ocrPages} of them with OCR` : ''}.` });
    return parsed;
  }

  if (file.size > 300 * MB) throw new Error('The file is larger than 300 MB. Please filter it to the variants of interest first.');
  onProgress({ step: 'read', message: kind === 'gzip' ? 'Decompressing file…' : 'Reading file…' });
  const text = kind === 'gzip' ? await gunzipToText(file) : await file.text();
  if (looksBinary(text)) throw new Error('This file does not look like a text, VCF or genotype file.');
  onProgress({ step: 'extract', message: 'Parsing genetic data…' });
  await new Promise((r) => setTimeout(r, 0));
  return parseTextInput(text, { kind: 'text', fileName: file.name });
}

/** Loads one of the bundled sample files as if the user had picked it. */
export async function sampleFile(path: string, name: string, type: string): Promise<File> {
  if (EMBEDDED) {
    const data = (await embeddedSamples())[name];
    if (!data) throw new Error('Sample file not found.');
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type });
  }
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new Error('The sample file could not be loaded here. You can still upload your own file or run the demo.');
  }
  if (!res.ok) throw new Error('Sample file not found. Run "npm run samples" to generate the sample files.');
  return new File([await res.blob()], name, { type });
}

/**
 * The embedded build ships its samples as one script (samples/samples.js) because a classic
 * <script> loads from any host without CORS, unlike fetch().
 */
let samplesPromise: Promise<Record<string, string>> | undefined;
function embeddedSamples(): Promise<Record<string, string>> {
  const w = window as unknown as { GG_SAMPLES?: Record<string, string> };
  samplesPromise ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = asset('samples/samples.js');
    el.onload = () => (w.GG_SAMPLES ? resolve(w.GG_SAMPLES) : reject(new Error('Sample data is missing.')));
    el.onerror = () => {
      samplesPromise = undefined;
      reject(new Error('The sample files could not be loaded here. You can still upload your own file or run the demo.'));
    };
    document.head.appendChild(el);
  });
  return samplesPromise;
}
