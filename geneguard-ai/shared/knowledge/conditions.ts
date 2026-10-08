import type { Category, Recommendation, SourceRef } from '../types';
import {
  ACMG_GUIDELINE,
  external,
  gwasSearch,
  medlineCondition,
  medlineTopic,
  nih,
  omimEntry,
  pubmed,
} from './sources';

export interface ConditionInfo {
  key: string;
  name: string;
  category: Category;
  aliases: string[]; // lower-case phrases used to recognise the condition in report text
  summary: string; // plain language, no jargon
  inheritance: string;
  lifestyle: { factor: string; why: string }[];
  monitoring: { item: string; why: string }[];
  recommendations: Omit<Recommendation, 'id' | 'related'>[];
  sources: SourceRef[];
}

const counselor: Omit<Recommendation, 'id' | 'related'> = {
  kind: 'professional',
  title: 'Discuss significant findings with a healthcare professional',
  detail:
    'A specialist can confirm the result with clinical-grade testing, explain what it means for you personally and help plan next steps.',
};

export const CONDITIONS: Record<string, ConditionInfo> = {
  hboc: {
    key: 'hboc',
    name: 'Hereditary breast and ovarian cancer susceptibility',
    category: 'monogenic',
    aliases: ['hereditary breast and ovarian cancer', 'hboc', 'breast cancer', 'ovarian cancer', 'hereditary cancer'],
    summary:
      'BRCA1 and BRCA2 normally help repair damaged DNA. People who inherit a pathogenic variant in one of these genes have a higher lifetime chance of developing certain cancers — mainly breast and ovarian cancer, and to a lesser degree prostate and pancreatic cancer — than the general population. Many carriers never develop cancer, and specialist-guided screening can help find problems early.',
    inheritance: 'Autosomal dominant — one copy is enough to increase susceptibility; each child has a 50% chance to inherit it.',
    lifestyle: [
      { factor: 'Limit alcohol', why: 'Alcohol is a known risk factor for breast cancer in everyone.' },
      { factor: 'Regular physical activity', why: 'Supports a healthy weight and overall cancer-related health.' },
      { factor: 'Avoid smoking', why: 'Smoking increases the risk of many cancers.' },
    ],
    monitoring: [
      {
        item: 'Personalised cancer screening plan',
        why: 'For people with a pathogenic BRCA variant, specialists often recommend screening that starts earlier or is more frequent than usual.',
      },
      { item: 'Family history review', why: 'Relatives may also carry the variant and could be offered testing.' },
    ],
    recommendations: [
      counselor,
      {
        kind: 'family',
        title: 'Consider informing close relatives',
        detail:
          'Parents, siblings and children each have a 50% chance of carrying the same variant. A genetic counselor can explain "cascade testing" for family members.',
      },
      {
        kind: 'monitoring',
        title: 'Ask about appropriate screening',
        detail: 'Only a specialist can decide which screening tests and schedule are appropriate for you.',
      },
    ],
    sources: [
      medlineCondition('breast-cancer', 'Breast cancer'),
      nih('https://www.cancer.gov/about-cancer/causes-prevention/genetics/brca-fact-sheet', 'National Cancer Institute: BRCA gene changes'),
      omimEntry('604370', 'Breast-ovarian cancer, familial, 1'),
    ],
  },
  cf: {
    key: 'cf',
    name: 'Cystic fibrosis',
    category: 'monogenic',
    aliases: ['cystic fibrosis', 'mucoviscidosis'],
    summary:
      'Cystic fibrosis mainly affects the lungs and digestive system: mucus becomes thick and sticky. It happens when a person inherits two disease-causing CFTR variants, one from each parent. People with only one variant are "carriers" and usually have no symptoms.',
    inheritance: 'Autosomal recessive — two disease-causing copies are needed for the condition; one copy means carrier status.',
    lifestyle: [],
    monitoring: [
      {
        item: 'Partner carrier testing (family planning)',
        why: 'If both partners are carriers, each pregnancy has a 25% chance of a child with cystic fibrosis.',
      },
    ],
    recommendations: [
      {
        kind: 'family',
        title: 'Carrier status matters for family planning',
        detail: 'A genetic counselor can explain partner testing and what carrier status means for future children.',
      },
    ],
    sources: [
      medlineCondition('cystic-fibrosis', 'Cystic fibrosis'),
      omimEntry('219700', 'Cystic fibrosis'),
      external('CFTR2', 'https://cftr2.org/', 'CFTR2: clinical and functional translation of CFTR variants'),
    ],
  },
  scd: {
    key: 'scd',
    name: 'Sickle cell disease',
    category: 'monogenic',
    aliases: ['sickle cell', 'sickle-cell', 'hbss', 'hbsc', 'sickle cell trait'],
    summary:
      'Sickle cell disease changes the shape of red blood cells, which can block small blood vessels and cause pain and anaemia. It occurs when a person inherits two altered beta-globin genes (for example two copies of HbS). One copy is called sickle cell trait and usually causes no symptoms.',
    inheritance: 'Autosomal recessive — two altered copies cause the disease; one copy is a "trait" (carrier).',
    lifestyle: [
      {
        factor: 'Hydration and gradual training during intense exercise',
        why: 'People with sickle cell trait are advised to stay well hydrated, especially during intense exertion, heat or high altitude.',
      },
    ],
    monitoring: [
      {
        item: 'Partner testing (family planning)',
        why: 'If both partners carry a beta-globin variant, children may inherit sickle cell disease.',
      },
    ],
    recommendations: [
      {
        kind: 'family',
        title: 'Sickle cell trait is relevant for family planning',
        detail: 'A doctor or genetic counselor can explain what carrier status means for future children.',
      },
    ],
    sources: [
      medlineCondition('sickle-cell-disease', 'Sickle cell disease'),
      nih('https://www.nhlbi.nih.gov/health/sickle-cell-disease', 'NHLBI: Sickle cell disease'),
      omimEntry('603903', 'Sickle cell anemia'),
    ],
  },
  marfan: {
    key: 'marfan',
    name: 'Marfan syndrome',
    category: 'monogenic',
    aliases: ['marfan'],
    summary:
      'Marfan syndrome affects connective tissue — the "glue" that supports the heart and blood vessels, eyes and skeleton. Its most important feature is possible widening of the aorta. The diagnosis is made by specialists using clinical criteria, not by a single genetic result.',
    inheritance: 'Autosomal dominant — one altered copy can cause the condition.',
    lifestyle: [
      {
        factor: 'Choose activities with a cardiologist',
        why: 'Some intense or contact sports may not be suitable when the aorta is affected.',
      },
    ],
    monitoring: [
      { item: 'Heart and aorta check (echocardiography)', why: 'Schedule set by a cardiologist if the condition is suspected.' },
      { item: 'Eye examination', why: 'Lens problems are common in Marfan syndrome.' },
    ],
    recommendations: [counselor],
    sources: [
      medlineCondition('marfan-syndrome', 'Marfan syndrome'),
      omimEntry('154700', 'Marfan syndrome'),
      external('The Marfan Foundation', 'https://marfan.org/', 'The Marfan Foundation'),
    ],
  },
  fh: {
    key: 'fh',
    name: 'Familial hypercholesterolemia',
    category: 'monogenic',
    aliases: ['familial hypercholesterolemia', 'familial hypercholesterolaemia', 'hypercholesterolemia', 'familial defective apob'],
    summary:
      'Familial hypercholesterolemia (FH) causes high LDL ("bad") cholesterol from birth, which raises the risk of heart disease at a younger age. It is common (about 1 in 250 people) and very treatable once it is found.',
    inheritance: 'Autosomal dominant — one altered copy is enough; each child has a 50% chance to inherit it.',
    lifestyle: [
      { factor: 'Heart-healthy diet', why: 'Less saturated fat and more fibre helps lower LDL cholesterol.' },
      { factor: 'Regular physical activity', why: 'Supports heart and blood-vessel health.' },
      { factor: 'Avoid smoking', why: 'Smoking multiplies the cardiovascular risk of high cholesterol.' },
    ],
    monitoring: [
      { item: 'Cholesterol blood test (lipid profile)', why: 'Shows whether LDL is raised; a doctor decides what to do next.' },
      { item: 'Cholesterol checks for relatives', why: 'FH runs in families and early detection helps.' },
    ],
    recommendations: [
      counselor,
      {
        kind: 'family',
        title: 'Relatives may benefit from a cholesterol test',
        detail: 'Because FH is dominant, parents, siblings and children have a 50% chance of having it too.',
      },
    ],
    sources: [
      medlineCondition('familial-hypercholesterolemia', 'Familial hypercholesterolemia'),
      omimEntry('143890', 'Hypercholesterolemia, familial, 1'),
      external('The FH Foundation', 'https://thefhfoundation.org/', 'The Family Heart Foundation (FH)'),
    ],
  },
  hemochromatosis: {
    key: 'hemochromatosis',
    name: 'Hereditary hemochromatosis (HFE-related)',
    category: 'monogenic',
    aliases: ['hemochromatosis', 'haemochromatosis', 'iron overload'],
    summary:
      'In hereditary hemochromatosis the body absorbs too much iron from food, and over many years iron can build up in organs such as the liver. Most people with the genetic change never develop serious problems, and iron levels are easy to check with a blood test.',
    inheritance: 'Autosomal recessive with low penetrance — usually two copies of C282Y are involved, and many people with them stay healthy.',
    lifestyle: [
      {
        factor: 'Avoid iron supplements unless a doctor recommends them',
        why: 'Extra iron is unnecessary when the body already absorbs more than usual.',
      },
      { factor: 'Limit alcohol', why: 'Alcohol and iron overload both stress the liver.' },
    ],
    monitoring: [
      { item: 'Iron studies (ferritin, transferrin saturation)', why: 'Ask your doctor whether these blood tests are appropriate.' },
    ],
    recommendations: [counselor],
    sources: [
      medlineCondition('hereditary-hemochromatosis', 'Hereditary hemochromatosis'),
      omimEntry('235200', 'Hemochromatosis, type 1'),
    ],
  },
  fvl: {
    key: 'fvl',
    name: 'Factor V Leiden thrombophilia',
    category: 'monogenic',
    aliases: ['factor v leiden', 'thrombophilia', 'venous thrombosis'],
    summary:
      'Factor V Leiden makes blood slightly more likely to clot. It increases the chance of clots in the veins (deep vein thrombosis or pulmonary embolism), but most people with it never have a clot.',
    inheritance: 'Autosomal dominant risk factor — one copy raises risk moderately, two copies more.',
    lifestyle: [
      { factor: 'Keep moving on long journeys and stay hydrated', why: 'Long periods of sitting increase clot risk.' },
      { factor: 'Avoid smoking', why: 'Smoking further increases clotting risk.' },
    ],
    monitoring: [
      {
        item: 'Tell doctors about this result',
        why: 'It is relevant before surgery, during pregnancy, or when estrogen-containing medicines are being considered.',
      },
    ],
    recommendations: [counselor],
    sources: [
      medlineCondition('factor-v-leiden-thrombophilia', 'Factor V Leiden thrombophilia'),
      omimEntry('188055', 'Thrombophilia due to activated protein C resistance'),
    ],
  },
  prothrombin: {
    key: 'prothrombin',
    name: 'Prothrombin thrombophilia',
    category: 'monogenic',
    aliases: ['prothrombin thrombophilia', 'prothrombin g20210a', 'g20210a'],
    summary:
      'The prothrombin G20210A variant increases the amount of a clotting protein in the blood, which raises the chance of clots in the veins. Most people with it never have a clot.',
    inheritance: 'Autosomal dominant risk factor — one copy raises risk moderately.',
    lifestyle: [
      { factor: 'Keep moving on long journeys and stay hydrated', why: 'Long periods of sitting increase clot risk.' },
      { factor: 'Avoid smoking', why: 'Smoking further increases clotting risk.' },
    ],
    monitoring: [
      {
        item: 'Tell doctors about this result',
        why: 'It is relevant before surgery, during pregnancy, or when estrogen-containing medicines are being considered.',
      },
    ],
    recommendations: [counselor],
    sources: [medlineCondition('prothrombin-thrombophilia', 'Prothrombin thrombophilia'), omimEntry('176930', 'Coagulation factor II (F2)')],
  },
  homocysteine: {
    key: 'homocysteine',
    name: 'Homocysteine level (MTHFR)',
    category: 'multifactorial',
    aliases: ['homocysteine', 'mthfr deficiency'],
    summary:
      'MTHFR helps the body process folate. The common C677T variant slightly lowers enzyme activity. Two copies may be linked to mildly higher homocysteine, especially when folate intake is low, but this has not been shown to be a reliable predictor of disease.',
    inheritance: 'Common variant — not a disease-causing mutation.',
    lifestyle: [{ factor: 'Balanced diet with folate-rich foods', why: 'Leafy greens, legumes and whole grains provide folate.' }],
    monitoring: [],
    recommendations: [],
    sources: [
      pubmed('23288205', 'ACMG practice guideline: lack of evidence for MTHFR polymorphism testing (2013)'),
      medlineCondition('homocystinuria', 'Homocystinuria (for comparison: the rare severe form)'),
    ],
  },
  t2d: {
    key: 't2d',
    name: 'Type 2 diabetes',
    category: 'multifactorial',
    aliases: ['type 2 diabetes', 't2d', 'diabetes mellitus type 2'],
    summary:
      'Type 2 diabetes develops when the body does not respond well to insulin or does not make enough of it. Many genes each add a small effect, but body weight, diet, physical activity, sleep and age matter a lot.',
    inheritance: 'Multifactorial — many genetic variants plus lifestyle and environment.',
    lifestyle: [
      { factor: 'Regular physical activity', why: 'Improves how the body uses insulin.' },
      { factor: 'Healthy body weight', why: 'Excess weight is the strongest modifiable risk factor for type 2 diabetes.' },
      { factor: 'Fibre-rich diet, fewer sugary drinks', why: 'Helps keep blood sugar stable.' },
      { factor: 'Healthy sleep', why: 'Chronic short sleep is linked to worse blood-sugar control.' },
    ],
    monitoring: [{ item: 'Blood glucose / HbA1c checks', why: 'As recommended by your doctor during routine check-ups.' }],
    recommendations: [],
    sources: [medlineTopic('diabetestype2.html', 'Type 2 diabetes'), gwasSearch('type 2 diabetes')],
  },
  cad: {
    key: 'cad',
    name: 'Coronary artery disease',
    category: 'multifactorial',
    aliases: ['coronary artery disease', 'coronary heart disease', 'cad', 'heart disease', 'myocardial infarction'],
    summary:
      'Coronary artery disease is narrowing of the arteries that supply the heart. Genetics contributes, but smoking, blood pressure, cholesterol, diabetes, diet and physical activity are major factors.',
    inheritance: 'Multifactorial — many genetic variants plus lifestyle and environment.',
    lifestyle: [
      { factor: 'Avoid smoking', why: 'Smoking is one of the strongest risk factors for heart disease.' },
      { factor: 'Regular physical activity', why: 'Strengthens the heart and improves cholesterol and blood pressure.' },
      { factor: 'Heart-healthy diet', why: 'Vegetables, fruit, whole grains and less saturated fat support heart health.' },
    ],
    monitoring: [
      { item: 'Blood pressure and cholesterol checks', why: 'These are the main measurable heart-risk markers.' },
      { item: 'Ask whether a lipoprotein(a) test is appropriate', why: 'Lp(a) is largely genetically determined and is measured with a blood test.' },
    ],
    recommendations: [],
    sources: [medlineTopic('coronaryarterydisease.html', 'Coronary artery disease'), gwasSearch('coronary artery disease')],
  },
  obesity: {
    key: 'obesity',
    name: 'Obesity-related risk (body mass index)',
    category: 'multifactorial',
    aliases: ['obesity', 'body mass index', 'bmi'],
    summary:
      'Body weight is influenced by hundreds of genetic variants, each with a tiny effect, together with diet, activity, sleep and environment. Studies suggest that physical activity can reduce the effect of some of these variants (for example in FTO).',
    inheritance: 'Multifactorial — many genetic variants plus lifestyle and environment.',
    lifestyle: [
      { factor: 'Regular physical activity', why: 'Studies suggest activity weakens the effect of FTO risk variants on body weight.' },
      { factor: 'Balanced diet, fewer ultra-processed foods', why: 'Supports a healthy energy balance.' },
      { factor: 'Healthy sleep', why: 'Short sleep is associated with weight gain.' },
    ],
    monitoring: [{ item: 'Weight and waist measurement at check-ups', why: 'Simple markers of metabolic health.' }],
    recommendations: [],
    sources: [medlineTopic('obesity.html', 'Obesity'), gwasSearch('body mass index')],
  },
  hypertension: {
    key: 'hypertension',
    name: 'Hypertension (high blood pressure)',
    category: 'multifactorial',
    aliases: ['hypertension', 'high blood pressure', 'blood pressure'],
    summary:
      'Blood pressure is shaped by many genes with small effects and strongly by salt intake, weight, physical activity, alcohol, stress and age.',
    inheritance: 'Multifactorial — many genetic variants plus lifestyle and environment.',
    lifestyle: [
      { factor: 'Reduce salt', why: 'Lower salt intake lowers blood pressure in most people.' },
      { factor: 'Regular physical activity', why: 'Helps keep blood pressure in a healthy range.' },
      { factor: 'Limit alcohol', why: 'Alcohol raises blood pressure.' },
    ],
    monitoring: [{ item: 'Regular blood pressure measurement', why: 'High blood pressure often has no symptoms.' }],
    recommendations: [],
    sources: [medlineTopic('highbloodpressure.html', 'High blood pressure'), gwasSearch('blood pressure')],
  },
  alzheimers: {
    key: 'alzheimers',
    name: "Late-onset Alzheimer's disease",
    category: 'multifactorial',
    aliases: ["alzheimer's", 'alzheimer', 'dementia'],
    summary:
      "Alzheimer's disease is the most common cause of dementia in older age. The APOE ε4 allele is the strongest common genetic risk factor, but it is neither necessary nor sufficient: many people with ε4 never develop Alzheimer's, and many people who develop it have no ε4.",
    inheritance: 'Multifactorial — APOE plus many other genes, age and lifestyle.',
    lifestyle: [
      { factor: 'Regular physical activity', why: 'Associated with better brain and heart health.' },
      { factor: 'Healthy blood pressure', why: 'Good cardiovascular health is linked to lower dementia risk.' },
      { factor: 'Cognitive and social engagement', why: 'Learning and staying socially active are associated with healthy ageing.' },
      { factor: 'Healthy sleep', why: 'Supports long-term brain health.' },
    ],
    monitoring: [
      {
        item: 'Talk to a genetic counselor before acting on APOE results',
        why: 'APOE testing is generally not recommended for predicting Alzheimer’s in people without symptoms.',
      },
    ],
    recommendations: [
      {
        kind: 'professional',
        title: 'APOE results deserve careful counselling',
        detail:
          'An APOE result can be emotionally significant. A genetic counselor can explain what it does and does not mean. No lifestyle change is proven to prevent Alzheimer’s, but heart-healthy habits support brain health.',
      },
    ],
    sources: [
      medlineCondition('alzheimer-disease', 'Alzheimer disease'),
      nih(
        'https://www.nia.nih.gov/health/alzheimers-causes-and-risk-factors/alzheimers-disease-genetics-fact-sheet',
        "National Institute on Aging: Alzheimer's disease genetics",
      ),
      omimEntry('104310', 'Alzheimer disease, late onset'),
    ],
  },
};

export const GENERAL_RECOMMENDATIONS: Omit<Recommendation, 'id' | 'related'>[] = [
  {
    kind: 'lifestyle',
    title: 'Maintain regular physical activity',
    detail: 'Regular movement supports heart, metabolic and mental health for everyone, whatever their genes.',
  },
  {
    kind: 'lifestyle',
    title: 'Follow a balanced diet',
    detail: 'Plenty of vegetables, fruit, legumes and whole grains; fewer sugary drinks and ultra-processed foods.',
  },
  { kind: 'lifestyle', title: 'Avoid smoking', detail: 'Not smoking is one of the most effective ways to reduce the risk of many diseases.' },
  { kind: 'lifestyle', title: 'Maintain healthy sleep', detail: 'Regular, sufficient sleep supports metabolic and brain health.' },
  {
    kind: 'monitoring',
    title: 'Monitor relevant health markers when appropriate',
    detail: 'Routine check-ups (blood pressure, cholesterol, blood sugar) as recommended by your doctor.',
  },
  {
    kind: 'professional',
    title: 'Discuss significant genetic findings with a doctor or genetic counselor',
    detail: 'Never start, stop or change any treatment based on this educational report.',
  },
];

export const ACMG_SOURCE = ACMG_GUIDELINE;
