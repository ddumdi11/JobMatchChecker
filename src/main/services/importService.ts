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
import { createJob, getJobSources } from './jobService';
import { extractJobFields } from './aiExtractionService';
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
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);

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
          rows.push(createRowObject(headers, values));
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
          rows.push(createRowObject(headers, values));
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

/**
 * Create a row object from headers and values
 */
function createRowObject(headers: string[], values: string[]): CsvRow {
  const row: any = {};
  headers.forEach((header, index) => {
    const key = header.trim().toLowerCase().replace(/\s+/g, '_');
    row[key] = values[index] || '';
  });
  return row as CsvRow;
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
      status, matched_job_id, duplicate_score, duplicate_reason,
      extracted_source_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let addedCount = 0;

  const insertMany = db.transaction((rows: CsvRow[]) => {
    for (const row of rows) {
      // Check for duplicates
      const dupCheck = checkDuplicate(row);

      // Detect source from email
      const sourceId = row.from_email ? detectSourceFromEmail(row.from_email) : 1;

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
        row.email_date || null,
        JSON.stringify(row),
        status,
        dupCheck.matchedJobId || null,
        dupCheck.duplicateScore,
        dupCheck.duplicateReason || null,
        sourceId
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
      extractedFields = extraction;

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
        extraction.title || null,
        extraction.company || null,
        extraction.location || null,
        extraction.remoteOption || null,
        extraction.salaryRange || null,
        extraction.contractType || null,
        extraction.postedDate || null,
        extraction.deadline || null,
        rowId
      );
    } catch (error) {
      console.error('AI extraction failed:', error);
      // Continue with fallback values
    }
  }

  // Prepare job data
  const jobData: JobOfferInput = {
    title: extractedFields.title || row.csv_title || 'Imported Job',
    company: extractedFields.company || 'Unknown',
    sourceId: row.extracted_source_id || 1,
    postedDate: extractedFields.postedDate
      ? new Date(extractedFields.postedDate)
      : (row.csv_email_date ? new Date(row.csv_email_date) : new Date()),
    url: row.csv_url || undefined,
    location: extractedFields.location || undefined,
    remoteOption: extractedFields.remoteOption || undefined,
    salaryRange: extractedFields.salaryRange || undefined,
    contractType: extractedFields.contractType || undefined,
    deadline: extractedFields.deadline ? new Date(extractedFields.deadline) : undefined,
    fullText: row.csv_content || undefined,
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
