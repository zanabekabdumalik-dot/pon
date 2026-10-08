import { Activity, Dna, Leaf, Lock, MessageCircleQuestion, Stethoscope, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Recommendation } from '../../shared/types';
import { MESSAGES } from '../../shared/messages';
import { Callout, EmptyState, PageHeader } from '../components/ui';
import { useSession } from '../state/session';

const KIND: Record<Recommendation['kind'], { title: string; icon: typeof Leaf; cls: string }> = {
  professional: { title: 'Professional advice', icon: Stethoscope, cls: 'text-indigo-600 bg-indigo-500/10 dark:text-indigo-300' },
  family: { title: 'Family', icon: Users, cls: 'text-sky-600 bg-sky-500/10 dark:text-sky-300' },
  monitoring: { title: 'Monitoring', icon: Activity, cls: 'text-amber-600 bg-amber-500/10 dark:text-amber-300' },
  lifestyle: { title: 'Lifestyle', icon: Leaf, cls: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-300' },
};

export function RecommendationsPage() {
  const { report } = useSession();
  if (!report) return <EmptyState />;
  const groups = (['professional', 'family', 'monitoring', 'lifestyle'] as const).map((k) => ({ k, items: report.recommendations.filter((r) => r.kind === k) })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Prevention" title="What can you do?">
        Safe, general suggestions based on your results. GeneGuard never prescribes medicines or doses and never suggests starting treatment on your own.
      </PageHeader>

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-8 text-white shadow-xl">
        <Dna className="absolute -top-6 -right-6 size-40 opacity-15" />
        <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-80">Main idea</p>
        <p className="mt-2 text-3xl font-extrabold sm:text-4xl">{MESSAGES.predispositionNotDestiny}</p>
        <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
          Your genes are one part of the picture. Many people with a higher genetic risk never develop the condition, and people with a lower genetic risk can still develop it.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-bold text-ink">What can I change?</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Column icon={Lock} title="Genetic factors" subtitle="Cannot be changed" tone="slate">
            <ul className="space-y-2 text-sm text-ink-2">
              {report.changeable.genetic.map((g) => (
                <li key={g} className="rounded-lg bg-surface-2 p-2.5">
                  {g}
                </li>
              ))}
            </ul>
          </Column>
          <Column icon={Leaf} title="Lifestyle factors" subtitle="Can often be modified" tone="emerald">
            <ul className="space-y-2 text-sm">
              {report.changeable.lifestyle.map((l) => (
                <li key={l.factor} className="rounded-lg bg-emerald-500/5 p-2.5">
                  <p className="font-semibold text-ink">{l.factor}</p>
                  <p className="text-xs text-muted">{l.why}</p>
                </li>
              ))}
            </ul>
          </Column>
          <Column icon={Activity} title="Medical monitoring" subtitle="May help detect certain conditions earlier" tone="amber">
            <ul className="space-y-2 text-sm">
              {report.changeable.monitoring.map((m) => (
                <li key={m.item} className="rounded-lg bg-amber-500/5 p-2.5">
                  <p className="font-semibold text-ink">{m.item}</p>
                  <p className="text-xs text-muted">{m.why}</p>
                </li>
              ))}
            </ul>
          </Column>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-ink">Recommendations</h2>
        {groups.map(({ k, items }) => {
          const meta = KIND[k];
          return (
            <div key={k}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-muted uppercase">
                <span className={`grid size-7 place-items-center rounded-lg ${meta.cls}`}>
                  <meta.icon className="size-4" />
                </span>
                {meta.title}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((r) => (
                  <div key={r.id} className="card p-4">
                    <p className="font-semibold text-ink">{r.title}</p>
                    <p className="mt-1 text-sm text-muted">{r.detail}</p>
                    {r.related.length > 0 && <p className="mt-2 text-xs text-teal-700 dark:text-teal-400">Related to: {r.related.join(', ')}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <MessageCircleQuestion className="size-5 text-indigo-500" /> Questions to ask your doctor or genetic counselor
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {report.doctorQuestions.map((q) => (
            <li key={q} className="rounded-lg bg-surface-2 p-3 text-sm text-ink-2">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <Callout tone="neutral" title="Important">
        Lifestyle changes support overall health but are not guaranteed to prevent a genetic condition. Do not start, stop or change any medicine or treatment because of this educational
        report — discuss significant findings with a doctor or genetic counselor.
      </Callout>
    </div>
  );
}

function Column({ icon: Icon, title, subtitle, tone, children }: { icon: typeof Leaf; title: string; subtitle: string; tone: 'slate' | 'emerald' | 'amber'; children: ReactNode }) {
  const top = { slate: 'from-slate-500 to-slate-700', emerald: 'from-emerald-500 to-teal-600', amber: 'from-amber-400 to-orange-500' }[tone];
  return (
    <div className="card overflow-hidden">
      <div className={`bg-gradient-to-r ${top} p-4 text-white`}>
        <p className="flex items-center gap-2 text-lg font-bold">
          <Icon className="size-5" /> {title}
        </p>
        <p className="text-sm text-white/90">{subtitle}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
