/**
 * Unit tests for CSV job export (feat/jobs-csv-export)
 *
 * Deckt ab: Datumsgrenzen (inklusive), leerer Bereich, Quoting/Sonderzeichen,
 * Jobs ohne Score (leere Zelle, nicht "null"), BOM, Match-Kategorie-Label und
 * lokale Datums-/Zeitzonen-Behandlung (Tag-Wechsel um Mitternacht UTC).
 *
 * Feste Zeitzone (Europe/Berlin) für den Tag-Wechsel-Test: gesetzt über
 * vitest.config.ts (env.TZ) und in CI zusätzlich als echte OS-Env
 * (.github/workflows/test.yml). Ein `process.env.TZ` HIER im Testfile käme zu
 * spät – glibc cached die Zone beim ersten Date-Aufruf (in setup.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// exportService importiert `electron` (dialog/shell) und `electron-log` auf
// Modulebene. Unter Node (vitest/CI ohne Electron-Runtime) wirft
// `require('electron')` "Electron failed to install correctly". Deshalb VOR dem
// Service-Import mocken – die echte SQLite-DB (getDatabase) bleibt unangetastet.
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
  app: { getPath: vi.fn(() => '') }
}));
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

import * as exportService from '../../src/main/services/exportService';
import { getDatabase } from '../../src/main/database/db';

const SOURCE_LINKEDIN = 1; // seeded (20250930000002_seed_initial_data.js)

function clearJobs(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
}

beforeEach(() => {
  clearJobs();
});

interface InsertOpts {
  title: string;
  company: string;
  url?: string | null;
  createdAt: string;      // beliebiges Datumsformat (ISO-Z o. ä.)
  postedDate?: string;
  status?: string;
  matchScore?: number | null;
}

function insertJob(opts: InsertOpts): number {
  const db = getDatabase();
  const info = db
    .prepare(
      `INSERT INTO job_offers (source_id, title, company, url, posted_date, status, match_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      SOURCE_LINKEDIN,
      opts.title,
      opts.company,
      opts.url ?? null,
      opts.postedDate ?? '2026-07-01T12:00:00.000Z',
      opts.status ?? 'new',
      opts.matchScore ?? null,
      opts.createdAt
    );
  return info.lastInsertRowid as number;
}

/** CSV ohne BOM in Datenzeilen zerlegen (Header = [0]). */
function dataLines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(l => l.length > 0);
}

describe('generateJobsCsv – Datumsgrenzen (inklusive)', () => {
  it('schließt Rand-Tage ein und Nachbartage aus', () => {
    insertJob({ title: 'RandVon', company: 'C', createdAt: '2026-07-01T12:00:00.000Z' });
    insertJob({ title: 'Mitte', company: 'C', createdAt: '2026-07-04T12:00:00.000Z' });
    insertJob({ title: 'RandBis', company: 'C', createdAt: '2026-07-07T12:00:00.000Z' });
    insertJob({ title: 'DavorRaus', company: 'C', createdAt: '2026-06-30T12:00:00.000Z' });
    insertJob({ title: 'DanachRaus', company: 'C', createdAt: '2026-07-08T12:00:00.000Z' });

    const { csv, count } = exportService.generateJobsCsv({ dateFrom: '2026-07-01', dateTo: '2026-07-07' });

    expect(count).toBe(3);
    expect(csv).toContain('RandVon');
    expect(csv).toContain('Mitte');
    expect(csv).toContain('RandBis');
    expect(csv).not.toContain('DavorRaus');
    expect(csv).not.toContain('DanachRaus');
  });
});

describe('generateJobsCsv – leerer Bereich', () => {
  it('liefert nur die Header-Zeile und count 0', () => {
    insertJob({ title: 'X', company: 'C', createdAt: '2026-07-01T12:00:00.000Z' });

    const { csv, count } = exportService.generateJobsCsv({ dateFrom: '2026-08-01', dateTo: '2026-08-31' });

    expect(count).toBe(0);
    const lines = dataLines(csv);
    expect(lines).toHaveLength(1); // nur Header
    expect(lines[0]).toContain('Titel');
    expect(lines[0]).toContain('hinzugefügt am');
  });
});

describe('generateJobsCsv – Quoting / Sonderzeichen', () => {
  it('quotet Felder mit Komma, Anführungszeichen und Zeilenumbruch korrekt', () => {
    insertJob({
      title: 'Senior Dev, "Java"\nRemote',
      company: 'ACME, Inc.',
      createdAt: '2026-07-03T12:00:00.000Z'
    });

    const { csv } = exportService.generateJobsCsv({ dateFrom: '2026-07-03', dateTo: '2026-07-03' });

    expect(csv).toContain('"Senior Dev, ""Java""\nRemote"');
    expect(csv).toContain('"ACME, Inc."');
  });
});

describe('generateJobsCsv – Jobs ohne Score', () => {
  it('liefert eine leere Zelle (nicht "null")', () => {
    insertJob({ title: 'NoScore', company: 'C', createdAt: '2026-07-03T12:00:00.000Z', matchScore: null });

    const { csv } = exportService.generateJobsCsv({ dateFrom: '2026-07-03', dateTo: '2026-07-03' });

    const row = dataLines(csv)[1];
    const cells = row.split(',');
    // Spalten: Titel,Firma,Match-Score,Match-Kategorie,Status,Quelle,URL,hinzugefügt am,veröffentlicht am
    expect(cells[0]).toBe('NoScore');
    expect(cells[2]).toBe(''); // Match-Score leer
    expect(cells[3]).toBe(''); // Match-Kategorie leer
    expect(row).not.toContain('null');
  });
});

describe('generateJobsCsv – BOM & Match-Kategorie-Label', () => {
  it('beginnt mit BOM und übersetzt die Kategorie ins Deutsche', () => {
    const jid = insertJob({ title: 'Cat', company: 'C', createdAt: '2026-07-03T12:00:00.000Z', matchScore: 80 });
    getDatabase()
      .prepare(
        `INSERT INTO matching_results (job_id, prompt_id, match_score, match_category, gap_analysis)
         VALUES (?, 1, 80, 'good', '[]')`
      )
      .run(jid);

    const { csv } = exportService.generateJobsCsv({ dateFrom: '2026-07-03', dateTo: '2026-07-03' });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    const cells = dataLines(csv)[1].split(',');
    expect(cells[2]).toBe('80');
    expect(cells[3]).toBe('Guter Fit'); // getCategoryLabel('good')
  });
});

describe('generateJobsCsv – lokale Zeitzone (Tag-Wechsel um Mitternacht UTC)', () => {
  it('ordnet 22:30 UTC dem lokalen Folgetag zu (MESZ +2), konsistent zur UI', () => {
    // 2026-07-19 22:30 UTC = 2026-07-20 00:30 Europe/Berlin (MESZ)
    insertJob({ title: 'Midnight', company: 'C', createdAt: '2026-07-19T22:30:00.000Z' });

    const local = exportService.generateJobsCsv({ dateFrom: '2026-07-20', dateTo: '2026-07-20' });
    expect(local.count).toBe(1);
    const cells = dataLines(local.csv)[1].split(',');
    expect(cells[7]).toBe('2026-07-20'); // "hinzugefügt am" = lokaler Tag

    // Unter dem UTC-Tag darf er NICHT erscheinen
    const utc = exportService.generateJobsCsv({ dateFrom: '2026-07-19', dateTo: '2026-07-19' });
    expect(utc.count).toBe(0);
  });
});

describe('generateJobsCsv – CSV-Formel-Injection-Schutz', () => {
  it('neutralisiert Felder, die mit = + - @ beginnen, mit führendem Apostroph', () => {
    insertJob({ title: '=SUMME(A1)', company: '@firma', createdAt: '2026-07-03T12:00:00.000Z' });

    const { csv } = exportService.generateJobsCsv({ dateFrom: '2026-07-03', dateTo: '2026-07-03' });
    const row = dataLines(csv)[1];
    const cells = row.split(',');

    // Titel: neutralisiert (führendes '), unquoted da kein , " CR LF enthalten.
    expect(cells[0]).toBe("'=SUMME(A1)");
    expect(cells[1]).toBe("'@firma");
    // Keine aktive Formel mehr am Zellenanfang.
    expect(csv).not.toContain(',=SUMME');
    expect(csv).not.toContain(',@firma');
  });

  it('lässt normale Werte (Zahlen, ISO-Daten) unangetastet', () => {
    insertJob({ title: 'Normaler Titel', company: 'ACME', createdAt: '2026-07-03T12:00:00.000Z', matchScore: 55 });

    const { csv } = exportService.generateJobsCsv({ dateFrom: '2026-07-03', dateTo: '2026-07-03' });
    const cells = dataLines(csv)[1].split(',');
    expect(cells[0]).toBe('Normaler Titel'); // kein Apostroph
    expect(cells[2]).toBe('55');             // Score unverändert
    expect(cells[7]).toBe('2026-07-03');     // Datum unverändert
  });
});
