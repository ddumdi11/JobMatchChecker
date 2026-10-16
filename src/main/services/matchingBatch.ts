/**
 * Gemeinsame Schleife für Bulk- und Auswahl-Matching (matchingService).
 *
 * Eigenes Modul ohne Electron-/DB-/Provider-Abhängigkeiten: Die Match-Funktion
 * wird injiziert, dadurch ist die Schleife in CI testbar. Ersetzt die zuvor
 * doppelt vorhandene Schleife in bulkMatchJobs/matchSelectedJobs.
 *
 * Liefert neben den Zählern die Jobs selbst (ID + Titel, Erfolge mit Score),
 * damit der Ergebnis-Dialog zeigen kann, WELCHE Jobs gematcht wurden.
 */

import { formatJobRef } from '../../shared/formatUtils';
import type { BulkMatchResult } from '../../shared/types';

export interface BatchJob {
  id: number;
  title: string;
}

export interface MatchingBatchOptions {
  onProgress?: (current: number, total: number, jobTitle: string) => void;
  /** Pause zwischen zwei API-Calls (Rate-Limit-Schutz), nicht nach dem letzten. */
  delayMs?: number;
  /** Bereits vorab übersprungene Jobs (z. B. ohne Volltext). */
  skipped?: number;
  /** Logging-Hooks (matchingService reicht electron-log durch). */
  onMatched?: (job: BatchJob, index: number, total: number) => void;
  onFailed?: (job: BatchJob, error: unknown) => void;
}

export async function runMatchingBatch(
  jobs: BatchJob[],
  matchFn: (jobId: number) => Promise<{ matchScore: number }>,
  options: MatchingBatchOptions = {}
): Promise<BulkMatchResult> {
  const { onProgress, delayMs = 500, skipped = 0, onMatched, onFailed } = options;
  const total = jobs.length;
  const result: BulkMatchResult = {
    matched: 0,
    failed: 0,
    skipped,
    errors: [],
    matchedJobs: [],
    failedJobs: []
  };

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    onProgress?.(i + 1, total, job.title);

    try {
      const { matchScore } = await matchFn(job.id);
      result.matched++;
      result.matchedJobs.push({ id: job.id, title: job.title, matchScore });
      onMatched?.(job, i, total);
    } catch (error: any) {
      const message = error?.message || 'Unknown error';
      result.failed++;
      result.failedJobs.push({ id: job.id, title: job.title, error: message });
      result.errors.push(`${formatJobRef(job.id, job.title)}: ${message}`);
      onFailed?.(job, error);
    }

    // Small delay between API calls to avoid rate limiting
    if (i < jobs.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return result;
}
