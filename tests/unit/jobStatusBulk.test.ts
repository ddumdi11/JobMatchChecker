/**
 * Bulk-Status-Änderung (feat/bulk-status-update): eine Transaktion, updated_at
 * nur bei echter Änderung, nichts wird gelöscht.
 *
 * Läuft gegen die pro Datei migrierte Test-DB (tests/setup.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../src/main/database/db';
import { setStatusForJobs } from '../../src/main/services/jobStatusBulk';
import { JOB_STATUSES } from '../../src/shared/jobStatus';

const OLD = '2026-01-01 00:00:00';

function insertJob(title: string, status: string | null = 'new'): number {
  const res = getDatabase().prepare(`
    INSERT INTO job_offers (source_id, title, company, posted_date, full_text, status, import_method, created_at, updated_at)
    VALUES (1, ?, 'Firma', '2026-01-01', 'Volltext', ?, 'manual', ?, ?)
  `).run(title, status, OLD, OLD);
  return Number(res.lastInsertRowid);
}

function row(id: number): { status: string | null; updated_at: string; created_at: string; full_text: string } {
  return getDatabase()
    .prepare('SELECT status, updated_at, created_at, full_text FROM job_offers WHERE id = ?')
    .get(id) as any;
}

function jobCount(): number {
  return (getDatabase().prepare('SELECT COUNT(*) AS n FROM job_offers').get() as { n: number }).n;
}

let a: number;
let b: number;
let c: number;

beforeEach(() => {
  const db = getDatabase();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
  a = insertJob('A');
  b = insertJob('B');
  c = insertJob('C', 'applied');
});

describe('setStatusForJobs', () => {
  it('setzt nur die übergebenen Jobs und aktualisiert updated_at', () => {
    expect(setStatusForJobs(getDatabase(), [a, b], 'outdated')).toEqual({ updated: 2, unchanged: 0, notFound: 0 });
    for (const id of [a, b]) {
      expect(row(id).status).toBe('outdated');
      expect(row(id).updated_at).not.toBe(OLD);
      expect(row(id).created_at).toBe(OLD);
      expect(row(id).full_text).toBe('Volltext');
    }
    expect(row(c)).toMatchObject({ status: 'applied', updated_at: OLD });
    expect(jobCount()).toBe(3);
  });

  it('Job mit Ziel-Status bleibt unberührt (auch updated_at)', () => {
    expect(setStatusForJobs(getDatabase(), [a, c], 'applied')).toEqual({ updated: 1, unchanged: 1, notFound: 0 });
    expect(row(c).updated_at).toBe(OLD);
  });

  it('status NULL zählt als Änderung', () => {
    const nullId = insertJob('Ohne Status', null);
    expect(setStatusForJobs(getDatabase(), [nullId], 'outdated').updated).toBe(1);
    expect(row(nullId).status).toBe('outdated');
  });

  it('doppelte IDs zählen einmal, fehlende IDs werden gemeldet', () => {
    expect(setStatusForJobs(getDatabase(), [a, a, 999999], 'archived')).toEqual({ updated: 1, unchanged: 0, notFound: 1 });
  });

  it('leere Auswahl ändert nichts', () => {
    expect(setStatusForJobs(getDatabase(), [], 'outdated')).toEqual({ updated: 0, unchanged: 0, notFound: 0 });
  });

  it('akzeptiert jeden definierten Status', () => {
    for (const status of JOB_STATUSES) {
      setStatusForJobs(getDatabase(), [a], status);
      expect(row(a).status).toBe(status);
    }
  });

  it('ungültiger Status bzw. ungültige IDs → Fehler, nichts geändert', () => {
    expect(() => setStatusForJobs(getDatabase(), [a], 'expired' as any)).toThrow(/Ungültiger Status/);
    expect(() => setStatusForJobs(getDatabase(), [a, 1.5], 'outdated')).toThrow(/Ungültige Job-IDs/);
    expect(() => setStatusForJobs(getDatabase(), ['1'] as any, 'outdated')).toThrow(/Ungültige Job-IDs/);
    expect(() => setStatusForJobs(getDatabase(), null as any, 'outdated')).toThrow(/Ungültige Job-IDs/);
    expect(row(a)).toMatchObject({ status: 'new', updated_at: OLD });
  });

  it('Fehler mitten im Lauf → alles zurückgerollt', () => {
    const db = getDatabase();
    db.exec(`
      CREATE TRIGGER test_block_update BEFORE UPDATE ON job_offers
      WHEN OLD.title = 'B' BEGIN SELECT RAISE(ABORT, 'blockiert'); END;
    `);
    try {
      expect(() => setStatusForJobs(db, [a, b], 'outdated')).toThrow(/blockiert/);
    } finally {
      db.exec('DROP TRIGGER test_block_update');
    }
    expect(row(a)).toMatchObject({ status: 'new', updated_at: OLD });
    expect(row(b)).toMatchObject({ status: 'new', updated_at: OLD });
  });
});
