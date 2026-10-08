// Text recognition (OCR) in the browser with Tesseract.js. The engine, its
// WebAssembly core and the English language model are served by our own server
// (/vendor/...), so photos never leave the device during OCR.

import type { Worker } from 'tesseract.js';

const abs = (p: string) => new URL(p, window.location.origin).href;

export interface OcrResult {
  text: string;
  confidence: number; // 0–100
}

export interface OcrSession {
  recognize: (image: HTMLCanvasElement | Blob) => Promise<OcrResult>;
  terminate: () => Promise<void>;
}

export async function createOcrSession(onProgress?: (fraction: number) => void): Promise<OcrSession> {
  const { createWorker } = await import('tesseract.js');
  const worker: Worker = await createWorker('eng', 1, {
    workerPath: abs('/vendor/tesseract/worker.min.js'),
    corePath: abs('/vendor/tesseract-core'),
    langPath: abs('/vendor/tessdata'),
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
