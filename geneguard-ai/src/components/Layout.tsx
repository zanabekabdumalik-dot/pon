import {
  BookOpen,
  Bot,
  ClipboardList,
  HeartPulse,
  House,
  Menu,
  MessagesSquare,
  Microscope,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { CLINICAL_CONTEXT, DISCLAIMER } from '../../shared/messages';
import { ON_DEVICE, asset } from '../lib/env';
import { usePipeline } from '../state/pipeline';
import { useSession } from '../state/session';
import { ConfirmAction } from './ConfirmAction';
import { Callout } from './ui';

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/analysis', label: 'Analysis', icon: Microscope, needsReport: true },
  { to: '/report', label: 'Risk Report', icon: ClipboardList, needsReport: true },
  { to: '/recommendations', label: 'Recommendations', icon: HeartPulse, needsReport: true },
  { to: '/chat', label: 'AI Geneticist', icon: MessagesSquare },
  { to: '/sources', label: 'Sources', icon: BookOpen },
  { to: '/privacy', label: 'Privacy', icon: ShieldCheck },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src={asset('favicon.svg')} alt="" className="size-9 rounded-xl shadow-lg shadow-teal-500/20" />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold tracking-tight text-white">
            GeneGuard <span className="bg-gradient-to-r from-teal-300 to-indigo-300 bg-clip-text text-transparent">AI</span>
          </span>
          <span className="block text-[10px] font-medium tracking-[0.14em] text-nav-ink/70 uppercase">Educational prototype</span>
        </span>
      )}
    </span>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('gg-theme', dark ? 'dark' : 'light'); // display preference only — never genetic data
    } catch {
      /* storage unavailable */
    }
  }, [dark]);
  return (
    <button type="button" className="btn-ghost px-2.5" onClick={() => setDark((d) => !d)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { report } = useSession();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end, needsReport }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-white/10 text-white shadow-inner' : 'text-nav-ink hover:bg-white/5 hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`size-[18px] ${isActive ? 'text-teal-300' : 'text-nav-ink/70 group-hover:text-teal-200'}`} />
              <span className="flex-1">{label}</span>
              {needsReport && report && <span className="size-1.5 rounded-full bg-teal-400" aria-label="results available" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function StatusCard() {
  const { status, mode } = useSession();
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-nav-ink">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-white">
        <Bot className="size-3.5 text-teal-300" /> Interpreter
      </p>
      {mode === 'checking' ? (
        <p>Starting…</p>
      ) : mode === 'browser' ? (
        <p>
          Built-in engine, {ON_DEVICE} <span className="block text-nav-ink/60">Works offline · no data leaves this device</span>
        </p>
      ) : status?.ai.enabled ? (
        <p>
          Claude AI available <span className="block text-nav-ink/60">{status.ai.model}</span>
        </p>
      ) : (
        <p>
          Built-in rule engine <span className="block text-nav-ink/60">No external AI configured</span>
        </p>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-nav px-4 py-5">
      <Logo />
      <NavItems onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        <StatusCard />
        <p className="px-1 text-[11px] leading-relaxed text-nav-ink/60">Not a diagnostic tool. Results are educational interpretations, not medical advice.</p>
      </div>
    </div>
  );
}

function DeleteDataButton() {
  const { report, parsed, uploaded, chat, clearAll } = useSession();
  const navigate = useNavigate();
  if (!report && !parsed && !uploaded && chat.length === 0) return null;
  return (
    <ConfirmAction
      className="btn-ghost px-2.5 text-rose-600 dark:text-rose-400"
      align="right"
      title="Delete all data from this session"
      question="Delete all genetic data from this session? This cannot be undone."
      confirmLabel="Yes, delete everything"
      onConfirm={() => {
        clearAll();
        navigate('/privacy?deleted=1');
      }}
    >
      <Trash2 className="size-4" />
      <span className="hidden sm:inline">Delete my data</span>
    </ConfirmAction>
  );
}

export function Layout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { error, clearError } = usePipeline();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <button type="button" className="btn-ghost -ml-2 px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <span className="rounded-xl bg-nav p-1 lg:hidden">
              <Logo compact />
            </span>
            <span className="hidden truncate rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 sm:inline-flex dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Educational prototype · Not a diagnosis
            </span>
            <div className="ml-auto flex items-center gap-1">
              <DeleteDataButton />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="print-full mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {error && (
            <div className="no-print mb-4">
              <Callout tone="danger" title="Something went wrong">
                <p>{error}</p>
                <button type="button" className="mt-2 text-xs font-semibold underline" onClick={clearError}>
                  Dismiss
                </button>
              </Callout>
            </div>
          )}
          {children ?? <Outlet />}
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs leading-relaxed text-muted sm:px-6">
            <p>
              <strong className="text-ink-2">Safety notice.</strong> {DISCLAIMER}
            </p>
            <p>{CLINICAL_CONTEXT}</p>
            <p className="no-print">GeneGuard AI · school science project · data is processed only for the current session.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
