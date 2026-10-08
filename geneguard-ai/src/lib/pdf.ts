// PDF reading in the browser with pdf.js: the text layer is used when present;
// scanned pages (images only) are rendered to a canvas and passed to OCR.

import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { EMBEDDED } from './env';
import { createOcrSession } from './ocr';

/** The embedded build carries the pdf.js worker inside the page and starts it from a blob: URL. */
let embeddedWorkerSrc: string | undefined;
async function workerSrc(): Promise<string> {
  if (!EMBEDDED) return workerUrl;
  if (!embeddedWorkerSrc) {
    const { default: code } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw');
    embeddedWorkerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  return embeddedWorkerSrc;
}

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
}

export interface PdfReadResult {
  text: string;
  pages: number;
  ocrPages: number;
  ocrConfidence?: number;
}

function itemsToText(items: TextItemLike[]): string {
  const rows = new Map<number, TextItemLike[]>();
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5] / 3) * 3; // tolerate tiny baseline differences
    rows.set(y, [...(rows.get(y) ?? []), it]);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => {
      row.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = '';
      let end = -Infinity;
      for (const it of row) {
        const x = it.transform[4];
        const gap = x - end;
        if (line) line += gap > 12 ? '   ' : gap > 1.5 ? ' ' : '';
        line += it.str;
        end = x + it.width;
      }
      return line.trimEnd();
    })
    .join('\n');
}

export async function readPdf(file: Blob, onStage: (stage: 'text' | 'ocr', progress?: number) => void): Promise<PdfReadResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = await workerSrc();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const scanned: number[] = [];
  onStage('text');
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = itemsToText(content.items.filter((i): i is TextItemLike & typeof i => 'str' in i) as TextItemLike[]);
    pages.push(text);
    if (text.replace(/\s/g, '').length < 40) scanned.push(n);
  }

  let confidence: number | undefined;
  if (scanned.length) {
    const session = await createOcrSession((p) => onStage('ocr', p));
    const scores: number[] = [];
    try {
      for (const [k, n] of scanned.entries()) {
        onStage('ocr', k / scanned.length);
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: 2.2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        const res = await session.recognize(canvas);
        pages[n - 1] = res.text;
        scores.push(res.confidence);
      }
    } finally {
      await session.terminate();
    }
    confidence = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  const numPages = doc.numPages;
  await doc.destroy();
  return { text: pages.join('\n\n'), pages: numPages, ocrPages: scanned.length, ocrConfidence: confidence };
}
