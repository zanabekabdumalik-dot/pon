import type { SourceRef } from '../types';
import { medlineCondition, omimEntry } from './sources';

export interface ChromosomalCondition {
  key: string;
  name: string;
  notation: string; // typical karyotype notation
  aliases: string[]; // lower-case phrases used to recognise statements in reports
  meaning: string;
  confirmation: string;
  detectableByKaryotype: boolean; // large numerical changes yes; microdeletions no
  sources: SourceRef[];
}

export const CHROMOSOMAL_CONDITIONS: ChromosomalCondition[] = [
  {
    key: 'trisomy21',
    name: 'Trisomy 21 (Down syndrome)',
    notation: '47,XX,+21 / 47,XY,+21',
    aliases: ['trisomy 21', 'down syndrome', "down's syndrome", 'downs syndrome', 't21'],
    meaning:
      'An extra copy of chromosome 21. It is associated with characteristic physical features, some degree of intellectual disability and a higher chance of certain health conditions (for example heart differences). Abilities vary widely, and many people with Down syndrome live full lives with appropriate support.',
    confirmation: 'Confirmed by chromosome analysis (karyotype) interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('down-syndrome', 'Down syndrome'), omimEntry('190685', 'Down syndrome')],
  },
  {
    key: 'trisomy18',
    name: 'Trisomy 18 (Edwards syndrome)',
    notation: '47,XX,+18 / 47,XY,+18',
    aliases: ['trisomy 18', 'edwards syndrome', "edwards' syndrome", 't18'],
    meaning: 'An extra copy of chromosome 18. It usually causes serious health problems that begin before birth.',
    confirmation: 'Confirmed by chromosome analysis interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('trisomy-18', 'Trisomy 18')],
  },
  {
    key: 'trisomy13',
    name: 'Trisomy 13 (Patau syndrome)',
    notation: '47,XX,+13 / 47,XY,+13',
    aliases: ['trisomy 13', 'patau syndrome', 't13'],
    meaning: 'An extra copy of chromosome 13. It usually causes serious health problems that begin before birth.',
    confirmation: 'Confirmed by chromosome analysis interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('trisomy-13', 'Trisomy 13')],
  },
  {
    key: 'monosomyX',
    name: 'Monosomy X (Turner syndrome)',
    notation: '45,X',
    aliases: ['turner syndrome', 'monosomy x', '45,x'],
    meaning:
      'One X chromosome instead of two in a female. It can be associated with shorter height and differences in ovarian development; heart and kidney checks are usually recommended.',
    confirmation: 'Confirmed by chromosome analysis interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('turner-syndrome', 'Turner syndrome')],
  },
  {
    key: 'xxy',
    name: '47,XXY (Klinefelter syndrome)',
    notation: '47,XXY',
    aliases: ['klinefelter', '47,xxy', 'xxy syndrome'],
    meaning: 'An extra X chromosome in a male. Effects are often mild and may include lower testosterone and reduced fertility.',
    confirmation: 'Confirmed by chromosome analysis interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('klinefelter-syndrome', 'Klinefelter syndrome')],
  },
  {
    key: 'xxx',
    name: '47,XXX (Triple X syndrome)',
    notation: '47,XXX',
    aliases: ['triple x', 'trisomy x', '47,xxx'],
    meaning: 'An extra X chromosome in a female. Many people have no or mild signs.',
    confirmation: 'Confirmed by chromosome analysis interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('triple-x-syndrome', 'Triple X syndrome')],
  },
  {
    key: 'xyy',
    name: '47,XYY syndrome',
    notation: '47,XYY',
    aliases: ['47,xyy', 'xyy syndrome'],
    meaning: 'An extra Y chromosome in a male. Many people have no or mild signs.',
    confirmation: 'Confirmed by chromosome analysis interpreted by a clinical geneticist.',
    detectableByKaryotype: true,
    sources: [medlineCondition('47xyy-syndrome', '47,XYY syndrome')],
  },
  {
    key: 'del22q11',
    name: '22q11.2 deletion syndrome',
    notation: 'del(22)(q11.2)',
    aliases: ['22q11.2 deletion', '22q11 deletion', 'digeorge', 'velocardiofacial', 'del(22)(q11'],
    meaning:
      'A small missing piece of chromosome 22. It can affect the heart, immune system, palate and learning. It is usually too small to be seen on a standard karyotype and is detected with chromosomal microarray or FISH.',
    confirmation: 'Confirmed by chromosomal microarray or FISH interpreted by a clinical geneticist.',
    detectableByKaryotype: false,
    sources: [medlineCondition('22q112-deletion-syndrome', '22q11.2 deletion syndrome')],
  },
];

export const CHROMOSOMAL_BY_KEY: Record<string, ChromosomalCondition> = Object.fromEntries(
  CHROMOSOMAL_CONDITIONS.map((c) => [c.key, c]),
);
