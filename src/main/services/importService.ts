/**
 * Import Service - CSV Import and Duplicate Detection
 *
 * Handles importing job data from CSV exports (e.g., from Gmail job alert processor)
 * Features:
 * - CSV parsing
 * - Duplicate detection (URL match, title similarity)
 * - Staging table management
 * - Batch import to job_offers
 */

import { getDatabase } from '../database/db';
import { createJob } from './jobService';
import { extractJobFields } from './aiExtractionService';
import { cleanJobUrl } from '../../shared/urlUtils';
import type { JobOfferInput } from '../../shared/types';

// =============================================================================
// Types
// =============================================================================

export interface ImportSession {
  id: number;
  filename: string;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface ImportStagingRow {
  id: number;
  sessionId: number;
  csvRowId?: number;
  csvUrl?: string;
  csvTitle?: string;
  csvContent?: string;
  csvFromEmail?: string;
  csvEmailDate?: string;
  csvRawData?: string;
  status: 'pending' | 'duplicate' | 'likely_duplicate' | 'new' | 'imported' | 'skipped';
  matchedJobId?: number;
  matchedJobTitle?: string; // Joined from job_offers
  duplicateScore?: number;
  duplicateReason?: string;
  extractedTitle?: string;
  extractedCompany?: string;
  extractedLocation?: string;
  extractedRemoteOption?: string;
  extractedSalaryRange?: string;
  extractedContractType?: string;
  extractedPostedDate?: Date;
  extractedDeadline?: Date;
  extractedSourceId?: number;
  importedJobId?: number;
  createdAt: Date;
  processedAt?: Date;
}

/**
 * Unterstützte Eingangsformate. Am Header erkannt (siehe detectFormat):
 * - 'jobs_csv': Altformat des Gmail-Prozessors (url/title/content/…) → KI-
 *   Extraktion aus `content`.
 * - 'jobs_with_links': strukturiertes NRW-Format (Stars,Datum,Quelle,Jobtitel,
 *   Unternehmen,Ort,Link,message_id,Mail-Betreff) → rein deterministisches
 *   Mapping, KEINE KI. Liefert den nanobot-Rückkanal (source_url + message_id).
 */
export type ImportFormat = 'jobs_csv' | 'jobs_with_links';

export interface CsvRow {
  id?: string;
  url?: string;
  title?: string;
  content?: string;
  status?: string;
  error_message?: string;
  fetched_at?: string;
  email_id?: string;
  email_subject?: string;
  from_email?: string;
  email_date?: string;
  processed?: string;
  processed_at?: string;
  // Zusätzliche, deterministisch gemappte Felder aus jobs_with_links.csv:
  company?: string;
  location?: string;
  source?: string;        // "Quelle" (XING/LinkedIn/…)
  posted_date?: string;   // aus "Datum" (DD.MM.YYYY) → ISO
  source_url?: string;    // roher "Link" (nicht bereinigt!)
  message_id?: string;    // "message_id"
  _format?: ImportFormat;
  _raw?: Record<string, string>; // komplette Originalzeile (für csv_raw_data)
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  isLikelyDuplicate: boolean;
  matchedJobId?: number;
  duplicateScore: number;
  duplicateReason?: string;
}

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Parse CSV content into rows
 * Handles quoted fields with commas and newlines
 */
export function parseCsv(csvContent: string): CsvRow[] {
  // Evtl. UTF-8-BOM am Dateianfang entfernen (sonst klebt er am ersten Header).
  const content = csvContent.replace(/^\uFEFF/, '');
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  // Parse header + Format am Header erkennen (unbekannt → Fehler).
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);
  const format = detectFormat(headers);

  const rows: CsvRow[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Handle multi-line quoted fields
    if (inQuotes) {
      currentLine += '\n' + line;
      const quoteCount = (currentLine.match(/"/g) || []).length;
      if (quoteCount % 2 === 0) {
        inQuotes = false;
        const values = parseCsvLine(currentLine);
        if (values.length > 0) {
          rows.push(buildRow(headers, values, format));
        }
        currentLine = '';
      }
    } else {
      const quoteCount = (line.match(/"/g) || []).length;
      if (quoteCount % 2 === 1) {
        // Odd number of quotes - field continues on next line
        inQuotes = true;
        currentLine = line;
      } else {
        const values = parseCsvLine(line);
        if (values.length > 0 && values.some(v => v.trim() !== '')) {
          rows.push(buildRow(headers, values, format));
        }
      }
    }
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Don't forget the last value
  values.push(current.trim());

  return values;
}

/** Header-Key-Normalisierung (identisch zur bisherigen createRowObject-Logik). */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Rohe Zeile als Record<normalisierter Header, Wert>. */
function rawObject(headers: string[], values: string[]): Record<string, string> {
  const raw: Record<string, string> = {};
  headers.forEach((header, index) => {
    raw[normalizeHeader(header)] = values[index] || '';
  });
  return raw;
}

/**
 * Erkennt das Eingangsformat am (normalisierten) Header.
 * - jobs_with_links.csv: hat `link` UND `message_id`.
 * - jobs.csv (Altformat): hat `url` UND `title`.
 * Alles andere → Fehler (bewusst KEIN leerer Import bei unbekanntem Header).
 */
export function detectFormat(headers: string[]): ImportFormat {
  const keys = new Set(headers.map(normalizeHeader));
  if (keys.has('link') && keys.has('message_id')) return 'jobs_with_links';
  if (keys.has('url') && keys.has('title')) return 'jobs_csv';
  throw new Error(
    'Unbekanntes CSV-Format: Header passt weder zu jobs.csv (url,title,content,…) ' +
      'noch zu jobs_with_links.csv (…,Link,message_id,Mail-Betreff). Bitte Exportdatei prüfen.'
  );
}

/**
 * "DD.MM.YYYY" → ISO-String. Als Mittag-UTC gespeichert, damit der Kalendertag
 * TZ-stabil bleibt (posted_date wird andernorts als UTC gelesen). Ungültig → null.
 */
export function parseGermanDateToIso(value?: string): string | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (isNaN(dt.getTime())) return null;
  // Kalender-ungültige Tage (z. B. 31.02.) rollen in Date.UTC still auf den
  // Folgemonat – solche Werte ablehnen statt ein falsches Datum zu liefern.
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt.toISOString();
}

/**
 * Baut aus einer Rohzeile eine CsvRow gemäß erkanntem Format.
 * jobs_with_links: rein deterministisch, KEINE KI, KEIN full_text. Der rohe
 * `Link` wandert byte-identisch nach source_url; `url` ist die bereinigte
 * Anzeige-/Dedup-URL. Stars & Mail-Betreff werden ignoriert, aber in `_raw`
 * (→ csv_raw_data) mitgeführt.
 */
function buildRow(headers: string[], values: string[], format: ImportFormat): CsvRow {
  const raw = rawObject(headers, values);

  if (format === 'jobs_with_links') {
    const link = raw['link'] || '';
    return {
      title: raw['jobtitel'] || '',
      company: raw['unternehmen'] || '',
      location: raw['ort'] || '',
      source: raw['quelle'] || '',
      posted_date: parseGermanDateToIso(raw['datum']) || undefined,
      url: cleanJobUrl(link) || undefined,
      source_url: link || undefined, // ROH – niemals bereinigen
      message_id: raw['message_id'] || undefined,
      _format: 'jobs_with_links',
      _raw: raw
    };
  }

  // jobs_csv (Altformat): normalisierte Header entsprechen direkt den CsvRow-Feldern.
  const row: CsvRow = { ...(raw as CsvRow) };
  row._format = 'jobs_csv';
  row._raw = raw;
  return row;
}

// =============================================================================
// Duplicate Detection
// =============================================================================

/**
 * Check if a job is a duplicate of existing jobs
 */
export function checkDuplicate(csvRow: CsvRow): DuplicateCheckResult {
  const db = getDatabase();

  // Check 1: Exact URL match (highest confidence)
  if (csvRow.url && csvRow.url.trim() !== '') {
    const urlMatch = db.prepare(`
      SELECT id, title, company FROM job_offers WHERE url = ?
    `).get(csvRow.url.trim()) as { id: number; title: string; company: string } | undefined;

    if (urlMatch) {
      return {
        isDuplicate: true,
        isLikelyDuplicate: false,
        matchedJobId: urlMatch.id,
        duplicateScore: 100,
        duplicateReason: `URL match: "${urlMatch.title}" at ${urlMatch.company}`
      };
    }
  }

  // Check 2: Title similarity (if we have a title from CSV)
  if (csvRow.title && csvRow.title.trim() !== '') {
    const normalizedTitle = normalizeString(csvRow.title);

    // Get all jobs and check similarity
    const allJobs = db.prepare(`
      SELECT id, title, company FROM job_offers
    `).all() as Array<{ id: number; title: string; company: string }>;

    for (const job of allJobs) {
      const similarity = calculateSimilarity(normalizedTitle, normalizeString(job.title));

      if (similarity >= 0.85) {
        return {
          isDuplicate: false,
          isLikelyDuplicate: true,
          matchedJobId: job.id,
          duplicateScore: Math.round(similarity * 100),
          duplicateReason: `Similar title (${Math.round(similarity * 100)}%): "${job.title}" at ${job.company}`
        };
      }
    }
  }

  // Check 3: Search for existing job titles or company names in CSV content
  if (csvRow.content && csvRow.content.trim() !== '') {
    const normalizedContent = csvRow.content.toLowerCase();

    // Get all jobs and check if their title or company appears in content
    const allJobs = db.prepare(`
      SELECT id, title, company FROM job_offers
    `).all() as Array<{ id: number; title: string; company: string }>;

    for (const job of allJobs) {
      // Skip jobs with generic titles or unknown company
      if (job.title.toLowerCase().includes('detailansicht') ||
          job.company.toLowerCase() === 'unknown') {
        continue;
      }

      const titleInContent = normalizedContent.includes(job.title.toLowerCase());
      const companyInContent = job.company &&
                               job.company.length > 3 &&
                               normalizedContent.includes(job.company.toLowerCase());

      if (titleInContent || companyInContent) {
        const matchType = titleInContent && companyInContent
          ? 'Title & Company'
          : (titleInContent ? 'Title' : 'Company');

        return {
          isDuplicate: false,
          isLikelyDuplicate: true,
          matchedJobId: job.id,
          duplicateScore: titleInContent && companyInContent ? 90 : 75,
          duplicateReason: `${matchType} found in content: "${job.title}" at ${job.company}`
        };
      }
    }
  }

  // No duplicate found
  return {
    isDuplicate: false,
    isLikelyDuplicate: false,
    duplicateScore: 0
  };
}

/**
 * Normalize a string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (Jaccard similarity on word sets)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(str2.split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// =============================================================================
// Source Detection
// =============================================================================

/**
 * Detect job source from email sender
 */
export function detectSourceFromEmail(fromEmail: string): number {
  const db = getDatabase();
  const sources = db.prepare('SELECT id, name FROM job_sources').all() as Array<{ id: number; name: string }>;

  const emailLower = fromEmail.toLowerCase();

  // Map email patterns to source names
  const patterns: Array<{ pattern: RegExp; sourceName: string }> = [
    { pattern: /xing/i, sourceName: 'XING' },
    { pattern: /linkedin/i, sourceName: 'LinkedIn' },
    { pattern: /stepstone/i, sourceName: 'Stepstone' },
    { pattern: /indeed/i, sourceName: 'Indeed' },
    { pattern: /arbeitsagentur/i, sourceName: 'Arbeitsagentur' },
    { pattern: /nachhaltigejobs|greenjobs/i, sourceName: 'Nachhaltige Jobs' },
    { pattern: /meinestadt/i, sourceName: 'MeineStadt' }
  ];

  for (const { pattern, sourceName } of patterns) {
    if (pattern.test(emailLower)) {
      const source = sources.find(s => s.name === sourceName);
      if (source) return source.id;
    }
  }

  // Default to first source (LinkedIn) if no match
  return sources[0]?.id || 1;
}

/**
 * Löst die job_sources-ID aus dem expliziten "Quelle"-Namen auf (jobs_with_links:
 * "XING"/"LinkedIn"/…). Case-insensitiver Name-Match; Fallback = erste Quelle.
 */
export function resolveSourceByName(name?: string): number {
  const db = getDatabase();
  if (name && name.trim()) {
    const s = db
      .prepare('SELECT id FROM job_sources WHERE lower(name) = lower(?)')
      .get(name.trim()) as { id: number } | undefined;
    if (s) return s.id;
  }
  const first = db.prepare('SELECT id FROM job_sources ORDER BY id ASC LIMIT 1').get() as
    | { id: number }
    | undefined;
  return first?.id || 1;
}

// =============================================================================
// Import Session Management
// =============================================================================

/**
 * Create a new import session
 */
export function createImportSession(filename: string): ImportSession {
  const db = getDatabase();

  const result = db.prepare(`
    INSERT INTO import_sessions (filename, status)
    VALUES (?, 'pending')
  `).run(filename);

  return getImportSession(result.lastInsertRowid as number);
}

/**
 * Get an import session by ID
 */
export function getImportSession(id: number): ImportSession {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT * FROM import_sessions WHERE id = ?
  `).get(id) as any;

  if (!row) {
    throw new Error(`Import session ${id} not found`);
  }

  return {
    id: row.id,
    filename: row.filename,
    totalRows: row.total_rows,
    processedRows: row.processed_rows,
    importedRows: row.imported_rows,
    skippedRows: row.skipped_rows,
    duplicateRows: row.duplicate_rows,
    status: row.status,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined
  };
}

/**
 * Get all import sessions
 */
export function getImportSessions(): ImportSession[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT * FROM import_sessions ORDER BY created_at DESC
  `).all() as any[];

  return rows.map(row => ({
    id: row.id,
    filename: row.filename,
    totalRows: row.total_rows,
    processedRows: row.processed_rows,
    importedRows: row.imported_rows,
    skippedRows: row.skipped_rows,
    duplicateRows: row.duplicate_rows,
    status: row.status,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined
  }));
}

/**
 * Update import session statistics
 */
function updateSessionStats(sessionId: number): void {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status != 'pending' THEN 1 ELSE 0 END) as processed,
      SUM(CASE WHEN status = 'imported' THEN 1 ELSE 0 END) as imported,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status IN ('duplicate', 'likely_duplicate') THEN 1 ELSE 0 END) as duplicates
    FROM import_staging
    WHERE session_id = ?
  `).get(sessionId) as any;

  db.prepare(`
    UPDATE import_sessions
    SET total_rows = ?,
        processed_rows = ?,
        imported_rows = ?,
        skipped_rows = ?,
        duplicate_rows = ?
    WHERE id = ?
  `).run(
    stats.total,
    stats.processed,
    stats.imported,
    stats.skipped,
    stats.duplicates,
    sessionId
  );
}

// =============================================================================
// Staging Table Operations
// =============================================================================

/**
 * Add CSV rows to staging table
 */
export function addRowsToStaging(sessionId: number, rows: CsvRow[]): number {
  const db = getDatabase();

  const insertStmt = db.prepare(`
    INSERT INTO import_staging (
      session_id, csv_row_id, csv_url, csv_title, csv_content,
      csv_from_email, csv_email_date, csv_raw_data,
      csv_source_url, csv_message_id,
      status, matched_job_id, duplicate_score, duplicate_reason,
      extracted_source_id, extracted_title, extracted_company,
      extracted_location, extracted_posted_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let addedCount = 0;

  const insertMany = db.transaction((rows: CsvRow[]) => {
    for (const row of rows) {
      // Check for duplicates (weiterhin auf `url` – bei jobs_with_links die
      // bereinigte Anzeige-/Dedup-URL, exakt wie beim manuellen Erfassen).
      const dupCheck = checkDuplicate(row);

      const isLinks = row._format === 'jobs_with_links';

      // Quelle bestimmen: jobs_with_links hat sie explizit ("Quelle"),
      // sonst aus der Absender-Mail ableiten.
      const sourceId = isLinks
        ? resolveSourceByName(row.source)
        : row.from_email
          ? detectSourceFromEmail(row.from_email)
          : 1;

      // Determine initial status
      let status: string;
      if (dupCheck.isDuplicate) {
        status = 'duplicate';
      } else if (dupCheck.isLikelyDuplicate) {
        status = 'likely_duplicate';
      } else {
        status = 'new';
      }

      insertStmt.run(
        sessionId,
        row.id ? parseInt(row.id) : null,
        row.url || null,
        row.title || null,
        row.content || null,
        row.from_email || null,
        // Für jobs_with_links dient das gemappte posted_date auch als email_date-
        // Fallback (harmlos, falls extracted_posted_date je fehlt).
        row.email_date || (isLinks ? row.posted_date || null : null),
        // Originalzeile (inkl. Stars & Mail-Betreff) roh mitführen.
        JSON.stringify(row._raw ?? row),
        row.source_url || null, // ROH – nur bei jobs_with_links gesetzt
        row.message_id || null,
        status,
        dupCheck.matchedJobId || null,
        dupCheck.duplicateScore,
        dupCheck.duplicateReason || null,
        sourceId,
        // Deterministisch vorbefüllte Felder – NUR jobs_with_links (KEINE KI).
        // Altformat lässt diese null; die KI füllt sie beim Import.
        isLinks ? row.title || null : null,
        isLinks ? row.company || null : null,
        isLinks ? row.location || null : null,
        isLinks ? row.posted_date || null : null
      );

      addedCount++;
    }
  });

  insertMany(rows);

  // Update session stats
  updateSessionStats(sessionId);

  return addedCount;
}

/**
 * Get staging rows for a session
 */
export function getStagingRows(sessionId: number): ImportStagingRow[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT
      s.*,
      jo.title as matched_job_title
    FROM import_staging s
    LEFT JOIN job_offers jo ON s.matched_job_id = jo.id
    WHERE s.session_id = ?
    ORDER BY s.id ASC
  `).all(sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    csvRowId: row.csv_row_id,
    csvUrl: row.csv_url,
    csvTitle: row.csv_title,
    csvContent: row.csv_content,
    csvFromEmail: row.csv_from_email,
    csvEmailDate: row.csv_email_date,
    csvRawData: row.csv_raw_data,
    status: row.status,
    matchedJobId: row.matched_job_id,
    matchedJobTitle: row.matched_job_title,
    duplicateScore: row.duplicate_score,
    duplicateReason: row.duplicate_reason,
    extractedTitle: row.extracted_title,
    extractedCompany: row.extracted_company,
    extractedLocation: row.extracted_location,
    extractedRemoteOption: row.extracted_remote_option,
    extractedSalaryRange: row.extracted_salary_range,
    extractedContractType: row.extracted_contract_type,
    extractedPostedDate: row.extracted_posted_date ? new Date(row.extracted_posted_date) : undefined,
    extractedDeadline: row.extracted_deadline ? new Date(row.extracted_deadline) : undefined,
    extractedSourceId: row.extracted_source_id,
    importedJobId: row.imported_job_id,
    createdAt: new Date(row.created_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : undefined
  }));
}

/**
 * Update staging row status
 */
export function updateStagingRowStatus(
  rowId: number,
  status: 'pending' | 'duplicate' | 'likely_duplicate' | 'new' | 'imported' | 'skipped'
): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE import_staging
    SET status = ?, processed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, rowId);

  // Get session ID to update stats
  const row = db.prepare('SELECT session_id FROM import_staging WHERE id = ?').get(rowId) as any;
  if (row) {
    updateSessionStats(row.session_id);
  }
}

// =============================================================================
// Import Execution
// =============================================================================

/**
 * Import a single staging row as a new job (with AI extraction)
 */
export async function importStagingRow(rowId: number): Promise<number> {
  const db = getDatabase();

  // Get the staging row
  const row = db.prepare(`
    SELECT * FROM import_staging WHERE id = ?
  `).get(rowId) as any;

  if (!row) {
    throw new Error(`Staging row ${rowId} not found`);
  }

  if (row.status === 'imported') {
    throw new Error(`Row ${rowId} has already been imported`);
  }

  // Use AI to extract fields from content
  let extractedFields: any = {};

  if (row.csv_content) {
    try {
      const extraction = await extractJobFields(row.csv_content);
      extractedFields = extraction.fields || {};

      // Update staging row with extracted fields
      db.prepare(`
        UPDATE import_staging
        SET extracted_title = ?,
            extracted_company = ?,
            extracted_location = ?,
            extracted_remote_option = ?,
            extracted_salary_range = ?,
            extracted_contract_type = ?,
            extracted_posted_date = ?,
            extracted_deadline = ?
        WHERE id = ?
      `).run(
        extractedFields.title || null,
        extractedFields.company || null,
        extractedFields.location || null,
        extractedFields.remoteOption || null,
        extractedFields.salaryRange || null,
        extractedFields.contractType || null,
        extractedFields.postedDate || null,
        extractedFields.deadline || null,
        rowId
      );
    } catch (error) {
      console.error('AI extraction failed:', error);
      // Continue with fallback values
    }
  }

  // Prepare job data. Merge-Reihenfolge: KI-Extraktion (Altformat) → persistierte
  // extracted_*-Felder (bei jobs_with_links deterministisch vorbefüllt) → CSV-
  // Fallbacks. So funktioniert derselbe Pfad für beide Formate.
  const jobData: JobOfferInput = {
    title: extractedFields.title || row.extracted_title || row.csv_title || 'Imported Job',
    company: extractedFields.company || row.extracted_company || 'Unknown',
    sourceId: row.extracted_source_id || 1,
    postedDate: extractedFields.postedDate
      ? new Date(extractedFields.postedDate)
      : row.extracted_posted_date
        ? new Date(row.extracted_posted_date)
        : (row.csv_email_date ? new Date(row.csv_email_date) : new Date()),
    url: row.csv_url || undefined,
    // Rückkanal-Felder: source_url ROH (nie bereinigt), message_id roh. Bei
    // manuell/Altformat erfassten Jobs null → leere Felder im Export.
    sourceUrl: row.csv_source_url || undefined,
    messageId: row.csv_message_id || undefined,
    location: extractedFields.location || row.extracted_location || undefined,
    remoteOption: extractedFields.remoteOption || row.extracted_remote_option || undefined,
    salaryRange: extractedFields.salaryRange || row.extracted_salary_range || undefined,
    contractType: extractedFields.contractType || row.extracted_contract_type || undefined,
    deadline: extractedFields.deadline
      ? new Date(extractedFields.deadline)
      : row.extracted_deadline
        ? new Date(row.extracted_deadline)
        : undefined,
    fullText: row.csv_content || undefined, // jobs_with_links: null → kein full_text
    rawImportData: row.csv_raw_data || undefined,
    importMethod: 'bulk',
    status: 'new'
  };

  // Create the job
  const job = await createJob(jobData);

  // Update staging row
  db.prepare(`
    UPDATE import_staging
    SET status = 'imported',
        imported_job_id = ?,
        processed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(job.id, rowId);

  // Update session stats
  updateSessionStats(row.session_id);

  return job.id;
}

/**
 * Import all "new" staging rows from a session
 */
export async function importAllNewRows(sessionId: number): Promise<{ imported: number; failed: number }> {
  const db = getDatabase();

  const newRows = db.prepare(`
    SELECT id FROM import_staging
    WHERE session_id = ? AND status = 'new'
  `).all(sessionId) as Array<{ id: number }>;

  let imported = 0;
  let failed = 0;

  for (const row of newRows) {
    try {
      await importStagingRow(row.id);
      imported++;
    } catch (error) {
      console.error(`Failed to import row ${row.id}:`, error);
      failed++;
    }
  }

  // Mark session as completed if all rows processed
  const remaining = db.prepare(`
    SELECT COUNT(*) as count FROM import_staging
    WHERE session_id = ? AND status = 'pending'
  `).get(sessionId) as { count: number };

  if (remaining.count === 0) {
    db.prepare(`
      UPDATE import_sessions
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId);
  }

  return { imported, failed };
}

/**
 * Skip a staging row (mark as skipped)
 */
export function skipStagingRow(rowId: number): void {
  updateStagingRowStatus(rowId, 'skipped');
}

/**
 * Delete an import session and all its staging rows
 */
export function deleteImportSession(sessionId: number): void {
  const db = getDatabase();

  // Staging rows are deleted automatically via CASCADE
  db.prepare('DELETE FROM import_sessions WHERE id = ?').run(sessionId);
}

// =============================================================================
// Full Import Workflow
// =============================================================================

/**
 * Process a CSV file: parse, check duplicates, and add to staging
 */
export function processImportCsv(filename: string, csvContent: string): ImportSession {
  // Parse CSV
  const rows = parseCsv(csvContent);

  if (rows.length === 0) {
    throw new Error('CSV file is empty or could not be parsed');
  }

  // Create session
  const session = createImportSession(filename);

  // Add rows to staging (with duplicate detection)
  addRowsToStaging(session.id, rows);

  // Return updated session
  return getImportSession(session.id);
}
