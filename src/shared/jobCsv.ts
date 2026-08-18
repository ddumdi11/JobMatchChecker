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

/**
 * DTO einer Job-Zeile für die CSV-Serialisierung – camelCase wie überall im
 * TS-Layer. snake_case bleibt nur in SQL (Spalten-Aliase → camelCase) und in
 * den CSV-Header-Strings (Wire-Format, s. u.).
 */
export interface JobCsvRow {
  title: string;
  company: string;
  matchScore: number | null;
  matchCategory: string | null;
  status: string;
  sourceName: string | null;
  url: string | null;
  // Roher Original-Tracking-Link (nanobot-Rückkanal-Key); NIE bereinigen.
  sourceUrl: string | null;
  // Mail-Message-ID aus jobs_with_links.csv.
  messageId: string | null;
  createdAt: string;
  postedDate: string | null;
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
 * Formel-Auslöser interpretiert wird, mit führendem Apostroph neutralisieren.
 * Neben `= + - @` zählen auch führende Steuerzeichen (Tab, CR, LF) als
 * gefährlich, weil sie in manchen Parsern eine nachfolgende Formel maskieren
 * (OWASP CSV-Injection). Score-Zahlen (0–100) und ISO-Daten (YYYY-…) beginnen
 * nie mit diesen Zeichen und bleiben unangetastet.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
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
export const csvProfiles: Record<CsvColumnProfile, CsvColumn[]> = {
  standard: [
    { header: 'Titel', value: r => r.title ?? '' },
    { header: 'Firma', value: r => r.company ?? '' },
    { header: 'Match-Score', value: r => (r.matchScore == null ? '' : String(r.matchScore)) },
    { header: 'Match-Kategorie', value: r => (r.matchCategory ? getCategoryLabel(r.matchCategory) : '') },
    { header: 'Status', value: r => getStatusLabel(r.status) },
    { header: 'Quelle', value: r => r.sourceName ?? '' },
    { header: 'URL', value: r => r.url ?? '' },
    { header: 'hinzugefügt am', value: r => toLocalIsoDate(r.createdAt) },
    { header: 'veröffentlicht am', value: r => toLocalIsoDate(r.postedDate) }
  ],
  // CSV-Header bleiben snake_case (Wire-Format, mit der Pipeline abgestimmt);
  // gelesen werden die camelCase-DTO-Felder. Spaltenfolge mit der nanobot-Seite
  // abgestimmt: source_url, message_id zuerst, dann die bisherigen Spalten.
  // Die Konsumseite matcht auf source_url ∪ url → rückwärtskompatibel.
  nanobot: [
    // source_url/message_id ROH ausgeben (kein cleanJobUrl, kein Trim); leer wenn
    // null (nie der Text "NULL") → manuell erfasste Jobs haben hier leere Felder.
    { header: 'source_url', value: r => r.sourceUrl ?? '' },
    { header: 'message_id', value: r => r.messageId ?? '' },
    { header: 'url', value: r => cleanJobUrl(r.url) ?? '' },
    { header: 'title', value: r => r.title ?? '' },
    { header: 'company', value: r => r.company ?? '' },
    { header: 'match_score', value: r => (r.matchScore == null ? '' : String(r.matchScore)) },
    { header: 'status', value: r => r.status ?? '' }, // Rohwert, kein Label
    { header: 'processed_at', value: r => toLocalIsoDate(r.createdAt) }
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
  const columns = csvProfiles[profile];
  if (!columns || columns.length === 0) {
    throw new Error(`CSV-Profil "${profile}" ist nicht implementiert`);
  }

  const bom = String.fromCharCode(0xFEFF); // UTF-8 BOM (Excel-freundlich)
  const lines: string[] = [];
  lines.push(columns.map(c => csvCell(c.header)).join(','));
  for (const r of rows) {
    lines.push(columns.map(c => csvCell(c.value(r))).join(','));
  }
  const csv = bom + lines.join('\r\n') + '\r\n';
  return { csv, count: rows.length };
}
