import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { ParsedInput } from '../../shared/types';
import { analyze } from '../../shared/engine/analyze';
import { parseTextInput } from '../../shared/parsing';
import { api, ApiUnavailable } from '../lib/api';
import { processFile } from '../lib/files';
import { imageToDataUrl } from '../lib/ocr';
import { PipelineLoader, type PipelineView } from '../components/PipelineLoader';
import { useSession } from './session';

// Orchestrates the visible pipeline: parsing happens in the browser (steps 1–4),
// the user reviews the extracted data, then interpretation runs on the server (steps 5–10).

interface PipelineApi {
  runFile: (file: File) => Promise<void>;
  runText: (text: string, kind: ParsedInput['kind'], fileName?: string) => Promise<void>;
  runManual: (input: ParsedInput) => void;
  runAnalysis: (input: ParsedInput, opts?: { demo?: boolean }) => Promise<void>;
  runVision: (file: File) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const Ctx = createContext<PipelineApi | null>(null);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PipelineProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useSession();
  const [view, setView] = useState<PipelineView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const finishParse = useCallback(
    (parsed: ParsedInput) => {
      session.setParsed(parsed);
      session.setReport(null);
      setView(null);
      navigate('/review');
    },
    [navigate, session],
  );

  const runFile = useCallback(
    async (file: File) => {
      setError(null);
      session.setUploaded({ name: file.name, size: file.size, type: file.type, file });
      setView({ active: 1, detail: `Reading “${file.name}”…`, title: 'Reading your genetic report...' });
      try {
        await pause(300);
        const parsed = await processFile(file, (u) => {
          const active = u.step === 'read' ? 1 : u.step === 'ocr' ? 2 : 3;
          setView({ active, detail: u.progress !== undefined ? `${u.message} ${Math.round(u.progress * 100)}%` : u.message, progress: u.progress, title: 'Reading your genetic report...' });
        });
        setView({ active: 3, detail: `${parsed.variants.length} variant(s) found — opening review…`, title: 'Reading your genetic report...' });
        await pause(450);
        finishParse(parsed);
      } catch (e) {
        setView(null);
        setError(e instanceof Error ? e.message : 'The file could not be read.');
      }
    },
    [finishParse, session],
  );

  const runText = useCallback(
    async (text: string, kind: ParsedInput['kind'], fileName?: string) => {
      setError(null);
      setView({ active: 2, detail: 'Parsing text…', title: 'Reading your genetic data...' });
      await pause(350);
      setView({ active: 3, detail: 'Looking for genetic variants…', title: 'Reading your genetic data...' });
      await pause(350);
      finishParse(parseTextInput(text, { kind, fileName }));
    },
    [finishParse],
  );

  const runManual = useCallback((input: ParsedInput) => finishParse(input), [finishParse]);

  const runVision = useCallback(
    async (file: File) => {
      setError(null);
      setView({ active: 2, detail: 'Sending the image to Claude Vision for transcription…', title: 'AI Vision OCR' });
      try {
        const { text, model } = await api.vision(await imageToDataUrl(file));
        setView({ active: 3, detail: 'Looking for genetic variants…', title: 'AI Vision OCR' });
        await pause(300);
        finishParse(parseTextInput(text, { kind: 'photo', fileName: file.name, ocrEngine: `AI Vision (${model})` }));
      } catch (e) {
        setView(null);
        setError(e instanceof Error ? e.message : 'AI Vision failed.');
      }
    },
    [finishParse],
  );

  const runAnalysis = useCallback(
    async (input: ParsedInput, opts: { demo?: boolean } = {}) => {
      setError(null);
      const useAI = session.aiAvailable && (session.consentAi || Boolean(opts.demo));
      const clinvar = Boolean(session.status?.clinvarLookup && session.consentClinvar && !opts.demo);
      const step = async (active: number, detail: string, ms = 420) => {
        setView({ active, detail });
        await pause(ms);
      };
      try {
        if (opts.demo) {
          session.setUploaded(null);
          session.setParsed(input);
          await step(0, 'Loading synthetic demonstration profile…', 380);
          await step(1, 'No file needed — synthetic data', 260);
          await step(2, 'Structured demo data (no OCR needed)', 260);
          await step(3, `${input.variants.length} demonstration variants`, 320);
        }
        // Without a reachable server the same rule engine runs right here in the browser.
        const local = (note: string) => {
          const report = analyze(input);
          report.ai.note = note;
          return { report };
        };
        const request =
          session.mode === 'server'
            ? api.analyze(input, { useAI, clinvar }).catch((e) => {
                if (e instanceof ApiUnavailable) return local('The GeneGuard server could not be reached, so the analysis ran in your browser with the built-in engine.');
                throw e;
              })
            : Promise.resolve(local('Browser mode: the analysis ran entirely on this device with the built-in engine (no server, no external AI).'));
        await step(4, 'Checking formats, alleles and data quality…');
        await step(5, clinvar ? 'Matching the knowledge base and looking up ClinVar…' : 'Matching the curated knowledge base…');
        setView({ active: 6, detail: useAI ? 'Claude is writing plain-language explanations…' : 'Built-in interpreter (no external AI used)…' });
        const [{ report }] = await Promise.all([request, pause(500)]);
        await step(7, 'Assigning risk categories and confidence…');
        await step(8, 'Selecting safe, general recommendations…');
        await step(9, 'Building your report…', 380);
        session.setReport(report);
        session.setChat([]);
        setView(null);
        navigate('/analysis');
      } catch (e) {
        setView(null);
        setError(e instanceof Error ? e.message : 'The analysis failed.');
      }
    },
    [navigate, session],
  );

  return (
    <Ctx.Provider value={{ runFile, runText, runManual, runAnalysis, runVision, error, clearError: () => setError(null) }}>
      {children}
      {view && <PipelineLoader view={view} />}
    </Ctx.Provider>
  );
}

export function usePipeline(): PipelineApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePipeline must be used inside PipelineProvider');
  return ctx;
}
