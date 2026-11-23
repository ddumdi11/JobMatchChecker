/**
 * Reine, komponentenunabhängige Filter- und Auswahl-Logik der Job-Liste
 * (Status, Alter, sichtbare Auswahl). Ohne window.api / DOM unter Node testbar.
 */
import type {
  AgeFilter,
  BulkStatusUpdateResult,
  JobOffer,
  JobStatus,
  VisibleSelection
} from '../../shared/types';
import { toLocalIsoDate } from '../../shared/jobCsv';

/** Status-Filter der Liste; 'all' = keine Einschränkung. */
export function filterJobsByStatus<T extends Pick<JobOffer, 'status'>>(
  jobs: T[],
  status: JobStatus | 'all'
): T[] {
  return status === 'all' ? jobs : jobs.filter(job => job.status === status);
}

/**
 * Eingabe "Älter als N Tage" → Anzahl Tage.
 * Leer → null (Filter aus), alles außer einer Ganzzahl 1–9999 → 'invalid'.
 */
export function parseAgeDays(input: string): number | null | 'invalid' {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (!/^\d{1,4}$/.test(trimmed)) return 'invalid';
  const days = Number(trimmed);
  return days > 0 ? days : 'invalid';
}

/**
 * "Älter als N Tage": lokaler Kalendertag des Jobs liegt VOR (heute − N Tage).
 * Genau N Tage alt zählt also nicht als älter. Fehlende/ungültige Daten gelten
 * nie als alt (im Zweifel nicht in eine Massen-Auswahl geraten).
 */
export function filterJobsByAge<T extends Pick<JobOffer, 'postedDate' | 'createdAt'>>(
  jobs: T[],
  filter: AgeFilter | null,
  today: Date = new Date()
): T[] {
  if (!filter) return jobs;
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - filter.days);
  const cutoff = toLocalIsoDate(cutoffDate);
  return jobs.filter(job => {
    const day = toLocalIsoDate(job[filter.basis]);
    return day !== '' && day < cutoff;
  });
}

/**
 * Teilt die Auswahl in sichtbare (durch die aktuellen Filter, über alle Seiten)
 * und ausgeblendete Jobs. Die Auswahl überlebt Filterwechsel – die
 * Bulk-Status-Aktion darf aber nur treffen, was der Nutzer gerade sieht.
 */
export function getVisibleSelection(
  selectedIds: ReadonlySet<number>,
  filteredJobs: ReadonlyArray<Pick<JobOffer, 'id'>>
): VisibleSelection {
  const visibleIds = filteredJobs.map(job => job.id).filter(id => selectedIds.has(id));
  return { visibleIds, hiddenCount: selectedIds.size - visibleIds.length };
}

/** "1 Job" / "37 Jobs" */
export function formatJobCount(count: number): string {
  return count === 1 ? '1 Job' : `${count} Jobs`;
}

/** Rückmeldung nach der Bulk-Status-Änderung. */
export function formatBulkStatusResult(result: BulkStatusUpdateResult, statusLabel: string): string {
  const parts = [`${formatJobCount(result.updated)} auf „${statusLabel}“ gesetzt`];
  if (result.unchanged > 0) {
    parts.push(result.unchanged === 1 ? '1 hatte den Status schon' : `${result.unchanged} hatten den Status schon`);
  }
  if (result.notFound > 0) parts.push(`${result.notFound} nicht mehr vorhanden`);
  return `${parts.join(', ')}.`;
}
