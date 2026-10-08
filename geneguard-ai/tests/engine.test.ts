import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { answerLocally } from '../shared/chat';
import { DEMO_PROFILES, demoProfile } from '../shared/demo';
import { analyze } from '../shared/engine/analyze';
import { MESSAGES } from '../shared/messages';
import { parseTextInput } from '../shared/parsing';
import { sanitizeAiText } from '../shared/safety';

const run = (text: string, kind: 'text' | 'photo' | 'pdf' = 'text') => {
  const input = parseTextInput(text, { kind });
  return { input, report: analyze(input) };
};

describe('demo mode', () => {
  it('builds every demo profile without errors', () => {
    for (const d of DEMO_PROFILES) expect(() => analyze(d.build())).not.toThrow();
  });

  it('interprets the main demo patient safely', () => {
    const r = analyze(demoProfile('anna')!.build());
    const brca = r.findings.find((f) => f.gene === 'BRCA1')!;
    expect(brca.risk).toBe('high');
    expect(brca.interpretation).toMatch(/does not mean that cancer is present or guaranteed/);
    const cftr = r.findings.find((f) => f.gene === 'CFTR')!;
    expect(cftr.carrier).toBe(true);
    expect(r.findings.find((f) => f.gene === 'FBN1')!.riskHeadline).toBe(MESSAGES.unknownVariant);
    expect(r.summary.chromosomal.headline).toBe('Not assessable from submitted data');
    expect(r.chromosomal.results.every((c) => c.status === 'insufficient-data')).toBe(true);
    expect(r.prs.length).toBeGreaterThan(0);
    for (const p of r.prs) {
      expect(p.statement).toMatch(/percentile compared with the selected reference population/);
      expect(p.percentile).toBeGreaterThanOrEqual(1);
      expect(p.percentile).toBeLessThanOrEqual(99);
    }
    expect(r.disclaimers.join(' ')).toMatch(/does not diagnose diseases/);
    expect(r.warnings.some((w) => /synthetic demonstration data/.test(w.message))).toBe(true);
  });

  it('reports trisomy 21 from the cytogenetic demo and requires confirmation', () => {
    const r = analyze(demoProfile('karyotype')!.build());
    const t21 = r.chromosomal.results.find((c) => c.conditionKey === 'trisomy21')!;
    expect(t21.status).toBe('detected');
    expect(t21.requiresConfirmation).toBe(true);
  });
});

describe('report text extraction', () => {
  it('extracts key-value blocks and ignores negative lab statements', () => {
    const { input } = run(`Gene: BRCA1  Variant: c.5266dupC (p.Gln1756Profs*74)  rsID: rs80357906  Zygosity: Heterozygous
Classification: Pathogenic
No pathogenic variants were detected in BRCA2.`);
    expect(input.variants).toHaveLength(1);
    expect(input.variants[0]).toMatchObject({ gene: 'BRCA1', hgvsC: 'c.5266dupC', rsId: 'rs80357906', zygosity: 'heterozygous' });
  });

  it('fixes common OCR confusions in gene symbols', () => {
    const { input } = run('BRCAl c.5266dupC rs80357906 Heterozygous Pathogenic', 'photo');
    expect(input.variants[0].gene).toBe('BRCA1');
  });

  it('says so honestly when there is no genetic information', () => {
    const { input } = run('Shopping list: milk, bread, 12 eggs. Meeting at 5pm.', 'photo');
    expect(input.variants).toHaveLength(0);
    expect(input.warnings[0].message).toBe(MESSAGES.noGeneticInfo);
  });

  it('flags partial information and never fills in missing fields', () => {
    const { input } = run('Gene: BRCA1\nClassification: Pathogenic', 'photo');
    expect(input.warnings.some((w) => w.message === MESSAGES.partial)).toBe(true);
    expect(input.variants[0].hgvsC).toBeUndefined();
    expect(input.variants[0].rsId).toBeUndefined();
  });

  it('marks unknown variants as not established', () => {
    const { report } = run('Gene: LDLR Variant: c.9999A>G Zygosity: Heterozygous');
    expect(report.findings[0].riskHeadline).toBe(MESSAGES.unknownVariant);
    expect(report.findings[0].evidence).toBe('unknown');
  });

  it('needs zygosity before calling a recessive variant carrier or affected', () => {
    const { report } = run('Gene: CFTR Variant: c.1521_1523delCTT Classification: Pathogenic');
    expect(report.findings[0].risk).toBe('average');
    expect(report.findings[0].confidence).toBe('low');
  });

  it('reads APOE genotypes written as text', () => {
    const { report } = run('APOE genotype: ε4/ε4');
    expect(report.findings.find((f) => f.gene === 'APOE')!.risk).toBe('high');
  });
});

describe('chromosomal results', () => {
  it('treats a normal karyotype as not detected and microdeletions as not assessable', () => {
    const { report } = run('Chromosome analysis (G-banded karyotype)\nResult: 46,XX');
    expect(report.chromosomal.results.find((c) => c.conditionKey === 'trisomy21')!.status).toBe('not-detected');
    expect(report.chromosomal.results.find((c) => c.conditionKey === 'del22q11')!.status).toBe('insufficient-data');
  });

  it('labels NIPT results as screening', () => {
    const { report } = run('NIPT cell-free DNA screening\nTrisomy 21: High risk\nTrisomy 18: Low risk');
    expect(report.chromosomal.results.find((c) => c.conditionKey === 'trisomy21')!.status).toBe('screen-positive');
    expect(report.chromosomal.results.find((c) => c.conditionKey === 'trisomy18')!.status).toBe('not-detected');
  });
});

describe('VCF and SNP files', () => {
  const vcf = [
    '##fileformat=VCFv4.2',
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1',
    'chr11\t5227002\trs334\tT\tA\t60\tPASS\t.\tGT:GQ:DP\t0/1:60:30',
    'chr1\t169549811\t.\tC\tT\t12\tLowQual\t.\tGT:GQ:DP\t0/1:9:5',
    'chr6\t26092913\trs1800562\tG\tA\t60\tPASS\t.\tGT\t0/0',
    'random text that is not a variant',
  ].join('\n');

  it('parses VCF fields, skips invalid lines and grades call quality', () => {
    const { input, report } = run(vcf);
    expect(input.kind).toBe('vcf');
    expect(input.stats.skippedLines).toBe(1);
    expect(report.findings.find((f) => f.gene === 'HBB')!.carrier).toBe(true);
    expect(report.findings.find((f) => f.gene === 'F5')!.confidence).toBe('low');
    expect(report.testedNotDetected.some((t) => t.gene === 'HFE')).toBe(true);
  });

  it('parses 23andMe-style raw data and computes a polygenic score', () => {
    const { input, report } = run('# rsid\tchromosome\tposition\tgenotype\nrs7903146\t10\t112998590\tTT\nrs9939609\t16\t53786615\tAT\nrs1\t1\t1\t--');
    expect(input.kind).toBe('snp-array');
    expect(report.prs.find((p) => p.traitKey === 't2d')!.variantsUsed).toBe(2);
  });

  it('excludes genotypes whose alleles do not match the expected alleles', () => {
    const { report } = run('# rsid\tchromosome\tposition\tgenotype\nrs7903146\t10\t112998590\tAG\nrs5219\t11\t1\tCT\nrs13266634\t8\t1\tCC');
    const t2d = report.prs.find((p) => p.traitKey === 't2d')!;
    expect(t2d.excluded.map((e) => e.rsId)).toContain('rs7903146');
  });
});

describe('safety filter for AI text', () => {
  it('removes diagnostic certainty but keeps negated statements', () => {
    const r = sanitizeAiText('You have cancer. This does not mean you have cancer.');
    expect(r.text).not.toMatch(/^You have cancer/);
    expect(r.text).toMatch(/does not mean you have cancer/);
    expect(r.text).toMatch(/consult a qualified healthcare professional/);
  });

  it('removes dosages and treatment instructions', () => {
    const r = sanitizeAiText('Take tamoxifen every day. A dose of 20 mg is typical. Discuss options with your doctor.');
    expect(r.removed).toHaveLength(2);
    expect(r.text).toMatch(/Discuss options with your doctor/);
  });

  it('does not flag allele notation', () => {
    expect(sanitizeAiText('Your genotype at rs1801133 is G/A.').removed).toHaveLength(0);
  });
});

describe('built-in chat', () => {
  const report = analyze(demoProfile('anna')!.build());

  it('refuses to invent results for genes that are not in the data', () => {
    const a = answerLocally('What does my LDLR variant mean?', report);
    expect(a.reply).toMatch(/does not contain a result for LDLR/);
    expect(a.reply).toMatch(/I don't have enough information to determine this/);
  });

  it('never says a variant means disease', () => {
    const a = answerLocally('Does this variant mean I have the disease?', report);
    expect(a.reply).toMatch(/^No\./);
    expect(a.reply).toMatch(/Risk category is not a diagnosis/);
  });

  it('answers without a report honestly', () => {
    expect(answerLocally('What does BRCA1 mean?', null).reply).toMatch(/I don't have enough information/);
  });
});

describe('real OCR output (Tesseract on public/samples/sample-lab-report.png)', () => {
  const text = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ocr-lab-report.txt'), 'utf8');

  it('repairs typical OCR errors and finds every variant', () => {
    const { input, report } = run(text, 'photo');
    const byGene = (g: string) => input.variants.filter((v) => v.gene === g);
    expect(byGene('BRCA1')[0]).toMatchObject({ hgvsC: 'c.5266dupC', rsId: 'rs80357906', zygosity: 'heterozygous' });
    expect(byGene('BRCA1')[0].hgvsP).toBe('p.Gln1756Profs*74');
    expect(byGene('CFTR')[0]).toMatchObject({ hgvsC: 'c.1521_1523delCTT', zygosity: 'heterozygous' });
    expect(byGene('APOE').map((v) => v.genotype)).toEqual(['C/T', 'C/C']);
    expect(input.dataScope).toBe('targeted-report');
    expect(report.findings.find((f) => f.gene === 'BRCA1')!.knowledgeBaseId).toBe('brca1-5266dupc');
    expect(report.findings.find((f) => f.gene === 'APOE')!.variantLabel).toMatch(/ε3\/ε4/);
  });

  it('reports the "$" → "rs" correction instead of hiding it', () => {
    const { input } = run(text, 'photo');
    expect(input.variants.some((v) => v.rsId === 'rs6025')).toBe(true);
    expect(input.warnings.some((w) => /\$6025/.test(w.message))).toBe(true);
  });
});

describe('OCR noise from a scanned page', () => {
  it('corrects misread rsIDs and gene symbols on gene rows, and reports it', () => {
    const { input } = run('APOE    1s7412    cic\nFS    rs6025    cic', 'photo');
    expect(input.variants.find((v) => v.rsId === 'rs7412')).toMatchObject({ gene: 'APOE', genotype: 'C/C' });
    expect(input.variants.find((v) => v.rsId === 'rs6025')!.gene).toBe('F5');
    expect(input.warnings.some((w) => /1s7412/.test(w.message))).toBe(true);
  });

  it('does not turn ordinary words or prices into genetic data', () => {
    const { input } = run('The total is $6025 for 12 items. FS ratio was fine.', 'photo');
    expect(input.variants).toHaveLength(0);
  });
});
