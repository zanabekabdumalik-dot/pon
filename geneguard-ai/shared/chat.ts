import type { AnalysisReport, ChatReply, Finding, SourceRef } from './types';
import { CHROMOSOMAL_CONDITIONS } from './knowledge/chromosomal';
import { CONDITIONS } from './knowledge/conditions';
import { GENES, RECOGNISED_GENE_SYMBOLS } from './knowledge/genes';
import { MESSAGES } from './messages';

// Built-in, rule-based answers for "Ask GeneGuard AI". Used when no AI API key
// is configured (and as a fallback). Answers come only from the user's report
// and the curated knowledge base; anything else gets the honest
// "I don't have enough information" reply.

type Intent = 'meaning' | 'have-disease' | 'reduce' | 'doctor' | 'prs' | 'carrier' | 'vus' | 'confidence' | 'chromosomal' | 'privacy' | 'family' | 'summary';

const INTENTS: [Intent, RegExp][] = [
  ['privacy', /\b(privacy|private|stored?|saved?|delete|share[ds]?|who can see|data safe)\b|конфиденц|удал/i],
  ['have-disease', /\b(do i have|does (this|it|that)( variant| result)? mean (that )?i (have|will)|am i (sick|ill|going to)|will i (get|develop|have)|diagnos|guarantee)|у меня есть|я заболе/i],
  ['reduce', /\b(reduce|lower|decrease|prevent|what can i do|lifestyle|change|improve|protect)\b|снизить|что делать|профилакт/i],
  ['doctor', /\b(doctor|physician|counsel(l)?or|specialist|gp|should i (see|talk|visit)|medical advice|clinic)\b|врач|доктор/i],
  ['prs', /\b(polygenic|prs|percentile|score|reference population)\b|полиген|перцентил/i],
  ['carrier', /\b(carrier|carry|recessive)\b|носител/i],
  ['vus', /\b(vus|uncertain significance|uncertain)\b/i],
  ['confidence', /\b(confiden|evidence|reliab|accura|trust|sure|certain)\w*/i],
  ['chromosomal', /\b(chromosom|trisomy|karyotype|down syndrome|aneuploid)\w*/i],
  ['family', /\b(child|children|kids|baby|family|relatives?|sister|brother|parents?|inherit|pass (it )?on)\b|дет|семь|родствен/i],
  ['summary', /\b(summary|summari[sz]e|overall|overview|main findings?|results?|what did you find|most important)\b|итог|результат/i],
  ['meaning', /\b(what (does|is|do)|mean|meaning|explain|tell me about|about)\b|что (значит|означает)|объясн/i],
];

function detectIntent(q: string): Intent | undefined {
  return INTENTS.find(([, re]) => re.test(q))?.[0];
}

function mentionedGenes(q: string): string[] {
  // Curated genes match in any case ("brca1"); other symbols only when typed in capitals, so words like "ace" are not genes.
  const found = (q.match(/[A-Za-z][A-Za-z0-9-]{1,10}/g) ?? []).filter((t) => GENES[t.toUpperCase()] || (t === t.toUpperCase() && RECOGNISED_GENE_SYMBOLS.has(t)));
  return [...new Set(found.map((t) => t.toUpperCase()))];
}

function mentionedConditionKeys(q: string): string[] {
  const lower = q.toLowerCase();
  return Object.values(CONDITIONS)
    .filter((c) => c.aliases.some((a) => a.length > 3 && lower.includes(a)))
    .map((c) => c.key);
}

const RISK_WORD: Record<string, string> = {
  high: 'High genetic risk',
  elevated: 'Elevated',
  average: 'Average / uncertain',
  low: 'Low / lower genetic risk',
  'not-assessable': 'Not assessable',
};

function describeFinding(f: Finding): string {
  return `**${f.gene ?? 'Variant'} ${f.variantLabel}** — ${f.significanceLabel}; ${f.riskHeadline}. Risk category: ${RISK_WORD[f.risk]} (confidence: ${f.confidence}, evidence: ${f.evidence}).`;
}

const doctorLine = 'Significant genetic findings should be discussed with a doctor or genetic counselor.';

export function answerLocally(question: string, report: AnalysisReport | null): ChatReply {
  const q = question.trim();
  const sources: SourceRef[] = [];
  const reply = (text: string, note?: string): ChatReply => ({ reply: text, engine: 'built-in', note, sources: sources.slice(0, 6) });

  if (!q) return reply(MESSAGES.noInfo);
  const intent = detectIntent(q);

  if (intent === 'privacy')
    return reply(
      'Your genetic data is processed only for the current session. Files are read in your browser; the server keeps nothing after it answers, and nothing is shared with other users. You can delete everything at any time on the Privacy page (“Delete my data”). If external AI is enabled on this server, only the extracted variant list is sent to the AI provider, and only after you agree.',
    );

  if (!report)
    return reply(
      `${MESSAGES.noInfo} No genetic data has been analysed in this session yet. Upload a report or start the demo, then ask me about the results.`,
    );

  const genes = mentionedGenes(q);
  const condKeys = mentionedConditionKeys(q);
  const findingsFor = (gene: string) => report.findings.filter((f) => f.gene === gene);
  const missingGenes = genes.filter((g) => findingsFor(g).length === 0 && !report.prs.some((p) => p.contributions.some((c) => c.gene === g)));
  const relevant = report.findings.filter((f) => (genes.length ? genes.includes(f.gene ?? '') : condKeys.length ? condKeys.includes(f.conditionKey ?? '') : false));
  for (const f of relevant) sources.push(...f.sources);

  if (genes.length && missingGenes.length === genes.length) {
    const g = missingGenes[0];
    const info = GENES[g];
    const general = info ? ` In general, the ${g} gene ${info.role}.` : '';
    return reply(
      `Your submitted data does not contain a result for ${missingGenes.join(', ')}, so I cannot say anything about your personal ${missingGenes.length > 1 ? 'variants in these genes' : 'variant in this gene'}. ${MESSAGES.noInfo}${general}`,
    );
  }

  switch (intent) {
    case 'have-disease': {
      const list = relevant.length ? relevant : report.findings.filter((f) => f.clinicallyRelevant);
      if (!list.length)
        return reply(
          `No clinically significant variant was identified in the analysed data. Lower estimated genetic risk based on the available data does not eliminate the possibility of disease, and genes that were not tested were not evaluated. ${MESSAGES.notDiagnosis}`,
        );
      return reply(
        [
          'No. GeneGuard does not diagnose diseases, and a genetic variant on its own does not tell whether a condition is present.',
          ...list.map((f) => `• ${f.gene}: ${f.interpretation}`),
          `${MESSAGES.notDiagnosis} ${doctorLine}`,
        ].join('\n'),
      );
    }
    case 'reduce': {
      const life = report.changeable.lifestyle.slice(0, 6).map((l) => `• ${l.factor} — ${l.why}`);
      return reply(
        [
          'Genetic factors cannot be changed, but lifestyle factors often can, and medical monitoring may help detect certain conditions earlier:',
          ...life,
          ...report.changeable.monitoring.slice(0, 3).map((m) => `• ${m.item} — ${m.why}`),
          'Lifestyle changes are not guaranteed to prevent a genetic condition, but they support overall health. Never start or change treatment based on this report.',
          MESSAGES.predispositionNotDestiny,
        ].join('\n'),
      );
    }
    case 'doctor': {
      const sig = report.findings.filter((f) => f.clinicallyRelevant && f.risk !== 'low');
      const chrom = report.chromosomal.results.filter((r) => r.status === 'detected' || r.status === 'screen-positive');
      if (sig.length || chrom.length)
        return reply(
          `Yes — it is a good idea. Your report contains ${[...sig.map((f) => `${f.gene} (${f.riskHeadline.toLowerCase()})`), ...chrom.map((c) => c.name)].join(', ')}. A doctor or genetic counselor can confirm the result with clinical testing and explain what it means for you. Useful questions to ask:\n${report.doctorQuestions
            .slice(0, 4)
            .map((x) => `• ${x}`)
            .join('\n')}`,
        );
      return reply(
        `Your analysed data did not show high-priority findings, but talking to a doctor is always reasonable if you have symptoms, a family history of a condition, or questions about your results. ${doctorLine}`,
      );
    }
    case 'prs': {
      if (!report.prs.length) return reply(`${MESSAGES.noInfo} No polygenic score could be calculated from your data.`);
      return reply(
        [
          'A polygenic risk score (PRS) adds up many common variants that each have a tiny effect. It is compared with a reference population and shown as a percentile — it is not a probability of getting the disease.',
          ...report.prs.map((p) => `• ${p.trait}: ${p.percentile}th percentile, ${p.variantsUsed} variant(s), confidence ${p.confidence}.`),
          'GeneGuard’s educational scores use only a few variants, so their confidence is low; clinical scores use thousands to millions of variants.',
        ].join('\n'),
      );
    }
    case 'carrier': {
      const carriers = report.findings.filter((f) => f.carrier);
      if (!carriers.length) return reply('No carrier findings were identified in your analysed data. Genes that were not tested were not evaluated.');
      return reply(
        [
          'A carrier has one copy of a variant linked to a recessive condition. Carriers usually have no symptoms, but if both parents are carriers for the same condition, each child has a 25% chance of being affected.',
          ...carriers.map((f) => `• ${f.gene} ${f.variantLabel}: carrier for ${f.condition.toLowerCase()}.`),
          doctorLine,
        ].join('\n'),
      );
    }
    case 'vus': {
      const vus = report.findings.filter((f) => f.significance === 'uncertain' || f.significance === 'not-provided');
      return reply(
        [
          'A variant of uncertain significance (VUS) means there is not yet enough evidence to say whether it affects health. It should not be used for medical decisions.',
          ...vus.map((f) => `• ${f.gene ?? ''} ${f.variantLabel}: ${f.riskHeadline}`),
        ].join('\n'),
      );
    }
    case 'confidence': {
      const list = relevant.length ? relevant : report.findings;
      if (!list.length) return reply(MESSAGES.noInfo);
      return reply(
        [
          'GeneGuard shows two separate things: evidence level (how strong the published science is) and confidence (how reliable the data and interpretation are for you).',
          ...list.slice(0, 6).map((f) => `• ${f.gene} ${f.variantLabel}: evidence ${f.evidence}, confidence ${f.confidence} — ${f.confidenceReason}`),
        ].join('\n'),
      );
    }
    case 'chromosomal': {
      if (!report.chromosomal.assessable) return reply(`Chromosomal conditions are not assessable from your data. ${report.chromosomal.reason}`);
      const lines = report.chromosomal.results.map((r) => `• ${r.name}: ${r.status.replace('-', ' ')}${r.requiresConfirmation ? ' — requires specialist confirmation' : ''}`);
      for (const c of CHROMOSOMAL_CONDITIONS) if (report.chromosomal.results.some((r) => r.conditionKey === c.key)) sources.push(...c.sources);
      return reply([report.chromosomal.reason, ...lines].join('\n'));
    }
    case 'family': {
      const fam = report.findings.filter((f) => f.clinicallyRelevant);
      if (!fam.length) return reply(`${MESSAGES.noInfo} Your data does not contain clinically relevant variants to discuss for family members.`);
      return reply(
        [
          ...fam.map((f) =>
            /dominant/i.test(f.inheritance)
              ? `• ${f.gene}: inherited in a dominant way — each child has a 50% chance to inherit the variant. Relatives may be offered testing.`
              : f.carrier
                ? `• ${f.gene}: you appear to be a carrier. A child would be affected only if they also inherit a variant from the other parent (25% if both parents are carriers).`
                : `• ${f.gene}: ${f.inheritance}.`,
          ),
          'A genetic counselor can explain family testing options.',
        ].join('\n'),
      );
    }
    case 'summary':
      return reply(report.overview);
    case 'meaning':
    default: {
      if (relevant.length) {
        return reply(
          [
            ...relevant.map((f) => `${describeFinding(f)}\n${f.explanation}\n${f.interpretation}`),
            `${MESSAGES.notDiagnosis} ${doctorLine}`,
          ].join('\n\n'),
        );
      }
      if (genes.length) {
        const prs = report.prs.filter((p) => p.contributions.some((c) => genes.includes(c.gene)));
        if (prs.length)
          return reply(
            prs
              .map((p) => {
                const c = p.contributions.filter((x) => genes.includes(x.gene));
                return `${c.map((x) => `${x.gene} ${x.rsId} (${x.genotype}): ${x.riskAlleleCount} copy/copies of the ${x.riskAllele} allele, ≈${x.oddsRatio}× per allele`).join('; ')}. This variant is part of the ${p.trait.toLowerCase()} polygenic score (${p.percentile}th percentile). Each common variant has only a small effect.`;
              })
              .join('\n'),
          );
      }
      if (intent === undefined && !genes.length && !condKeys.length)
        return reply(
          `${MESSAGES.noInfo} I can answer questions about the genes and results in your report, for example: “What does BRCA1 mean?”, “Does this variant mean I have the disease?”, “What can I do to reduce my risk?” or “Should I talk to a doctor?”.`,
        );
      return reply(`${MESSAGES.noInfo} ${report.overview}`);
    }
  }
}
