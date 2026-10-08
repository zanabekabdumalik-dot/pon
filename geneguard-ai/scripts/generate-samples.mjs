// Generates the synthetic sample documents in public/samples/ (PNG photos, PDFs,
// VCF and raw-data TXT). All content is fictional and labelled as synthetic.
//
//   npm run samples
//
// Needs a Chromium for Playwright: `npx playwright install chromium` (or set
// CHROMIUM=/path/to/chrome). The generated files are committed, so this is only
// needed if you want to change them.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'samples');
mkdirSync(out, { recursive: true });

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
  .page { width: 900px; padding: 44px 52px; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0f4c5c; padding-bottom: 12px; }
  .lab { font-size: 26px; font-weight: bold; color: #0f4c5c; }
  .sub { font-size: 15px; color: #333; margin-top: 4px; }
  .stamp { font-size: 13px; font-weight: bold; color: #b42318; border: 2px solid #b42318; padding: 6px 10px; }
  .meta { font-size: 15px; margin: 16px 0; line-height: 1.7; }
  h2 { font-size: 18px; color: #0f4c5c; margin: 22px 0 8px; border-bottom: 1px solid #cfd8dc; padding-bottom: 4px; }
  .result { font-size: 18px; font-weight: bold; background: #fff4e5; padding: 10px 12px; }
  .block { border: 1px solid #cfd8dc; padding: 12px 16px; margin: 12px 0; font-size: 16px; line-height: 1.9; }
  .block .t { font-weight: bold; font-size: 15px; color: #555; }
  table { border-collapse: collapse; width: 100%; font-size: 16px; }
  td, th { border: 1px solid #cfd8dc; padding: 7px 10px; text-align: left; }
  th { background: #eef3f5; }
  .small { font-size: 13px; color: #333; line-height: 1.6; }
`;

const labReport = `
<div class="page">
  <div class="head">
    <div><div class="lab">DemoGen Genetics Laboratory</div><div class="sub">Hereditary Disease Panel — Laboratory Report</div></div>
    <div class="stamp">SYNTHETIC SAMPLE — NOT A REAL PATIENT</div>
  </div>
  <div class="meta">
    Patient: Sample Patient (synthetic) &nbsp;&nbsp;&nbsp; Sex: Female &nbsp;&nbsp;&nbsp; DOB: 1996-01-01<br>
    Specimen: Peripheral blood &nbsp;&nbsp;&nbsp; Report date: 2026-09-15 &nbsp;&nbsp;&nbsp; Report ID: DEMO-0001<br>
    Test: Hereditary disease panel (next-generation sequencing), 12 genes<br>
    Genes analyzed: BRCA1, BRCA2, CFTR, HBB, FBN1, LDLR, APOB, PCSK9, HFE, F5, F2, APOE
  </div>
  <div class="result">RESULT: POSITIVE — 2 clinically significant variants detected</div>
  <h2>Variant details</h2>
  <div class="block">
    <div class="t">Variant 1</div>
    Gene: BRCA1 &nbsp;&nbsp;&nbsp; Variant: c.5266dupC (p.Gln1756Profs*74) &nbsp;&nbsp;&nbsp; rsID: rs80357906<br>
    Chromosome: 17 &nbsp;&nbsp;&nbsp; Zygosity: Heterozygous &nbsp;&nbsp;&nbsp; Classification: Pathogenic<br>
    Condition: Hereditary breast and ovarian cancer syndrome<br>
    Interpretation: Associated with increased inherited susceptibility to breast and ovarian cancer.
  </div>
  <div class="block">
    <div class="t">Variant 2</div>
    Gene: CFTR &nbsp;&nbsp;&nbsp; Variant: c.1521_1523delCTT (p.Phe508del) &nbsp;&nbsp;&nbsp; rsID: rs113993960<br>
    Chromosome: 7 &nbsp;&nbsp;&nbsp; Zygosity: Heterozygous &nbsp;&nbsp;&nbsp; Classification: Pathogenic<br>
    Condition: Cystic fibrosis (autosomal recessive)<br>
    Interpretation: Carrier of a pathogenic CFTR variant.
  </div>
  <h2>Additional genotypes</h2>
  <table>
    <tr><th>Gene</th><th>rsID</th><th>Genotype</th></tr>
    <tr><td>APOE</td><td>rs429358</td><td>C/T</td></tr>
    <tr><td>APOE</td><td>rs7412</td><td>C/C</td></tr>
    <tr><td>TCF7L2</td><td>rs7903146</td><td>C/T</td></tr>
    <tr><td>FTO</td><td>rs9939609</td><td>A/T</td></tr>
    <tr><td>F5</td><td>rs6025</td><td>C/C</td></tr>
  </table>
  <p class="meta">No pathogenic variants were detected in BRCA2, HBB, FBN1, LDLR, APOB, PCSK9, HFE or F2.</p>
  <h2>Methodology and limitations</h2>
  <p class="small">Methodology: sequencing of coding regions and splice junctions of the genes listed above. Limitations: this test does not detect all
  types of genetic changes and does not assess chromosome number or structure. This document is a synthetic example created for an educational
  school project and does not describe any real person.</p>
</div>`;

const partial = `
<div style="width:420px;padding:22px;background:#f2f4f7;font-family:Arial;">
  <div style="background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 6px rgba(0,0,0,.08);font-size:19px;line-height:1.9;">
    <div style="color:#888;font-size:14px;">…ant: c.5266dupC</div>
    Gene: BRCA1<br>
    Classification: Pathogenic<br>
    <div style="height:14px;background:linear-gradient(#fff,#ddd);margin-top:6px;"></div>
  </div>
  <div style="margin-top:12px;font-size:13px;color:#777;">Screenshot · synthetic example</div>
</div>`;

const karyotype = `
<div class="page" style="width:820px">
  <div class="head">
    <div><div class="lab">DemoGen Cytogenetics</div><div class="sub">Chromosome Analysis Report</div></div>
    <div class="stamp">SYNTHETIC SAMPLE</div>
  </div>
  <div class="meta">
    Patient: Sample Child (synthetic) &nbsp;&nbsp; Sex: Male &nbsp;&nbsp; Specimen: Peripheral blood<br>
    Test: Chromosome analysis (G-banded karyotype) &nbsp;&nbsp; Cells counted: 20 &nbsp;&nbsp; Band level: 550
  </div>
  <div class="result">Result: 47,XY,+21</div>
  <p class="meta">Interpretation: Abnormal male karyotype with an additional chromosome 21, consistent with trisomy 21.
  Genetic counselling is recommended.</p>
  <p class="small">This document is synthetic and was created for an educational school project.</p>
</div>`;

const notGenetic = `
<div style="width:760px;height:520px;background:linear-gradient(160deg,#9bd3f5,#f9e7b8 60%,#7cbf6b 61%,#4f8f43);position:relative;font-family:'Comic Sans MS',cursive;">
  <div style="position:absolute;left:60px;top:60px;width:110px;height:110px;border-radius:50%;background:#ffd84d;box-shadow:0 0 50px #ffe680;"></div>
  <div style="position:absolute;right:70px;top:110px;transform:rotate(4deg);background:#fff59d;padding:22px 26px;width:300px;font-size:24px;line-height:1.5;box-shadow:4px 6px 12px rgba(0,0,0,.25);">
    Shopping list<br>– milk<br>– bread<br>– 12 eggs<br>– apples
  </div>
</div>`;

const vcf = `##fileformat=VCFv4.2
##source=GeneGuardSyntheticSample
##reference=GRCh38
##INFO=<ID=GENE,Number=1,Type=String,Description="Gene symbol">
##INFO=<ID=CLNSIG,Number=.,Type=String,Description="Clinical significance (annotation)">
##FILTER=<ID=LowQual,Description="Low quality call">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
##FORMAT=<ID=GQ,Number=1,Type=Integer,Description="Genotype quality">
##FORMAT=<ID=DP,Number=1,Type=Integer,Description="Read depth">
##comment=SYNTHETIC SAMPLE FOR EDUCATION - NOT A REAL PERSON
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	SAMPLE
chr10	112998590	rs7903146	C	T	99	PASS	GENE=TCF7L2	GT:GQ:DP	0/1:99:41
chr16	53786615	rs9939609	T	A	99	PASS	GENE=FTO	GT:GQ:DP	1/1:99:37
chr9	22125504	rs1333049	G	C	99	PASS	GENE=CDKN2B-AS1	GT:GQ:DP	0/1:99:44
chr19	44908684	rs429358	T	C	99	PASS	GENE=APOE	GT:GQ:DP	0/0:99:39
chr19	44908822	rs7412	C	T	99	PASS	GENE=APOE	GT:GQ:DP	0/1:99:36
chr11	5227002	rs334	T	A	88	PASS	GENE=HBB;CLNSIG=Pathogenic	GT:GQ:DP	0/1:88:33
chr6	26092913	rs1800562	G	A	95	PASS	GENE=HFE	GT:GQ:DP	0/0:95:40
chr1	169549811	.	C	T	14	LowQual	GENE=F5	GT:GQ:DP	0/1:11:6
chr13	32340300	.	G	A	73	PASS	GENE=BRCA2;CLNSIG=Uncertain_significance	GT:GQ:DP	0/1:73:52
chr2	1500000	.	A	G	60	PASS	.	GT:GQ:DP	0/1:60:30
this line is not a VCF record and must be ignored
chrUn_KI270742v1	5000	.	A	C	50	PASS	.	GT	0/1
`;

const raw = `# This data file was generated for GeneGuard AI as a SYNTHETIC SAMPLE (23andMe-style format).
# It does not describe any real person. Positions are illustrative; GeneGuard matches markers by rsID.
# rsid	chromosome	position	genotype
rs7903146	10	112998590	TT
rs1801282	3	12351626	CC
rs5219	11	17388025	CT
rs13266634	8	117172544	CC
rs9939609	16	53786615	AT
rs17782313	18	60183864	TC
rs6548238	2	634905	CC
rs1333049	9	22125504	CC
rs10455872	6	160589086	AG
rs11591147	1	55039974	GG
rs17249754	12	89666809	GG
rs699	1	230710048	AG
rs5186	3	148742201	AC
rs429358	19	44908684	TT
rs7412	19	44908822	CT
rs1800562	6	26092913	GG
rs1799945	6	26090951	CG
rs6025	1	169549811	CT
rs1801133	1	11796321	AG
rs4477212	1	82154	AA
rs3094315	1	752566	AG
rs12124819	1	776546	--
`;

writeFileSync(path.join(out, 'sample-variants.vcf'), vcf);
writeFileSync(path.join(out, 'sample-raw-data.txt'), raw);

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ deviceScaleFactor: 1.5 });
const render = async (html, file, { pdf = false } = {}) => {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  if (pdf) {
    await page.pdf({ path: path.join(out, file), format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
  } else {
    const el = await page.$('body > *');
    await el.screenshot({ path: path.join(out, file) });
  }
  console.log('  wrote', file);
};

await render(labReport, 'sample-lab-report.png');
await render(labReport, 'sample-lab-report.pdf', { pdf: true });
await render(partial, 'sample-partial-screenshot.png');
await render(karyotype, 'sample-karyotype-report.png');
await render(notGenetic, 'not-genetic-photo.png');

// "Scanned" PDF: the report photo placed as an image (slightly rotated, grey paper), so the PDF has no text layer.
const png = (await import('node:fs')).readFileSync(path.join(out, 'sample-lab-report.png')).toString('base64');
await render(
  `<div style="background:#e9e7e1;padding:18px;"><img src="data:image/png;base64,${png}" style="width:100%;transform:rotate(0.6deg);filter:contrast(0.92) brightness(0.97);"></div>`,
  'sample-scanned-report.pdf',
  { pdf: true },
);

await browser.close();
console.log('Samples written to public/samples/');
