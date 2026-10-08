// Text recognition (OCR) in the browser with Tesseract.js. The engine, its
// WebAssembly core and the English language model ship with the app (vendor/…),
// so OCR needs no CDN and photos never leave the device.

import type { Worker } from 'tesseract.js';
import { EMBEDDED, absoluteUrl } from './env';

/**
 * In the embedded build the OCR language model ships as a script file
 * (vendor/tessdata/eng-traineddata.js, base64 inside) because classic scripts load from any
 * host without CORS. This worker prelude answers Tesseract's request for
 * "eng.traineddata.gz" from that script; the Tesseract worker code follows in the same blob.
 */
let shimUrl: string | undefined;
async function embeddedWorkerUrl(): Promise<string> {
  if (shimUrl) return shimUrl;
  // The Tesseract worker itself is bundled into the page; only its large WebAssembly core
  // and the language model are loaded as separate files, and only when OCR is used.
  const { default: workerCode } = await import('tesseract.js/dist/worker.min.js?raw');
  const langScript = absoluteUrl('vendor/tessdata/eng-traineddata.js');
  const code = `(() => {
    const realFetch = self.fetch.bind(self);
    self.fetch = async (input, init) => {
      const url = String(input && input.url ? input.url : input);
      if (!url.endsWith('.traineddata.gz')) return realFetch(input, init);
      if (!self.GG_ENG_TRAINEDDATA) importScripts(${JSON.stringify(langScript)});
      const bin = atob(self.GG_ENG_TRAINEDDATA);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, { status: 200 });
    };
  })();`;
  shimUrl = URL.createObjectURL(new Blob([code, '\n', workerCode], { type: 'text/javascript' }));
  return shimUrl;
}

export interface OcrResult {
  text: string;
  confidence: number; // 0–100
}

export interface OcrSession {
  recognize: (image: HTMLCanvasElement | Blob) => Promise<OcrResult>;
  terminate: () => Promise<void>;
}

export async function createOcrSession(onProgress?: (fraction: number) => void): Promise<OcrSession> {
  try {
    return await startOcr(onProgress);
  } catch (e) {
    console.error(e);
    throw new Error('Text recognition (OCR) could not start in this browser. Try another browser, use the PDF or VCF version of the report, or enter the values manually.');
  }
}

async function startOcr(onProgress?: (fraction: number) => void): Promise<OcrSession> {
  const { createWorker } = await import('tesseract.js');
  const worker: Worker = await createWorker('eng', 1, {
    workerPath: EMBEDDED ? await embeddedWorkerUrl() : absoluteUrl('vendor/tesseract/worker.min.js'),
    workerBlobURL: !EMBEDDED,
    corePath: absoluteUrl('vendor/tesseract-core'),
    langPath: absoluteUrl('vendor/tessdata'),
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  await worker.setParameters({ preserve_interword_spaces: '1' });
  return {
    recognize: async (image) => {
      const { data } = await worker.recognize(image);
      return { text: data.text ?? '', confidence: data.confidence ?? 0 };
    },
    terminate: async () => {
      await worker.terminate();
    },
  };
}

/** Decodes a photo (respecting EXIF rotation), scales it to an OCR-friendly size and boosts contrast. */
export async function prepareImage(file: Blob, maxSide = 2600): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This image format cannot be opened in the browser. Please use a JPG or PNG photo or a screenshot.');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const upscale = Math.max(bitmap.width, bitmap.height) < 1200 ? 2 : 1; // small screenshots read better enlarged
  const w = Math.round(bitmap.width * scale * upscale);
  const h = Math.round(bitmap.height * scale * upscale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  // Greyscale + mild contrast stretch
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * 1.25 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Downscaled JPEG data URL for the optional AI Vision request. */
export async function imageToDataUrl(file: Blob, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}
