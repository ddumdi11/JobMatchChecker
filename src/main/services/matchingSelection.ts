/**
 * Job-Auswahl fürs Bulk-/Auswahl-Matching (matchingService).
 *
 * Eigenes Modul ohne Electron-/Provider-Abhängigkeiten (DB wird übergeben),
 * damit die Auswahl in CI gegen die migrierte Test-DB prüfbar ist.
 *
 * Regel: Archivierte Jobs (status = 'archived') werden NIE automatisch
 * gematcht – das würde Tokens für bewusst abgelegte Jobs verbrennen.
 * Das betrifft NUR die Matching-Auswahl; der Listenfilter "Alle" zeigt
 * archivierte Jobs weiterhin (Lebenszyklus-Konzept: Issue #76).
 *
 * Zähler (Button "Neue matchen (N)") und Auswahl nutzen dieselben
 * Bedingungen, damit die angezeigte Zahl der tatsächlichen Arbeit entspricht.
 */

import type Database from 'better-sqlite3';

/** Gemeinsame Bedingung: matchbar = Volltext vorhanden UND nicht archiviert (NULL-Status bleibt matchbar). */
const MATCHABLE = `full_text IS NOT NULL AND full_text != '' AND COALESCE(status, '') != 'archived'`;

export interface MatchCandidate {
  id: number;
  title: string;
}

/** "Neue matchen" (ohne Score) bzw. "Alle neu matchen" (rematchAll). */
export function selectJobsForBulkMatching(db: Database.Database, rematchAll: boolean): MatchCandidate[] {
  const unscored = rematchAll ? '' : 'AND match_score IS NULL';
  return db.prepare(`
    SELECT id, title FROM job_offers
    WHERE ${MATCHABLE} ${unscored}
    ORDER BY created_at DESC
  `).all() as MatchCandidate[];
}

/**
 * Ausgewählte Jobs: nur die matchbaren. Ausgewählte, aber archivierte oder
 * textlose Jobs zählt der Aufrufer als "skipped".
 */
export function selectJobsForSelectedMatching(db: Database.Database, jobIds: number[]): MatchCandidate[] {
  if (jobIds.length === 0) return [];
  const placeholders = jobIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT id, title FROM job_offers
    WHERE id IN (${placeholders})
    AND ${MATCHABLE}
    ORDER BY created_at DESC
  `).all(...jobIds) as MatchCandidate[];
}

/** Anzahl für "Neue matchen (N)" – identisch zu selectJobsForBulkMatching(db, false). */
export function countJobsForBulkMatching(db: Database.Database, rematchAll: boolean): number {
  const unscored = rematchAll ? '' : 'AND match_score IS NULL';
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM job_offers
    WHERE ${MATCHABLE} ${unscored}
  `).get() as { count: number };
  return row.count;
}
