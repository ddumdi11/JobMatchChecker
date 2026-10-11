/**
 * Datums-Bausteine für den KI-Extraktions-Prompt (aiExtractionService).
 *
 * Eigenes Modul ohne Electron-/Provider-Abhängigkeiten, damit es in CI
 * testbar ist (aiExtractionService lädt electron-store beim Import).
 *
 * Hintergrund: Ohne heutiges Datum im Prompt rechnet die KI relative
 * Angaben wie "Vor 2 Tagen veröffentlicht" (XING-Standard) von ihrem
 * eigenen, veralteten "heute" zurück und erfindet ein Datum
 * (Praxistest: 14.01.2025 statt Oktober 2026).
 */

import { toLocalIsoDate } from '../../shared/jobFormDefaults';

/**
 * Prompt-Feldbeschreibung für postedDate inkl. heutigem LOKALEM Datum.
 *
 * Vorrang: Stehen absolute und relative Angabe im Text, gilt das explizite
 * absolute Datum. Relative Angaben altern zwischen Kopieren und Einfügen, und
 * ein von Hand eingefügtes absolutes Datum ist eine bewusste Nutzer-Korrektur,
 * die nie von einer Umrechnung überstimmt werden darf
 * (Hierarchie: Nutzereingabe > Anzeigentext > Gestern-Default).
 */
export function buildPostedDateInstruction(now: Date = new Date()): string {
  // Datum UND Uhrzeit aus demselben `now` – sonst entsteht um Mitternacht ein
  // inkonsistentes Paar. Die Uhrzeit braucht die KI für Stunden-Angaben
  // ("vor 18 Stunden" kann je nach Tageszeit heute oder gestern sein).
  const today = toLocalIsoDate(now);
  const time = formatLocalTimeWithOffset(now);
  return `- postedDate (string, format: YYYY-MM-DD): Date THIS job was posted. Today's date is ${today}. ` +
    `Current local time: ${time}. ` +
    `If the text gives an absolute date, use it. If it gives a relative date ` +
    `(e.g. "Vor 2 Tagen veröffentlicht", "vor 18 Stunden", "heute", "gestern", "2 days ago"), ` +
    `calculate it from today's date (${today}); for hour-based ones, subtract from the current ` +
    `local time to get the correct day. PRECEDENCE: if the text contains BOTH an explicit ` +
    `absolute posting date (e.g. "Veröffentlichungsdatum: 01.10.2026", "Datum: 01.10.2026", ` +
    `"veröffentlicht am 01.10.2026") AND a relative one, ALWAYS use the absolute date - regardless ` +
    `of where in the text it appears. Ignore dates that belong to other/similar job ` +
    `listings shown on the same page. If the text contains no posting date at all, omit this field ` +
    `- never guess.`;
}

/** Lokale Uhrzeit mit UTC-Offset, z. B. "10:00 (UTC+02:00)". */
function formatLocalTimeWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ` +
    `(UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)})`;
}

/**
 * Plausibilisiert ein KI-geliefertes Datum: nur ein vollständiges YYYY-MM-DD
 * oder ein sauberes ISO-Datetime (YYYY-MM-DDThh:mm[:ss[.sss]][Z|±hh:mm]).
 * Ungültig, mit Anhängsel oder nach dem heutigen lokalen Tag → undefined
 * (das Formular belegt dann "gestern" vor).
 */
export function sanitizePostedDate(value: unknown, now: Date = new Date()): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(date.getTime()) || toLocalIsoDate(date) !== `${y}-${m}-${d}`) return undefined;
  if (toLocalIsoDate(date) > toLocalIsoDate(now)) return undefined;
  return `${y}-${m}-${d}`;
}
