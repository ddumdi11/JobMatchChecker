/**
 * Zustand der Bulk-Matching-Buttons in der Job-Liste.
 *
 * Bewusst NUR aus DB-weiten Zählern abgeleitet (countJobsForBulkMatching im
 * Main-Prozess), nie aus der gefilterten/geladenen Job-Liste: Ein Statusfilter
 * ohne Treffer darf "Alle neu matchen" nicht sperren, solange die DB
 * matchbare Jobs hat (CodeRabbit-Finding PR #77).
 *
 * Konnten die Zähler nicht geladen werden (countsUnavailable), ist der Stand
 * unbekannt – das ist etwas anderes als 0: Buttons gesperrt, aber kein
 * irreführendes "Alle gematcht".
 */

import type { BulkMatchCounts, BulkMatchButtonsState } from '../../shared/types';

export function getBulkMatchButtonsState(
  counts: BulkMatchCounts,
  isBulkMatching: boolean
): BulkMatchButtonsState {
  if (counts.countsUnavailable) {
    return {
      matchNew: { disabled: true, label: 'Neue matchen (?)' },
      rematchAll: { disabled: true }
    };
  }
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
