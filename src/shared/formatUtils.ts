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
 * Formatiert einen Match-Score. Fallback bei null/undefined: "—".
 */
export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? '—' : `${score}`;
}
