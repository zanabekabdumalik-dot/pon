// User-facing safety messages, used verbatim across the app.
export const MESSAGES = {
  noGeneticInfo: 'Unable to identify genetic information.',
  partial: 'Only partial genetic information was detected. This result cannot be used to evaluate your entire genetic profile.',
  insufficient: 'Insufficient genetic data.',
  unknownVariant: 'Variant detected, but clinical significance could not be established.',
  uncertain: 'Uncertain interpretation — consult a qualified healthcare professional.',
  evidenceInsufficient: 'Evidence is insufficient.',
  notDiagnosis: 'Risk category is not a diagnosis.',
  noInfo: "I don't have enough information to determine this.",
  predispositionNotDestiny: 'Genetic predisposition is not destiny.',
} as const;

export const DISCLAIMER =
  'GeneGuard AI is an educational decision-support prototype. It does not diagnose diseases, predict an individual\'s future with certainty, prescribe treatment, or replace a doctor or genetic counselor.';

export const CLINICAL_CONTEXT =
  'Genetic results should be interpreted in clinical context and significant findings should be confirmed using appropriate clinical testing.';

export const SYNTHETIC_NOTICE =
  "These are synthetic demonstration data and do not represent a real person's genetic profile.";
