/**
 * Rauschen am Textende kappen (fremde Anzeigen, Navigation, Fußzeile).
 *
 * Der Rohtext (full_text) bleibt unverändert; gespeichert wird nur eine
 * Schnittposition (job_offers.full_text_cut):
 *   null / undefined = noch nie bewertet → Regel mit der aktuellen Markerliste
 *   0 (NO_TEXT_CUT)  = bewusst kein Schnitt
 *   > 0              = gespeicherter Schnitt
 *
 * Regel: Schnitt am frühesten Marker, der in der hinteren Texthälfte beginnt.
 * Positionen sind JS-String-Indizes – nur hier anwenden, nie per SQL substr.
 */

import type { TextCutResolution } from './types';

export const NO_TEXT_CUT = 0;

/** Frühester Marker ab der Texthälfte, sonst null. */
export function findTextCut(
  text: string,
  markers: readonly string[]
): { position: number; marker: string } | null {
  const half = Math.floor(text.length / 2);
  let best: { position: number; marker: string } | null = null;
  for (const marker of markers) {
    if (!marker) continue;
    const position = text.indexOf(marker, half);
    if (position > 0 && (best === null || position < best.position)) {
      best = { position, marker };
    }
  }
  return best;
}

/** Ein gespeicherter Schnitt ist nur gültig, wenn er innerhalb des Textes liegt. */
function isValidStoredCut(text: string, storedCut: number): boolean {
  return Number.isInteger(storedCut) && storedCut > 0 && storedCut < text.length;
}

/**
 * Welcher Schnitt gilt für diesen Text?
 * Ein ungültiger gespeicherter Wert (z. B. nach Textänderung außerhalb der App)
 * wird wie "noch nie bewertet" behandelt.
 */
export function resolveTextCut(
  text: string | null | undefined,
  storedCut: number | null | undefined,
  markers: readonly string[]
): TextCutResolution {
  const t = text ?? '';
  if (storedCut === NO_TEXT_CUT) {
    return { position: null, marker: null, source: 'disabled' };
  }
  if (typeof storedCut === 'number' && isValidStoredCut(t, storedCut)) {
    const marker = markers.find(m => m && t.startsWith(m, storedCut)) ?? null;
    return { position: storedCut, marker, source: 'stored' };
  }
  const found = findTextCut(t, markers);
  return found
    ? { position: found.position, marker: found.marker, source: 'rule' }
    : { position: null, marker: null, source: 'none' };
}

/** Text, den Matching und Exporte bekommen. */
export function getEffectiveText(
  text: string | null | undefined,
  storedCut: number | null | undefined,
  markers: readonly string[]
): string {
  const t = text ?? '';
  const { position } = resolveTextCut(t, storedCut, markers);
  return position === null ? t : t.slice(0, position).trimEnd();
}

/**
 * Wert für full_text_cut beim Speichern aus dem Formular: Schnitt übernehmen,
 * bewusst abgewählt (0) oder kein Marker gefunden (null = Regel gilt weiter).
 */
export function textCutToStore(
  text: string,
  markers: readonly string[],
  cutDisabled: boolean
): number | null {
  const found = findTextCut(text, markers);
  if (!found) return null;
  return cutDisabled ? NO_TEXT_CUT : found.position;
}
