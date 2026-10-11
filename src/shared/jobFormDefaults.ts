/**
 * Vorbelegungen für das Job-Erfassungsformular (JobAdd).
 * Reine Funktionen, damit sie ohne UI testbar sind.
 */

/** Lokales Kalenderdatum als YYYY-MM-DD (für <input type="date">). */
export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GESTERN (heute − 1) im LOKALEN Kalender als YYYY-MM-DD.
 * Rechnet über die lokalen Datumsfelder (nicht über UTC/ms-Subtraktion),
 * damit Monats-/Jahreswechsel und Zeitpunkte kurz nach Mitternacht stimmen.
 */
export function getYesterdayLocalIso(now: Date = new Date()): string {
  return toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

/**
 * Entscheidet die Quelle-Vorbelegung nach einer Extraktion:
 * - manuelle Auswahl übersteuert immer (bleibt unverändert),
 * - sonst der erkannte Treffer,
 * - kein Treffer → leer ('') – niemals raten.
 */
export function resolveSourceSelection(params: {
  currentSourceId: number | '';
  manuallySelected: boolean;
  detectedSourceId: number | null;
}): number | '' {
  if (params.manuallySelected) return params.currentSourceId;
  return params.detectedSourceId ?? '';
}
