/**
 * Zentrale Definition der Job-Status (Single Source of Truth).
 *
 * Validierung, Dropdowns, Labels und der Matching-Ausschluss lesen alle von
 * hier. Die DB beschränkt die Werte NICHT (text, kein CHECK) – ein neuer Status
 * braucht daher keine Migration, aber einen Eintrag hier: `Record<JobStatus, …>`
 * erzwingt das beim Kompilieren.
 *
 * Electron-frei und ohne Laufzeit-Abhängigkeiten (auch das nanobot-CLI lädt
 * dieses Modul über jobCsv → jobLabels).
 */
import type { JobStatus, JobStatusDefinition } from './types';

// Reihenfolge = Anzeigereihenfolge in den Dropdowns.
// - outdated: nie bearbeitet, inzwischen veraltet (Vorgriff auf 'expired' in #76)
// - archived: bewusst abgelegt
const DEFINITIONS: Record<JobStatus, Omit<JobStatusDefinition, 'value'>> = {
  new: { label: 'New', labelDe: 'Neu', color: 'info' },
  interesting: { label: 'Interesting', labelDe: 'Interessant', color: 'success' },
  applied: { label: 'Applied', labelDe: 'Beworben', color: 'warning' },
  rejected: { label: 'Rejected', labelDe: 'Abgelehnt', color: 'error' },
  outdated: { label: 'Outdated', labelDe: 'Veraltet', color: 'default' },
  archived: { label: 'Archived', labelDe: 'Archiviert', color: 'default' }
};

/** Alle gültigen Status-Werte in Anzeigereihenfolge. */
export const JOB_STATUSES = Object.keys(DEFINITIONS) as JobStatus[];

/** Alle Status mit Labels und Chip-Farbe, in Anzeigereihenfolge. */
export const JOB_STATUS_DEFINITIONS: JobStatusDefinition[] = JOB_STATUSES.map(value => ({
  value,
  ...DEFINITIONS[value]
}));

/**
 * Status, die nie automatisch gematcht werden (Bulk-, Auswahl-Matching, Zähler):
 * Das würde Tokens für abgelegte bzw. veraltete Jobs verbrennen.
 */
export const MATCHING_EXCLUDED_STATUSES: readonly JobStatus[] = ['archived', 'outdated'];

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as string[]).includes(value);
}

/** Definition zu einem Status; unbekannter Rohwert → undefined. */
export function getJobStatusDefinition(status: string): JobStatusDefinition | undefined {
  return JOB_STATUS_DEFINITIONS.find(def => def.value === status);
}
