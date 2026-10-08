// Core domain types shared by the browser app and the server.

export type InputKind = 'photo' | 'pdf' | 'vcf' | 'snp-array' | 'text' | 'manual' | 'demo';

export type DataScope =
  | 'targeted-report' // lab report listing specific variants
  | 'partial-report' // photo/screenshot showing only part of a report
  | 'snp-genotyping' // consumer SNP array raw data (23andMe-style)
  | 'vcf' // variant call format file
  | 'cytogenetic-report' // karyotype / chromosome analysis / NIPT
  | 'manual' // typed in by the user
  | 'synthetic-demo'
  | 'unknown';

export type Zygosity = 'heterozygous' | 'homozygous' | 'hemizygous' | 'homozygous-reference' | 'unknown';

export type Category = 'chromosomal' | 'monogenic' | 'multifactorial';

/** Visual risk scale. `not-assessable` is shown in grey. */
export type RiskLevel = 'low' | 'average' | 'elevated' | 'high' | 'not-assessable';

/** How much we trust the data + interpretation for this person. */
export type Confidence = 'high' | 'medium' | 'low' | 'insufficient';

/** How strong the published scientific evidence is. */
export type EvidenceLevel = 'high' | 'moderate' | 'limited' | 'unknown';

export type Significance =
  | 'pathogenic'
  | 'likely-pathogenic'
  | 'uncertain'
  | 'likely-benign'
  | 'benign'
  | 'risk-factor'
  | 'association'
  | 'protective'
  | 'not-provided';

export interface SourceRef {
  name: string; // e.g. "ClinVar"
  label: string; // e.g. "ClinVar: rs80357906"
  url: string;
}

/** A variant exactly as it was found in the user's data. Never auto-filled from the knowledge base. */
export interface ExtractedVariant {
  id: string;
  gene?: string;
  hgvsC?: string;
  hgvsP?: string;
  legacyName?: string;
  rsId?: string;
  chromosome?: string;
  position?: number;
  ref?: string;
  alt?: string;
  genotype?: string; // "C/T"
  zygosity?: Zygosity;
  reportedSignificance?: string; // as written in the report / file annotation
  reportedCondition?: string;
  labInterpretation?: string;
  quality?: number;
  filter?: string;
  readDepth?: number;
  genotypeQuality?: number;
  info?: Record<string, string>;
  source: InputKind;
  sourceText?: string; // the original line(s) the variant was read from
  userEdited?: boolean;
  demo?: boolean;
  fictional?: boolean;
}

export interface ChromosomalObservation {
  id: string;
  kind: 'karyotype' | 'statement' | 'screening';
  raw: string;
  conditionKey?: string; // undefined for a normal karyotype
  result: 'abnormal' | 'normal' | 'screen-positive' | 'screen-negative';
  method?: string;
  mosaic?: boolean;
}

export type WarningCode =
  | 'no-genetic-info'
  | 'partial'
  | 'insufficient'
  | 'skipped-lines'
  | 'low-ocr-confidence'
  | 'unknown-gene'
  | 'invalid-variant'
  | 'genotype-mismatch'
  | 'low-quality'
  | 'conflict'
  | 'truncated'
  | 'info';

export interface ParseWarning {
  code: WarningCode;
  message: string;
}

export interface ParseStats {
  totalRecords: number; // lines / records seen that looked like data
  keptRecords: number; // variants kept for analysis
  skippedLines: number;
  markersGenotyped?: number; // SNP files: number of genotyped markers
}

export interface PersonProfile {
  label: string;
  age?: number;
  sex?: string;
  synthetic: boolean;
}

export interface ParsedInput {
  kind: InputKind;
  fileName?: string;
  dataScope: DataScope;
  variants: ExtractedVariant[];
  chromosomal: ChromosomalObservation[];
  rawText?: string;
  ocrConfidence?: number; // 0-100
  ocrEngine?: string;
  warnings: ParseWarning[];
  stats: ParseStats;
  profile?: PersonProfile;
}

export interface Finding {
  id: string;
  category: Category;
  variantIds: string[];
  gene?: string;
  variantLabel: string;
  rsId?: string;
  genotype?: string;
  zygosity?: Zygosity;
  condition: string;
  conditionKey?: string;
  inheritance: string;
  significance: Significance;
  significanceLabel: string;
  significanceSource: 'knowledge-base' | 'clinvar-live' | 'report' | 'none';
  evidence: EvidenceLevel;
  confidence: Confidence;
  confidenceReason: string;
  risk: RiskLevel;
  riskHeadline: string;
  interpretation: string; // rule-based risk interpretation
  explanation: string; // plain-language explanation (built-in or AI)
  explanationSource: 'built-in' | 'ai';
  carrier: boolean;
  clinicallyRelevant: boolean;
  requiresConfirmation: boolean;
  knowledgeBaseId?: string;
  sources: SourceRef[];
  notes: string[];
  demo?: boolean;
}

export interface ChromosomalResult {
  conditionKey: string;
  name: string;
  status: 'detected' | 'screen-positive' | 'not-detected' | 'insufficient-data';
  risk: RiskLevel;
  meaning: string;
  reliability: Confidence;
  reliabilityReason: string;
  requiresConfirmation: boolean;
  evidenceText?: string; // what in the report supported this
  sources: SourceRef[];
}

export interface PrsContribution {
  rsId: string;
  gene: string;
  riskAllele: string;
  genotype: string;
  riskAlleleCount: number;
  oddsRatio: number;
  weight: number; // ln(OR)
}

export interface PrsResult {
  traitKey: string;
  trait: string;
  rawScore: number;
  zScore: number;
  percentile: number; // 0-100
  referencePopulation: string;
  variantsUsed: number;
  variantsInModel: number;
  missing: string[];
  excluded: { rsId: string; reason: string }[];
  confidence: Confidence;
  confidenceReason: string;
  risk: RiskLevel;
  statement: string;
  explanation: string;
  explanationSource: 'built-in' | 'ai';
  contributions: PrsContribution[];
  distribution: { score: number; probability: number }[]; // for the chart
  evidence: EvidenceLevel;
  sources: SourceRef[];
}

export interface CategorySummary {
  category: Category;
  risk: RiskLevel;
  headline: string;
  detail: string;
}

export interface Recommendation {
  id: string;
  kind: 'professional' | 'lifestyle' | 'monitoring' | 'family';
  title: string;
  detail: string;
  related: string[]; // condition names
}

export interface ChangeableFactors {
  genetic: string[];
  lifestyle: { factor: string; why: string }[];
  monitoring: { item: string; why: string }[];
}

export interface AnalysisReport {
  id: string;
  createdAt: string;
  input: {
    kind: InputKind;
    dataScope: DataScope;
    dataScopeLabel: string;
    fileName?: string;
    profile?: PersonProfile;
    variantsDetected: number;
    markersGenotyped?: number;
    knowledgeBaseMatches: number;
    clinicallyRelevant: number;
  };
  summary: Record<Category, CategorySummary>;
  overview: string;
  overviewSource: 'built-in' | 'ai';
  findings: Finding[];
  chromosomal: { assessable: boolean; reason: string; results: ChromosomalResult[] };
  prs: PrsResult[];
  testedNotDetected: { gene: string; variant: string; genotype?: string }[];
  notInterpreted: number; // variants with no knowledge-base entry that were not shown individually
  recommendations: Recommendation[];
  changeable: ChangeableFactors;
  doctorQuestions: string[];
  sources: SourceRef[];
  warnings: ParseWarning[];
  ai: { used: boolean; model?: string; note?: string; clinvarLive: boolean };
  disclaimers: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatReply {
  reply: string;
  engine: 'built-in' | 'ai';
  note?: string;
  sources: SourceRef[];
}

/** Result of an optional live lookup in NCBI ClinVar (server-side, opt-in). */
export interface ClinvarRecord {
  rsId: string;
  uid: string;
  title: string;
  gene?: string;
  significance: string;
  reviewStatus: string;
  conditions: string[];
  url: string;
}

export interface ServerStatus {
  ok: boolean;
  ai: { enabled: boolean; model?: string; vision: boolean };
  clinvarLookup: boolean;
  version: string;
}
