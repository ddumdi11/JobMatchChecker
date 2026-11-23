/**
 * Bulk-Status-Änderung für ausgewählte Jobs.
 *
 * Eigenes Modul ohne Electron-Abhängigkeiten (DB wird übergeben), damit es in
 * CI gegen die migrierte Test-DB prüfbar ist. Ändert ausschließlich `status` und
 * `updated_at`, löscht nie etwas.
 */
import type Database from 'better-sqlite3';
import type { BulkStatusUpdateResult, JobStatus } from '../../shared/types';
import { JOB_STATUSES, isJobStatus } from '../../shared/jobStatus';

/**
 * Setzt den Status aller übergebenen Jobs in EINER Transaktion (alles oder nichts).
 * Jobs, die den Ziel-Status schon haben, bleiben unberührt (auch updated_at);
 * nicht (mehr) vorhandene IDs werden gezählt, sind aber kein Fehler.
 */
export function setStatusForJobs(
  db: Database.Database,
  jobIds: number[],
  status: JobStatus
): BulkStatusUpdateResult {
  if (!isJobStatus(status)) {
    throw new Error(`Ungültiger Status: ${String(status)}. Erlaubt: ${JOB_STATUSES.join(', ')}`);
  }
  if (!Array.isArray(jobIds) || !jobIds.every(id => Number.isInteger(id) && id > 0)) {
    throw new Error('Ungültige Job-IDs: erwartet wird eine Liste positiver Ganzzahlen');
  }

  const ids = [...new Set(jobIds)];
  const update = db.prepare(`
    UPDATE job_offers
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND COALESCE(status, '') != ?
  `);
  const exists = db.prepare('SELECT 1 FROM job_offers WHERE id = ?');

  const run = db.transaction((): BulkStatusUpdateResult => {
    const result: BulkStatusUpdateResult = { updated: 0, unchanged: 0, notFound: 0 };
    for (const id of ids) {
      if (update.run(status, id, status).changes > 0) {
        result.updated++;
      } else if (exists.get(id)) {
        result.unchanged++;
      } else {
        result.notFound++;
      }
    }
    return result;
  });

  return run();
}
