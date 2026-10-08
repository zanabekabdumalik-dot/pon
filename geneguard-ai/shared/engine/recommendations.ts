import type { AnalysisReport, ChangeableFactors, ChromosomalResult, Finding, PrsResult, Recommendation } from '../types';
import { CONDITIONS, GENERAL_RECOMMENDATIONS, type ConditionInfo } from '../knowledge/conditions';
import { makeId } from '../parsing/ids';
import { lowerFirst, ordinal } from '../text';

const CANONICAL_FACTORS: [RegExp, string][] = [
  [/activ|exercise/i, 'Regular physical activity'],
  [/diet|food/i, 'Balanced, heart-healthy diet'],
  [/smok/i, 'Avoid smoking'],
  [/sleep/i, 'Healthy sleep'],
  [/alcohol/i, 'Limit alcohol'],
  [/weight/i, 'Healthy body weight'],
];
const canonicalFactor = (f: string) => CANONICAL_FACTORS.find(([re]) => re.test(f))?.[1] ?? f;

function relevantConditions(findings: Finding[], prs: PrsResult[]): ConditionInfo[] {
  const keys = new Set<string>();
  for (const f of findings)
    if (f.conditionKey && (f.clinicallyRelevant || f.carrier || f.risk === 'elevated' || f.risk === 'high')) keys.add(f.conditionKey);
  for (const p of prs) if (p.risk !== 'low' || p.contributions.some((c) => c.riskAlleleCount > 0)) keys.add(p.traitKey);
  return [...keys].map((k) => CONDITIONS[k]).filter(Boolean);
}

export function buildRecommendations(
  findings: Finding[],
  prs: PrsResult[],
  chromosomal: ChromosomalResult[],
  input: AnalysisReport['input'],
): { recommendations: Recommendation[]; changeable: ChangeableFactors; doctorQuestions: string[] } {
  const conditions = relevantConditions(findings, prs);
  const recs: Recommendation[] = [];
  const add = (r: Omit<Recommendation, 'id' | 'related'>, related: string[] = []) => {
    const existing = recs.find((x) => x.title === r.title);
    if (existing) {
      for (const name of related) if (!existing.related.includes(name)) existing.related.push(name);
      return;
    }
    recs.push({ ...r, id: makeId('rec'), related: [...related] });
  };

  const significant = findings.filter((f) => f.clinicallyRelevant && (f.risk === 'high' || f.risk === 'elevated'));
  const chromDetected = chromosomal.filter((c) => c.status === 'detected' || c.status === 'screen-positive');
  if (significant.length || chromDetected.length) {
    add(
      {
        kind: 'professional',
        title: 'Discuss significant findings with a healthcare professional',
        detail:
          'A doctor or genetic counselor can confirm these results with appropriate clinical testing and explain what they mean for you. Do not make medical decisions based on this educational report alone.',
      },
      [...significant.map((f) => f.condition), ...chromDetected.map((c) => c.name)],
    );
  }
  if (input.kind === 'snp-array' && findings.some((f) => f.category === 'monogenic' && f.clinicallyRelevant)) {
    add({
      kind: 'professional',
      title: 'Confirm with a clinical-grade test',
      detail: 'Consumer genotyping arrays can produce false-positive results for rare variants. A clinical laboratory test is needed before acting on them.',
    });
  }
  if (chromDetected.length) {
    add(
      {
        kind: 'professional',
        title: 'Specialist review of the chromosomal result',
        detail: 'Chromosomal findings should be explained by a clinical geneticist, who can also confirm screening results with diagnostic tests.',
      },
      chromDetected.map((c) => c.name),
    );
  }
  for (const c of conditions) for (const r of c.recommendations) add(r, [c.name]);
  if (findings.some((f) => f.significance === 'uncertain')) {
    add({
      kind: 'professional',
      title: 'Do not act on variants of uncertain significance',
      detail: 'A VUS should not change medical care. Ask the laboratory or your doctor how you will be told if it is reclassified.',
    });
  }
  for (const r of GENERAL_RECOMMENDATIONS) {
    // the general "talk to a professional" advice is already covered when a specific one exists
    if (r.kind === 'professional' && recs.some((x) => x.title === 'Discuss significant findings with a healthcare professional')) continue;
    add(r);
  }
  recs.push({
    id: makeId('rec'),
    kind: 'monitoring',
    title: 'Consider appropriate screening based on professional medical advice',
    detail: 'Which screening tests are useful, and when, depends on your personal and family history — a doctor can advise.',
    related: [],
  });

  // "What can I change?"
  const genetic: string[] = [];
  for (const f of findings) {
    if (!(f.clinicallyRelevant || f.carrier || f.risk === 'elevated' || f.risk === 'high')) continue;
    const zyg = f.zygosity && f.zygosity !== 'unknown' ? `, ${f.zygosity}` : '';
    genetic.push(`${f.gene ?? 'Variant'} ${f.variantLabel}${zyg} — ${lowerFirst(f.riskHeadline)}`);
  }
  for (const p of prs) {
    const n = p.contributions.filter((c) => c.riskAlleleCount > 0 && c.oddsRatio > 1).length;
    genetic.push(`${p.trait}: polygenic score in the ${ordinal(p.percentile)} percentile (risk-increasing alleles at ${n} of ${p.variantsUsed} variants)`);
  }
  for (const c of chromDetected) genetic.push(c.name);
  if (genetic.length === 0) genetic.push('No significant genetic factors were identified in the analysed data. Genes and variants that were not tested were not evaluated.');

  const lifestyle = new Map<string, { factor: string; why: string; related: string[] }>();
  const addFactor = (factor: string, why: string, related?: string) => {
    const name = canonicalFactor(factor);
    const entry = lifestyle.get(name) ?? { factor: name, why, related: [] };
    if (related && !entry.related.includes(related)) entry.related.push(related);
    lifestyle.set(name, entry);
  };
  for (const c of conditions) for (const l of c.lifestyle) addFactor(l.factor, l.why, c.name);
  addFactor('Regular physical activity', 'Benefits heart, metabolic and mental health for everyone.');
  addFactor('Balanced diet', 'Vegetables, fruit, legumes and whole grains support long-term health.');
  addFactor('Avoid smoking', 'Reduces the risk of many diseases.');
  addFactor('Healthy sleep', 'Supports metabolic and brain health.');

  const monitoring = new Map<string, { item: string; why: string }>();
  for (const c of conditions) for (const m of c.monitoring) monitoring.set(m.item, m);
  monitoring.set('Routine check-ups', { item: 'Routine check-ups', why: 'Blood pressure, cholesterol and blood sugar as recommended by your doctor.' });

  const questions = [
    'Should this result be confirmed with a clinical-grade genetic test?',
    'Which screening tests or check-ups are appropriate for me, and from what age?',
    'Would a referral to a genetic counselor be helpful?',
    'Which lifestyle habits matter most for my personal risk?',
  ];
  if (findings.some((f) => f.carrier || /dominant/i.test(f.inheritance))) questions.splice(1, 0, 'Should my relatives be told about this result or offered testing?');
  if (findings.some((f) => f.significance === 'uncertain')) questions.push('How will I find out if a variant of uncertain significance is reclassified?');
  if (findings.some((f) => f.gene === 'APOE' && f.significance === 'risk-factor')) questions.push('What does my APOE result mean for me, and is it useful to act on it?');

  return {
    recommendations: recs,
    changeable: {
      genetic,
      lifestyle: [...lifestyle.values()].map((l) => ({
        factor: l.factor,
        why: l.related.length ? `${l.why} Relevant to: ${l.related.join(', ')}.` : l.why,
      })),
      monitoring: [...monitoring.values()],
    },
    doctorQuestions: questions,
  };
}
