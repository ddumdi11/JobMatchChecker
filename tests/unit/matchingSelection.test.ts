/**
 * Bulk-/Auswahl-Matching schließt archivierte Jobs aus
 * (fix/bulk-match-exclude-archived).
 *
 * Befund aus Issue #76: status='archived' war nur ein Label – "Neue matchen"
 * und "Alle neu matchen" erfassten archivierte Jobs mit und kosteten Tokens.
 * Nur die Matching-Auswahl ändert sich; der Listenfilter "Alle" bleibt (#76).
 *
 * Läuft gegen die pro Datei migrierte Test-DB (tests/setup.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../src/main/database/db';
import {
  selectJobsForBulkMatching,
  selectJobsForSelectedMatching,
  countJobsForBulkMatching
} from '../../src/main/services/matchingSelection';

function insertJob(title: string, opts: { status?: string | null; score?: number | null; fullText?: string | null } = {}): number {
  const db = getDatabase();
  const res = db.prepare(`
    INSERT INTO job_offers (source_id, title, company, posted_date, full_text, status, match_score, import_method)
    VALUES (1, ?, 'Firma', '2026-10-01', ?, ?, ?, 'manual')
  `).run(
    title,
    opts.fullText === undefined ? 'Volltext' : opts.fullText,
    opts.status === undefined ? 'new' : opts.status,
    opts.score ?? null
  );
  return Number(res.lastInsertRowid);
}

const titles = (rows: { title: string }[]) => rows.map(r => r.title).sort();

let ids: Record<string, number>;

beforeEach(() => {
  const db = getDatabase();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
  ids = {
    neuOhneScore: insertJob('Neu ohne Score'),
    archiviertOhneScore: insertJob('Archiviert ohne Score', { status: 'archived' }),
    archiviertMitScore: insertJob('Archiviert mit Score', { status: 'archived', score: 60 }),
    beworbenMitScore: insertJob('Beworben mit Score', { status: 'applied', score: 70 }),
    ohneText: insertJob('Ohne Volltext', { fullText: '' })
  };
});

describe('selectJobsForBulkMatching', () => {
  it('"Neue matchen": archivierter Job ohne Score wird NICHT gematcht', () => {
    expect(titles(selectJobsForBulkMatching(getDatabase(), false))).toEqual(['Neu ohne Score']);
  });

  it('"Alle neu matchen": alle matchbaren außer archivierten', () => {
    expect(titles(selectJobsForBulkMatching(getDatabase(), true))).toEqual(['Beworben mit Score', 'Neu ohne Score']);
  });

  it('Job mit status NULL bleibt matchbar (kein stilles Wegfiltern)', () => {
    getDatabase().prepare('UPDATE job_offers SET status = NULL WHERE id = ?').run(ids.neuOhneScore);
    expect(titles(selectJobsForBulkMatching(getDatabase(), false))).toEqual(['Neu ohne Score']);
  });
});

describe('countJobsForBulkMatching (Button "Neue matchen (N)")', () => {
  it('zählt archivierte nicht mit und stimmt mit der Auswahl überein', () => {
    const db = getDatabase();
    expect(countJobsForBulkMatching(db, false)).toBe(1);
    expect(countJobsForBulkMatching(db, false)).toBe(selectJobsForBulkMatching(db, false).length);
    expect(countJobsForBulkMatching(db, true)).toBe(selectJobsForBulkMatching(db, true).length);
  });
});

describe('selectJobsForSelectedMatching', () => {
  it('ausgewählte archivierte Jobs fallen raus (Aufrufer zählt sie als skipped)', () => {
    const selected = [ids.neuOhneScore, ids.archiviertOhneScore, ids.beworbenMitScore, ids.ohneText];
    const rows = selectJobsForSelectedMatching(getDatabase(), selected);
    expect(titles(rows)).toEqual(['Beworben mit Score', 'Neu ohne Score']);
    expect(selected.length - rows.length).toBe(2); // archiviert + ohne Text
  });

  it('leere Auswahl → []', () => {
    expect(selectJobsForSelectedMatching(getDatabase(), [])).toEqual([]);
  });
});
