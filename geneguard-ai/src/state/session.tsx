import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AnalysisReport, ChatReply, ParsedInput, ServerStatus } from '../../shared/types';
import { api } from '../lib/api';

// All session data lives only in memory (React state). Nothing is written to
// localStorage, cookies or a database; refreshing or closing the tab erases it.

export interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
  engine?: ChatReply['engine'];
  note?: string;
  sources?: ChatReply['sources'];
}

export interface UploadedFileInfo {
  name: string;
  size: number;
  type: string;
  file?: File; // kept in memory only for the optional AI Vision re-read
}

/**
 * "server": the GeneGuard API is reachable (AI and ClinVar may be available).
 * "browser": no API at this address (static hosting, embedded page, server stopped) —
 * everything runs on this device with the built-in engine.
 */
export type RunMode = 'checking' | 'server' | 'browser';

interface SessionState {
  status: ServerStatus | null;
  mode: RunMode;
  uploaded: UploadedFileInfo | null;
  parsed: ParsedInput | null;
  report: AnalysisReport | null;
  chat: ChatEntry[];
  consentAi: boolean;
  consentClinvar: boolean;
}

interface SessionApi extends SessionState {
  setUploaded: (u: UploadedFileInfo | null) => void;
  setParsed: (p: ParsedInput | null) => void;
  setReport: (r: AnalysisReport | null) => void;
  setChat: (c: ChatEntry[] | ((prev: ChatEntry[]) => ChatEntry[])) => void;
  setConsentAi: (v: boolean) => void;
  setConsentClinvar: (v: boolean) => void;
  removeFile: () => void;
  clearAll: () => void;
  aiAvailable: boolean;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [mode, setMode] = useState<RunMode>('checking');
  const [uploaded, setUploaded] = useState<UploadedFileInfo | null>(null);
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [consentAi, setConsentAi] = useState(false);
  const [consentClinvar, setConsentClinvar] = useState(false);

  useEffect(() => {
    api
      .health()
      .then((s) => {
        setStatus(s);
        setMode('server');
      })
      .catch(() => setMode('browser'));
  }, []);

  const removeFile = useCallback(() => {
    setUploaded(null);
    setParsed((p) => (p ? { ...p, rawText: undefined } : p));
  }, []);

  const clearAll = useCallback(() => {
    setUploaded(null);
    setParsed(null);
    setReport(null);
    setChat([]);
    setConsentAi(false);
    setConsentClinvar(false);
  }, []);

  const value = useMemo<SessionApi>(
    () => ({
      status,
      mode,
      uploaded,
      parsed,
      report,
      chat,
      consentAi,
      consentClinvar,
      setUploaded,
      setParsed,
      setReport,
      setChat,
      setConsentAi,
      setConsentClinvar,
      removeFile,
      clearAll,
      aiAvailable: mode === 'server' && Boolean(status?.ai.enabled),
    }),
    [status, mode, uploaded, parsed, report, chat, consentAi, consentClinvar, removeFile, clearAll],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
