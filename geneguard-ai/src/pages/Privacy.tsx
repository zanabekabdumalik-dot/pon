import { CloudOff, Cpu, Eye, HardDrive, KeyRound, Server, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Callout, PageHeader } from '../components/ui';
import { useSession } from '../state/session';

export function PrivacyPage() {
  const { status, uploaded, parsed, report, chat, removeFile, clearAll, setParsed, setReport, setChat, consentAi } = useSession();
  const [params] = useSearchParams();
  const ai = status?.ai.enabled;
  const nothing = !uploaded && !parsed && !report && chat.length === 0;

  const principles = [
    { icon: Cpu, title: 'Processed in your browser', text: 'Photos, PDFs and genotype files are read and OCR’d on your device. The file itself is never uploaded to the GeneGuard server.' },
    { icon: HardDrive, title: 'Current session only', text: 'Data lives only in this tab’s memory — no database, no cookies, no local storage. Refreshing or closing the tab erases it.' },
    { icon: Server, title: 'Stateless server', text: 'For interpretation the server receives the extracted variant list, answers, and forgets it. Request contents are never logged.' },
    { icon: Users, title: 'Never shared with other users', text: 'There are no accounts and no shared storage, so no other user can see your genetic information.' },
    { icon: KeyRound, title: 'Keys stay on the server', text: 'API keys are environment variables on the server and are never sent to the browser.' },
    { icon: Trash2, title: 'Delete at any time', text: 'Remove the uploaded file or all session data with one click below.' },
  ];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Privacy" title="Genetic data is highly sensitive personal information.">
        It can reveal information about you and your relatives that cannot be changed. That is why this demonstration version keeps data to the minimum.
      </PageHeader>

      {params.get('deleted') && nothing && (
        <Callout tone="info" title="All session data was deleted">
          The uploaded file, extracted variants, report and chat history were removed from memory.
        </Callout>
      )}

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {principles.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card p-4">
            <Icon className="size-6 text-teal-600 dark:text-teal-400" />
            <p className="mt-2 font-semibold text-ink">{title}</p>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <Eye className="size-5 text-indigo-500" /> External services used by this server
        </h2>
        <ul className="mt-3 space-y-3 text-sm text-ink-2">
          <li className="flex gap-3">
            <span className={`mt-1 size-2.5 shrink-0 rounded-full ${ai ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {ai ? (
              <span>
                <strong className="text-ink">Anthropic Claude API is configured ({status?.ai.model}).</strong> Data is sent to it <em>only</em> when you switch on AI explanations or the
                Claude chat, or press “Re-read with AI Vision”. What is sent: the extracted variant list and the analysis summary (genes, variants, genotypes, risk categories) — not your file
                name or document text. AI Vision sends the photo itself, for transcription. Anthropic processes these requests under its API terms; GeneGuard does not store them.
                {consentAi ? ' You have currently switched AI on.' : ' AI is currently switched off for your data.'}
              </span>
            ) : (
              <span>
                <strong className="text-ink">No external AI is configured.</strong> All explanations and chat answers come from GeneGuard’s built-in rule engine; nothing is sent to an AI
                provider.
              </span>
            )}
          </li>
          <li className="flex gap-3">
            <span className={`mt-1 size-2.5 shrink-0 rounded-full ${status?.clinvarLookup ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {status?.clinvarLookup ? (
              <span>
                <strong className="text-ink">Live ClinVar lookup is available.</strong> If you opt in, rsIDs that are not in the built-in knowledge base are sent to NCBI (U.S. National
                Library of Medicine). Nothing else is sent.
              </span>
            ) : (
              <span>
                <strong className="text-ink">Live ClinVar lookup is disabled.</strong> Only the built-in knowledge-base snapshot is used.
              </span>
            )}
          </li>
          <li className="flex gap-3">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>OCR (Tesseract.js), PDF reading (pdf.js) and the language model for OCR are served by this server itself — no third-party CDN, fonts or analytics.</span>
          </li>
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <ShieldCheck className="size-5 text-teal-600" /> Data in this session
        </h2>
        {nothing ? (
          <p className="mt-3 text-sm text-muted">No genetic data is held in this session.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {uploaded && (
              <Row
                title={`Uploaded file: ${uploaded.name}`}
                sub={`${uploaded.type || 'file'} · ${(uploaded.size / 1024).toFixed(0)} KB · held in browser memory`}
                onDelete={() => {
                  removeFile();
                }}
              />
            )}
            {parsed && <Row title={`Extracted data: ${parsed.variants.length} variant(s)`} sub={parsed.rawText ? 'including recognised document text' : undefined} onDelete={() => setParsed(null)} />}
            {report && <Row title="Analysis report" sub={`${report.findings.length} findings · ${report.prs.length} polygenic scores`} onDelete={() => setReport(null)} />}
            {chat.length > 0 && <Row title={`Chat history: ${chat.length} message(s)`} onDelete={() => setChat([])} />}
          </ul>
        )}
        <button type="button" className="btn-danger mt-4" disabled={nothing} onClick={() => window.confirm('Delete all genetic data from this session?') && clearAll()}>
          <Trash2 className="size-4" /> Delete all my data
        </button>
      </section>

      <Callout tone="neutral" title="Before using real genetic data">
        This is a school prototype. For real results, prefer the synthetic demo or your own data only, and remember that photos of reports can contain names and other identifiers. A
        production system would additionally need informed consent, encryption, access control, data-protection review and clinical validation.
      </Callout>
    </div>
  );
}

function Row({ title, sub, onDelete }: { title: string; sub?: string; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{title}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      <button type="button" className="btn-ghost px-2.5 text-rose-600" onClick={onDelete}>
        <Trash2 className="size-4" /> Delete
      </button>
    </li>
  );
}
