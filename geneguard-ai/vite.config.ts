import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle lazily imported libraries so the first dev visit doesn't reload mid-analysis.
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react-router', 'lucide-react', 'tesseract.js', 'pdfjs-dist/legacy/build/pdf.mjs'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
});
