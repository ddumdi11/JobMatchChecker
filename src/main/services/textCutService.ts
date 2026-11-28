/**
 * Markerliste aus der DB und bereinigter Volltext für Matching und Exporte.
 * Die Regel selbst liegt in src/shared/textCut.ts.
 */

import { getDatabase } from '../database/db';
import { getEffectiveText } from '../../shared/textCut';

export function getTextCutMarkers(): string[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT marker FROM text_cut_markers ORDER BY sort_order, id')
    .all() as Array<{ marker: string }>;
  return rows.map(r => r.marker).filter(Boolean);
}

/** Bereinigter Text einer job_offers-Zeile (snake_case, wie aus SELECT *). */
export function getEffectiveFullText(
  row: { full_text?: string | null; full_text_cut?: number | null },
  markers: readonly string[] = getTextCutMarkers()
): string {
  return getEffectiveText(row.full_text, row.full_text_cut, markers);
}
