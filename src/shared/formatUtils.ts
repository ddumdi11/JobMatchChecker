/**
 * Gemeinsame Formatierungs-Helfer für die UI (deutsches Format + Fallbacks).
 * Zentral, damit Dialoge und Seiten identisch formatieren.
 */

/**
 * Formatiert ein Datum im deutschen Format (TT.MM.JJJJ).
 * Fallback bei fehlendem/ungültigem Wert: "unbekannt".
 */
export function formatGermanDate(value: Date | string | null | undefined): string {
  if (!value) return 'unbekannt';
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime())
    ? 'unbekannt'
    : d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Einheitliche Job-Referenz für die UI: "#406 · Expert DevSecOps …".
 * EIN gemeinsamer Helfer für Liste, Kopfzeilen und Dialoge (keine Format-Drift).
 * Leerer/fehlender Titel → "#406 · (ohne Titel)".
 */
export function formatJobRef(id: number, title: string | null | undefined): string {
  const t = typeof title === 'string' ? title.trim() : '';
  return `${formatJobId(id)}${JOB_REF_SEPARATOR}${t || '(ohne Titel)'}`;
}

/** ID-Teil der Job-Referenz ("#406") – für Kopfzeilen, die ID und Titel getrennt stylen. */
export function formatJobId(id: number): string {
  return `#${id}`;
}

/** Trenner zwischen ID und Titel in der Job-Referenz. */
export const JOB_REF_SEPARATOR = ' · ';

/**
 * Formatiert einen Match-Score. Fallback bei null/undefined: "—".
 */
export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? '—' : `${score}`;
}
