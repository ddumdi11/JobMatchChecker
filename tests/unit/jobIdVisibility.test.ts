/**
 * Referenz & Transparenz (feat/job-id-visibility):
 * - formatJobRef: EIN gemeinsames Format "#406 · Titel" (keine Format-Drift)
 * - runMatchingBatch: gemeinsame, electron-freie Bulk-/Auswahl-Schleife –
 *   liefert Erfolge (mit Score) und Fehler jeweils mit ID + Titel
 * - jobListViewPrefs: ID-Spalte ein/aus, localStorage-Fehler abgefangen
 * - getJobs: Sortierung nach ID über die bestehende Sortier-Mechanik
 *
 * Anlass: "1 gematcht" nannte keinen Job – Job 406 und Job 425 (beide
 * DevSecOps) waren in der GUI ohne ID nicht auseinanderzuhalten.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatJobRef, formatJobId, JOB_REF_SEPARATOR } from '../../src/shared/formatUtils';
import { runMatchingBatch } from '../../src/main/services/matchingBatch';
import {
  readShowIdColumn,
  writeShowIdColumn,
  SHOW_ID_COLUMN_KEY
} from '../../src/renderer/utils/jobListViewPrefs';
import * as jobService from '../../src/main/services/jobService';
import { getDatabase } from '../../src/main/database/db';
import type { JobOfferInput } from '../../src/shared/types';

describe('formatJobRef', () => {
  it('"#ID · Titel"', () => {
    expect(formatJobRef(406, 'Expert DevSecOps Process Automation (m/w/d)'))
      .toBe('#406 · Expert DevSecOps Process Automation (m/w/d)');
  });

  it('trimmt den Titel; leer/fehlend → Platzhalter, ID bleibt sichtbar', () => {
    expect(formatJobRef(7, '  QA  ')).toBe('#7 · QA');
    expect(formatJobRef(7, '')).toBe('#7 · (ohne Titel)');
    expect(formatJobRef(7, '   ')).toBe('#7 · (ohne Titel)');
    expect(formatJobRef(7, null)).toBe('#7 · (ohne Titel)');
    expect(formatJobRef(7, undefined)).toBe('#7 · (ohne Titel)');
  });

  it('Bausteine für getrennt gestylte Kopfzeilen ergeben exakt dasselbe Format', () => {
    expect(formatJobId(406) + JOB_REF_SEPARATOR + 'X').toBe(formatJobRef(406, 'X'));
  });
});

describe('runMatchingBatch', () => {
  const JOBS = [
    { id: 406, title: 'Expert DevSecOps Process Automation (m/w/d)' },
    { id: 425, title: 'Expert DevSecOps DXL (m/w/d)' },
    { id: 137, title: 'Quality Assurance Engineer (m/w/d) für Embedded-Geräte' }
  ];
  const SCORES: Record<number, number> = { 406: 50, 137: 71.6 };

  const matchFn = vi.fn(async (id: number) => {
    if (id === 425) throw new Error('KI-Antwort wurde abgeschnitten (Token-Limit erreicht).');
    return { matchScore: SCORES[id] };
  });

  beforeEach(() => {
    matchFn.mockClear();
  });

  it('Erfolge mit ID, Titel, Score; Fehler mit ID, Titel, Meldung – in Abarbeitungsreihenfolge', async () => {
    const r = await runMatchingBatch(JOBS, matchFn, { delayMs: 0 });
    expect(r.matched).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.skipped).toBe(0);
    expect(r.matchedJobs).toEqual([
      { id: 406, title: JOBS[0].title, matchScore: 50 },
      { id: 137, title: JOBS[2].title, matchScore: 71.6 }
    ]);
    expect(r.failedJobs).toEqual([
      { id: 425, title: JOBS[1].title, error: 'KI-Antwort wurde abgeschnitten (Token-Limit erreicht).' }
    ]);
  });

  it('errors (Kompatibilität) im Format "#ID · Titel: Meldung"', async () => {
    const r = await runMatchingBatch(JOBS, matchFn, { delayMs: 0 });
    expect(r.errors).toEqual([
      '#425 · Expert DevSecOps DXL (m/w/d): KI-Antwort wurde abgeschnitten (Token-Limit erreicht).'
    ]);
  });

  it('Fehler ohne Meldung → "Unknown error"', async () => {
    const r = await runMatchingBatch([{ id: 1, title: 'A' }], async () => { throw {}; }, { delayMs: 0 });
    expect(r.failedJobs[0].error).toBe('Unknown error');
  });

  it('Fortschritt, Hooks und skipped werden durchgereicht', async () => {
    const onProgress = vi.fn();
    const onMatched = vi.fn();
    const onFailed = vi.fn();
    const r = await runMatchingBatch(JOBS, matchFn, { delayMs: 0, skipped: 2, onProgress, onMatched, onFailed });
    expect(onProgress.mock.calls).toEqual([
      [1, 3, JOBS[0].title],
      [2, 3, JOBS[1].title],
      [3, 3, JOBS[2].title]
    ]);
    expect(onMatched).toHaveBeenCalledTimes(2);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(r.skipped).toBe(2);
  });

  it('Pause nur ZWISCHEN den Jobs (n-1 mal), nicht nach dem letzten', async () => {
    vi.useFakeTimers();
    try {
      const spy = vi.spyOn(globalThis, 'setTimeout');
      const p = runMatchingBatch(JOBS, matchFn, { delayMs: 500 });
      await vi.runAllTimersAsync();
      await p;
      expect(spy.mock.calls.filter(c => c[1] === 500)).toHaveLength(2);
      spy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leere Liste → leeres Ergebnis, matchFn nie aufgerufen', async () => {
    const r = await runMatchingBatch([], matchFn, { delayMs: 0 });
    expect(r).toEqual({ matched: 0, failed: 0, skipped: 0, errors: [], matchedJobs: [], failedJobs: [] });
    expect(matchFn).not.toHaveBeenCalled();
  });
});

describe('jobListViewPrefs – ID-Spalte', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => { data[k] = v; },
      data
    };
  }
  const throwing = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); }
  };

  it('Default: aus', () => {
    expect(readShowIdColumn(memoryStorage())).toBe(false);
    expect(readShowIdColumn(undefined)).toBe(false);
  });

  it('merkt sich ein/aus', () => {
    const s = memoryStorage();
    writeShowIdColumn(true, s);
    expect(s.data[SHOW_ID_COLUMN_KEY]).toBe('true');
    expect(readShowIdColumn(s)).toBe(true);
    writeShowIdColumn(false, s);
    expect(readShowIdColumn(s)).toBe(false);
  });

  it('unbekannter Wert → aus', () => {
    expect(readShowIdColumn(memoryStorage({ [SHOW_ID_COLUMN_KEY]: 'yes' }))).toBe(false);
  });

  it('werfender Speicher → kein Absturz, Default aus', () => {
    expect(readShowIdColumn(throwing)).toBe(false);
    expect(() => writeShowIdColumn(true, throwing)).not.toThrow();
  });
});

describe('getJobs – Sortierung nach ID', () => {
  beforeEach(() => {
    const db = getDatabase();
    db.prepare('DELETE FROM matching_results').run();
    db.prepare('DELETE FROM job_offers').run();
  });

  async function make(title: string) {
    return jobService.createJob({
      title,
      company: 'Firma',
      postedDate: new Date('2026-10-01'),
      sourceId: 1,
      status: 'new',
      importMethod: 'manual'
    } as JobOfferInput);
  }

  it('asc und desc nach id', async () => {
    const a = await make('B-Titel');
    const b = await make('A-Titel');
    const c = await make('C-Titel');
    const ids = [a.id, b.id, c.id] as number[];

    const asc = await jobService.getJobs(undefined, { sortBy: 'id', sortOrder: 'asc' });
    expect(asc.jobs.map(j => j.id)).toEqual([...ids].sort((x, y) => x - y));

    const desc = await jobService.getJobs(undefined, { sortBy: 'id', sortOrder: 'desc' });
    expect(desc.jobs.map(j => j.id)).toEqual([...ids].sort((x, y) => y - x));
  });

  it('title ist ebenfalls gültiges sortBy (vorher Typ-Lücke)', async () => {
    await make('B-Titel');
    await make('A-Titel');
    const r = await jobService.getJobs(undefined, { sortBy: 'title', sortOrder: 'asc' });
    expect(r.jobs.map(j => j.title)).toEqual(['A-Titel', 'B-Titel']);
  });
});
