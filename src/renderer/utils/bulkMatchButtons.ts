/**
 * Zustand der Bulk-Matching-Buttons in der Job-Liste.
 *
 * Bewusst NUR aus DB-weiten Zählern abgeleitet (countJobsForBulkMatching im
 * Main-Prozess), nie aus der gefilterten/geladenen Job-Liste: Ein Statusfilter
 * ohne Treffer darf "Alle neu matchen" nicht sperren, solange die DB
 * matchbare Jobs hat (CodeRabbit-Finding PR #77).
 */

export interface BulkMatchCounts {
  /** Matchbare Jobs ohne Score ("Neue matchen") */
  unmatchedCount: number;
  /** Alle matchbaren Jobs ("Alle neu matchen") */
  rematchableCount: number;
}

export interface BulkMatchButtonsState {
  matchNew: { disabled: boolean; label: string };
  rematchAll: { disabled: boolean };
}

export function getBulkMatchButtonsState(
  counts: BulkMatchCounts,
  isBulkMatching: boolean
): BulkMatchButtonsState {
  return {
    matchNew: {
      disabled: isBulkMatching || counts.unmatchedCount === 0,
      label: counts.unmatchedCount > 0 ? `Neue matchen (${counts.unmatchedCount})` : 'Alle gematcht'
    },
    rematchAll: {
      disabled: isBulkMatching || counts.rematchableCount === 0
    }
  };
}
