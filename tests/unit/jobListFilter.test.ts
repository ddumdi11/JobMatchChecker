/**
 * Filter- und Auswahl-Logik der Job-Liste (feat/bulk-status-update).
 * Rein funktional – kein window.api, keine DB.
 */
import { describe, it, expect } from 'vitest';
import type { JobStatus } from '../../src/shared/types';
import {
  filterJobsByAge,
  filterJobsByStatus,
  formatBulkStatusResult,
  getVisibleSelection,
  parseAgeDays
} from '../../src/renderer/utils/jobListFilter';
import { JOB_STATUSES, MATCHING_EXCLUDED_STATUSES, getJobStatusDefinition, isJobStatus } from '../../src/shared/jobStatus';
import { getStatusLabel } from '../../src/shared/jobLabels';

const TODAY = new Date(2026, 10, 23, 12, 0, 0); // 23.11.2026, lokal

function job(id: number, status: JobStatus, posted: Date, created: Date = posted) {
  return { id, status, postedDate: posted, createdAt: created };
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 8, 0, 0);
const idsOf = (rows: { id: number }[]) => rows.map(r => r.id);

describe('filterJobsByStatus', () => {
  const jobs = [job(1, 'new', TODAY), job(2, 'applied', TODAY), job(3, 'outdated', TODAY)];

  it("'all' lässt alles durch (auch outdated und archived)", () => {
    expect(idsOf(filterJobsByStatus(jobs, 'all'))).toEqual([1, 2, 3]);
  });

  it('einzelner Status', () => {
    expect(idsOf(filterJobsByStatus(jobs, 'new'))).toEqual([1]);
    expect(idsOf(filterJobsByStatus(jobs, 'outdated'))).toEqual([3]);
    expect(filterJobsByStatus(jobs, 'archived')).toEqual([]);
  });
});

describe('parseAgeDays', () => {
  it('leer → Filter aus', () => {
    expect(parseAgeDays('')).toBeNull();
    expect(parseAgeDays('  ')).toBeNull();
  });

  it('positive Ganzzahl', () => {
    expect(parseAgeDays('60')).toBe(60);
    expect(parseAgeDays(' 1 ')).toBe(1);
  });

  it('alles andere ist ungültig (kein stiller Filter)', () => {
    for (const input of ['0', '-5', '1.5', '1,5', '1e3', 'abc', '10000']) {
      expect(parseAgeDays(input)).toBe('invalid');
    }
  });
});

describe('filterJobsByAge', () => {
  it('null → keine Einschränkung', () => {
    const jobs = [job(1, 'new', TODAY)];
    expect(filterJobsByAge(jobs, null, TODAY)).toBe(jobs);
  });

  it('Grenze: genau N Tage alt ist NICHT älter, N+1 schon', () => {
    const jobs = [job(1, 'new', day(2026, 10, 24)), job(2, 'new', day(2026, 10, 23))];
    // 23.11. − 30 Tage = 24.10.
    expect(idsOf(filterJobsByAge(jobs, { days: 30, basis: 'postedDate' }, TODAY))).toEqual([2]);
  });

  it('Uhrzeit spielt keine Rolle (Kalendertage)', () => {
    const jobs = [job(1, 'new', new Date(2026, 9, 23, 23, 59, 59))];
    const early = new Date(2026, 10, 23, 0, 0, 1);
    const late = new Date(2026, 10, 23, 23, 59, 59);
    expect(filterJobsByAge(jobs, { days: 30, basis: 'postedDate' }, early)).toHaveLength(1);
    expect(filterJobsByAge(jobs, { days: 30, basis: 'postedDate' }, late)).toHaveLength(1);
  });

  it('Bezug: veröffentlicht und hinzugefügt können auseinanderliegen', () => {
    const jobs = [job(1, 'new', day(2025, 1, 15), day(2026, 11, 20))];
    expect(idsOf(filterJobsByAge(jobs, { days: 60, basis: 'postedDate' }, TODAY))).toEqual([1]);
    expect(idsOf(filterJobsByAge(jobs, { days: 60, basis: 'createdAt' }, TODAY))).toEqual([]);
  });

  it('ungültiges Datum gilt nie als alt', () => {
    const jobs = [job(1, 'new', new Date('kaputt'))];
    expect(filterJobsByAge(jobs, { days: 1, basis: 'postedDate' }, TODAY)).toEqual([]);
  });
});

describe('getVisibleSelection', () => {
  const filtered = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('nur sichtbare Jobs; ausgeblendete werden gezählt', () => {
    expect(getVisibleSelection(new Set([1, 3, 99, 100]), filtered)).toEqual({ visibleIds: [1, 3], hiddenCount: 2 });
  });

  it('alles ausgeblendet', () => {
    expect(getVisibleSelection(new Set([99]), filtered)).toEqual({ visibleIds: [], hiddenCount: 1 });
  });

  it('Workflow "Neu + älter als X → alle auswählen" trifft genau die Gefilterten', () => {
    const jobs = [
      job(1, 'new', day(2026, 1, 10)),
      job(2, 'applied', day(2026, 1, 10)),
      job(3, 'new', day(2026, 11, 22))
    ];
    const visible = filterJobsByAge(filterJobsByStatus(jobs, 'new'), { days: 60, basis: 'postedDate' }, TODAY);
    expect(getVisibleSelection(new Set(idsOf(visible)), visible)).toEqual({ visibleIds: [1], hiddenCount: 0 });
  });
});

describe('formatBulkStatusResult', () => {
  it('nennt nur, was vorkommt', () => {
    expect(formatBulkStatusResult({ updated: 37, unchanged: 0, notFound: 0 }, 'Outdated')).toBe('37 Jobs auf „Outdated“ gesetzt.');
    expect(formatBulkStatusResult({ updated: 1, unchanged: 1, notFound: 0 }, 'Outdated'))
      .toBe('1 Job auf „Outdated“ gesetzt, 1 hatte den Status schon.');
    expect(formatBulkStatusResult({ updated: 0, unchanged: 2, notFound: 1 }, 'Archived'))
      .toBe('0 Jobs auf „Archived“ gesetzt, 2 hatten den Status schon, 1 nicht mehr vorhanden.');
  });
});

describe('jobStatus (zentrale Definition)', () => {
  it('kennt genau die sechs Status', () => {
    expect([...JOB_STATUSES].sort()).toEqual(['applied', 'archived', 'interesting', 'new', 'outdated', 'rejected']);
  });

  it('outdated: Anzeige "Outdated", deutsches Label "Veraltet", grau wie archived', () => {
    expect(getJobStatusDefinition('outdated')).toMatchObject({ label: 'Outdated', labelDe: 'Veraltet', color: 'default' });
    expect(getJobStatusDefinition('archived')?.color).toBe('default');
    expect(getStatusLabel('outdated')).toBe('Veraltet');
  });

  it('unbekannter Rohwert: kein Status, Label-Fallback auf den Rohwert', () => {
    expect(isJobStatus('expired')).toBe(false);
    expect(isJobStatus(null)).toBe(false);
    expect(getStatusLabel('expired')).toBe('expired');
  });

  it('vom Matching ausgeschlossen sind archived und outdated', () => {
    expect([...MATCHING_EXCLUDED_STATUSES].sort()).toEqual(['archived', 'outdated']);
  });
});
