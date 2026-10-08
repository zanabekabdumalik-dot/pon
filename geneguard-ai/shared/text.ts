/** Lower-cases only the first letter, keeping acronyms and gene symbols intact ("Obesity (BMI)" → "obesity (BMI)"). */
export function lowerFirst(s: string): string {
  if (!s) return s;
  if (/^[A-Z0-9]{2,}/.test(s)) return s; // starts with an acronym such as "HbS" or "BRCA1"
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
