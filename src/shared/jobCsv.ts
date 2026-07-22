/**
 * Job-CSV-Serialisierung: Spaltenprofile, Zell-Quoting und CSV-Aufbau.
 *
 * BEWUSST electron-frei und ohne DB-/Node-native Abhängigkeiten (nur reine
 * TS-Logik + `cleanJobUrl`/Labels aus anderen shared-Modulen). Dadurch von der
 * Electron-App UND von electron-fremden Konsumenten (nanobot-CLI unter Node)
 * gleichermaßen importierbar — die Lehre aus dem CI-Fund von PR #63.
 *
 * Wer DB liest (Export-Service via App-better-sqlite3, CLI via eigener
 * Node-ABI-Instanz), baut `JobCsvRow[]` und ruft `serializeJobsCsv` auf.
 */
import type { CsvColumnProfile } from './types';
import { cleanJobUrl } from './urlUtils';
import { getCategoryLabel, getStatusLabel } from './jobLabels';

/** Rohdaten einer Job-Zeile für die CSV-Serialisierung (DB-nah, snake_case). */
export interface JobCsvRow {
  title: string;
  company: string;
  match_score: number | null;
  match_category: string | null;
  status: string;
  source_name: string | null;
  url: string | null;
  created_at: string;
  posted_date: string | null;
}

export interface CsvColumn {
  header: string;
  value: (row: JobCsvRow) => string;
}

/**
 * Formatiert einen gespeicherten Datumswert als lokales ISO-Datum (YYYY-MM-DD)
 * – EXAKT wie die UI (`new Date(raw)` → lokaler Kalendertag). `created_at`
 * ("YYYY-MM-DD HH:MM:SS" ohne Zeitzone) wird von JS als LOKALZEIT gelesen,
 * `posted_date` (ISO mit "Z") als UTC; nur diese JS-Spiegelung trifft für beide
 * denselben Kalendertag wie die App.
 */
export function toLocalIsoDate(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Prüft, ob der lokale "hinzugefügt am"-Tag von `rawCreatedAt` im (inklusiven)
 * Bereich [from, to] liegt. from/to sind lokale ISO-Tage ('YYYY-MM-DD') oder
 * null (= keine Grenze). Ungültige/leere Daten fallen raus.
 */
export function localDateInRange(
  rawCreatedAt: string | Date | null | undefined,
  from: string | null,
  to: string | null
): boolean {
  const day = toLocalIsoDate(rawCreatedAt);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/**
 * CSV-Formel-Injection-Schutz: Werte, deren erstes Zeichen von Excel/Calc als
 * Formel-Auslöser interpretiert wird (= + - @), mit führendem Apostroph
 * neutralisieren. Score-Zahlen (0–100) und ISO-Daten (YYYY-…) beginnen nie mit
 * diesen Zeichen und bleiben unangetastet.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

/**
 * RFC4180-konformes Quoting: nur bei , " CR LF, innere " verdoppelt. Die
 * Formel-Neutralisierung läuft VOR dem Quoting, damit ein evtl. vorangestellter
 * Apostroph mit in die (ggf. gequotete) Zelle wandert.
 */
export function csvCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Spaltenprofile: bestimmen Auswahl UND Serialisierung der Zellen.
 * - `standard`: deutsche Labels für den Nutzer-Export.
 * - `nanobot`: Rohwerte für jobs_processed.csv (Rückkanal zur Pipeline),
 *   keine Labels; `url` als bereinigter URL-Key via cleanJobUrl,
 *   `processed_at` = lokaler "hinzugefügt am"-Tag.
 */
export const CSV_PROFILES: Record<CsvColumnProfile, CsvColumn[]> = {
  standard: [
    { header: 'Titel', value: r => r.title ?? '' },
    { header: 'Firma', value: r => r.company ?? '' },
    { header: 'Match-Score', value: r => (r.match_score == null ? '' : String(r.match_score)) },
    { header: 'Match-Kategorie', value: r => (r.match_category ? getCategoryLabel(r.match_category) : '') },
    { header: 'Status', value: r => getStatusLabel(r.status) },
    { header: 'Quelle', value: r => r.source_name ?? '' },
    { header: 'URL', value: r => r.url ?? '' },
    { header: 'hinzugefügt am', value: r => toLocalIsoDate(r.created_at) },
    { header: 'veröffentlicht am', value: r => toLocalIsoDate(r.posted_date) }
  ],
  nanobot: [
    { header: 'url', value: r => cleanJobUrl(r.url) ?? '' },
    { header: 'title', value: r => r.title ?? '' },
    { header: 'company', value: r => r.company ?? '' },
    { header: 'match_score', value: r => (r.match_score == null ? '' : String(r.match_score)) },
    { header: 'status', value: r => r.status ?? '' }, // Rohwert, kein Label
    { header: 'processed_at', value: r => toLocalIsoDate(r.created_at) }
  ]
};

/**
 * Baut den CSV-Inhalt (inkl. UTF-8-BOM, CRLF-Zeilen, abschließendem CRLF) für
 * die übergebenen Zeilen und das Spaltenprofil. Reine Funktion → direkt testbar.
 */
export function serializeJobsCsv(
  rows: JobCsvRow[],
  profile: CsvColumnProfile = 'standard'
): { csv: string; count: number } {
  const columns = CSV_PROFILES[profile];
  if (!columns || columns.length === 0) {
    throw new Error(`CSV-Profil "${profile}" ist nicht implementiert`);
  }

  const BOM = String.fromCharCode(0xFEFF); // UTF-8 BOM (Excel-freundlich)
  const lines: string[] = [];
  lines.push(columns.map(c => csvCell(c.header)).join(','));
  for (const r of rows) {
    lines.push(columns.map(c => csvCell(c.value(r))).join(','));
  }
  const csv = BOM + lines.join('\r\n') + '\r\n';
  return { csv, count: rows.length };
}
