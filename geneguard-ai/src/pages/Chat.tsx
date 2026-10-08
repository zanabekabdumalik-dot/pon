import { Bot, Loader2, Send, Trash2, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { answerLocally } from '../../shared/chat';
import { MESSAGES } from '../../shared/messages';
import { Callout, PageHeader, RichText, SourceLinks, Toggle } from '../components/ui';
import { api, ApiUnavailable } from '../lib/api';
import { useSession, type ChatEntry } from '../state/session';

const SUGGESTED = [
  'What does this gene mean?',
  'Does this variant mean I have the disease?',
  'What can I do to reduce my risk?',
  'Should I talk to a doctor?',
  'What is a polygenic risk score?',
  'Can I pass this on to my children?',
];

export function ChatPage() {
  const { report, chat, setChat, aiAvailable, consentAi, setConsentAi, status, mode } = useSession();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const useAI = aiAvailable && consentAi;

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [chat.length, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    // "this gene" refers to the most significant finding in the report
    const order = ['high', 'elevated', 'average', 'low', 'not-assessable'];
    const top = report?.findings.filter((f) => f.gene).sort((a, b) => order.indexOf(a.risk) - order.indexOf(b.risk))[0];
    const geneQuestion = /what does this gene mean/i.test(q) && top ? `What does ${top.gene} mean?` : q;
    const next: ChatEntry[] = [...chat, { role: 'user', content: geneQuestion }];
    setChat(next);
    setText('');
    setBusy(true);
    try {
      // Without a server the built-in geneticist answers right here in the browser.
      const reply =
        mode === 'server'
          ? await api.chat(report, next.map((m) => ({ role: m.role, content: m.content })), useAI).catch((e) => {
              if (e instanceof ApiUnavailable) return answerLocally(geneQuestion, report);
              throw e;
            })
          : answerLocally(geneQuestion, report);
      setChat((c) => [...c, { role: 'assistant', content: reply.reply, engine: reply.engine, note: reply.note, sources: reply.sources }]);
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', content: `${MESSAGES.noInfo} (${e instanceof Error ? e.message : 'The server could not answer.'})`, engine: 'built-in' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="AI Geneticist"
        title="Ask GeneGuard AI"
        actions={
          chat.length > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setChat([])}>
              <Trash2 className="size-4" /> Clear chat
            </button>
          )
        }
      >
        Questions are answered only from your uploaded data and curated genetic information. When the information is not there, the answer says so.
      </PageHeader>

      {!report && (
        <Callout tone="info" title="No genetic data in this session yet" className="mb-4">
          You can still ask general questions, but answers about your results need an analysis first.{' '}
          <Link to="/upload?mode=demo" className="font-semibold underline">
            Start the demo
          </Link>{' '}
          or{' '}
          <Link to="/upload" className="font-semibold underline">
            upload a report
          </Link>
          .
        </Callout>
      )}

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Bot className="size-5 text-indigo-500" />
          {useAI ? (
            <span>
              Answering with <strong className="text-ink">Claude ({status?.ai.model})</strong> — your report summary (not your file) is sent to Anthropic.
            </span>
          ) : (
            <span>
              Answering with the <strong className="text-ink">built-in rule-based geneticist</strong> —{' '}
              {mode === 'browser' ? 'it runs in your browser, nothing leaves this device.' : 'nothing leaves this server.'}
            </span>
          )}
        </p>
        {aiAvailable && <Toggle checked={consentAi} onChange={setConsentAi} label="Use Claude" />}
      </div>

      <div className="card flex min-h-[420px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {chat.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted">Try one of these questions:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SUGGESTED.map((s) => (
                  <button key={s} type="button" className="chip cursor-pointer px-3 py-1.5 text-sm hover:border-teal-400 hover:text-teal-700" onClick={() => void ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${m.role === 'user' ? 'bg-nav text-white' : 'bg-gradient-to-br from-teal-500 to-indigo-500 text-white'}`}>
                {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-nav text-white' : 'border border-line bg-surface-2 text-ink'}`}>
                {m.role === 'assistant' ? <RichText text={m.content} /> : m.content}
                {m.role === 'assistant' && (
                  <div className="mt-2 space-y-2 border-t border-line pt-2">
                    {m.sources && m.sources.length > 0 && <SourceLinks sources={m.sources} max={4} />}
                    <p className="text-[11px] text-muted">
                      {m.engine === 'ai' ? 'AI answer (Claude) · checked by the safety filter' : 'Built-in answer'}
                      {m.note && !m.note.startsWith('Answered by') ? ` · ${m.note}` : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Thinking…
            </p>
          )}
          <div ref={end} />
        </div>
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
        >
          <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about a gene, a variant or your risk…" maxLength={2000} aria-label="Your question" />
          <button type="submit" className="btn-primary" disabled={busy || !text.trim()}>
            <Send className="size-4" /> <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
      {chat.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED.slice(0, 4).map((s) => (
            <button key={s} type="button" className="chip cursor-pointer px-3 py-1 hover:border-teal-400" onClick={() => void ask(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">GeneGuard AI is not a doctor. Answers are educational and never a diagnosis or treatment advice.</p>
    </div>
  );
}
