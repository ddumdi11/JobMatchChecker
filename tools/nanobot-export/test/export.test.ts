/**
 * Tests für das Standalone-nanobot-Export-Tool.
 *
 * Läuft im Tool-Package mit dessen EIGENEM better-sqlite3 (Node-ABI) — genau
 * das beweist die ABI-Unabhängigkeit von der Electron-App. Baut eine echte
 * Temp-SQLite-DB, prüft readonly-Öffnung, 90-Tage-Fenster und Rohwert-Spalten.
 *
 * TZ-robust: Datumswerte um 12:00 (Mittag) und lokal konstruierte `today`-Dates,
 * daher unabhängig von der Runner-Zeitzone.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { openReadOnly, queryJobs, SchemaOutdatedError } from '../src/db';
import { runExport, windowForDays, OUTPUT_FILENAME } from '../src/export';

let tmpDir: string;
let dbPath: string;
let outDir: string;

function createDb(file: string): void {
  const db = new Database(file);
  db.exec(`
    CREATE TABLE job_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      match_score INTEGER,
      status TEXT NOT NULL,
      url TEXT,
      source_url TEXT,
      message_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
  db.close();
}

function insert(row: {
  title: string; company: string; status: string;
  created_at: string; match_score?: number | null; url?: string | null;
  source_url?: string | null; message_id?: string | null;
}): void {
  const db = new Database(dbPath);
  db.prepare(
    `INSERT INTO job_offers (title, company, match_score, status, url, source_url, message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.title, row.company, row.match_score ?? null, row.status,
    row.url ?? null, row.source_url ?? null, row.message_id ?? null, row.created_at
  );
  db.close();
}

/** CSV-Datenzeilen (ohne BOM/Header). */
function dataLines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(l => l.length > 0);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanobot-test-'));
  dbPath = path.join(tmpDir, 'jobmatcher.db');
  outDir = path.join(tmpDir, 'out');
  createDb(dbPath);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readonly-Öffnung', () => {
  it('fileMustExist: wirft bei fehlender DB-Datei', () => {
    expect(() => openReadOnly(path.join(tmpDir, 'gibtsnicht.db'))).toThrow();
  });

  it('readonly: Schreibversuch auf der Verbindung wirft', () => {
    const db = openReadOnly(dbPath);
    try {
      expect(() =>
        db.prepare(`INSERT INTO job_offers (title, company, status, created_at) VALUES ('x','y','new','2026-07-20 12:00:00')`).run()
      ).toThrow(/readonly/i);
    } finally {
      db.close();
    }
  });

  it('legt bei fehlender Datei KEINE neue DB an (fileMustExist)', () => {
    const missing = path.join(tmpDir, 'nope.db');
    try { openReadOnly(missing); } catch { /* erwartet */ }
    expect(fs.existsSync(missing)).toBe(false);
  });
});

describe('Schema aelter als Tool', () => {
  it('wirft SchemaOutdatedError mit Klartext, wenn source_url fehlt', () => {
    // Alt-DB ohne die Rueckkanal-Spalten (source_url/message_id) nachbilden.
    const oldDbPath = path.join(tmpDir, 'old-schema.db');
    const old = new Database(oldDbPath);
    old.exec(`
      CREATE TABLE job_offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        match_score INTEGER,
        status TEXT NOT NULL,
        url TEXT,
        created_at TEXT NOT NULL
      );
    `);
    old.close();

    const db = openReadOnly(oldDbPath);
    try {
      expect(() => queryJobs(db)).toThrow(SchemaOutdatedError);
      expect(() => queryJobs(db)).toThrow(/App einmal starten|Migrationen/i);
      expect(() => queryJobs(db)).toThrow(/source_url/);
    } finally {
      db.close();
    }
  });
});

describe('windowForDays – 90-Tage-Fenster', () => {
  it('to = heute, from = heute − (N−1); Span = 89 Tage bei N=90', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0); // 2026-07-21 lokal
    const { from, to } = windowForDays(90, today);
    expect(to).toBe('2026-07-21');
    // Differenz from→to muss 89 Kalendertage sein.
    const diffDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
    expect(diffDays).toBe(89);
  });

  it('kleines Fenster (N=1) = nur heute', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0);
    expect(windowForDays(1, today)).toEqual({ from: '2026-07-21', to: '2026-07-21' });
  });
});

describe('runExport – Ende-zu-Ende', () => {
  it('exportiert nur Jobs im Fenster, schreibt jobs_processed.csv mit Rohwerten', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0);
    const { from, to } = windowForDays(90, today);

    insert({ title: 'RandVon', company: 'A', status: 'new', created_at: `${from} 12:00:00`, match_score: 55 });
    insert({ title: 'RandBis', company: 'B', status: 'applied', created_at: `${to} 12:00:00`, match_score: null });
    insert({ title: 'ZuAlt', company: 'C', status: 'new', created_at: '2000-01-01 12:00:00' });
    insert({ title: 'ZuNeu', company: 'D', status: 'new', created_at: '2026-07-22 12:00:00' });

    const res = runExport({ days: 90, out: outDir, db: dbPath }, today);

    expect(res.count).toBe(2);
    expect(res.file).toBe(path.join(outDir, OUTPUT_FILENAME));
    expect(fs.existsSync(res.file)).toBe(true);

    const csv = fs.readFileSync(res.file, 'utf-8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = dataLines(csv);
    // Header + 2 Datenzeilen
    expect(lines[0]).toBe('source_url,message_id,url,title,company,match_score,status,processed_at');
    expect(lines).toHaveLength(3);
    expect(csv).toContain('RandVon');
    expect(csv).toContain('RandBis');
    expect(csv).not.toContain('ZuAlt');
    expect(csv).not.toContain('ZuNeu');

    // Rohwerte: Status roh, Score leer bei null, processed_at lokaler Tag.
    const randBis = lines.find(l => l.includes('RandBis'))!.split(',');
    expect(randBis[5]).toBe('');          // match_score leer (nicht "null")
    expect(randBis[6]).toBe('applied');   // Rohwert, nicht "Beworben"
    expect(randBis[7]).toBe(to);
  });

  it('bereinigt die URL via cleanJobUrl (LinkedIn kanonisch)', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0);
    insert({
      title: 'LinkedInJob', company: 'X', status: 'new',
      created_at: `${windowForDays(90, today).to} 12:00:00`,
      url: 'https://www.linkedin.com/jobs/view/789/?refId=abc&trk=xyz'
    });

    const res = runExport({ days: 90, out: outDir, db: dbPath }, today);
    const csv = fs.readFileSync(res.file, 'utf-8');
    const row = dataLines(csv).find(l => l.includes('LinkedInJob'))!.split(',');
    expect(row[2]).toBe('https://www.linkedin.com/jobs/view/789/');
  });

  it('gibt source_url/message_id ROH aus (kein cleanJobUrl) und leer bei null', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0);
    const day = `${windowForDays(90, today).to} 12:00:00`;
    // Rückkanal-Job: roher XING-Tracking-Link + message_id.
    insert({
      title: 'RueckkanalJob', company: 'X', status: 'new', created_at: day,
      url: 'https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK',
      source_url: 'https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK',
      message_id: '<mid-1@mail>'
    });
    // Manuell erfasster Job: keine Rückkanal-Daten → leere Felder.
    insert({ title: 'ManuellJob', company: 'Y', status: 'new', created_at: day, url: 'https://example.com/jobs/1' });

    const res = runExport({ days: 90, out: outDir, db: dbPath }, today);
    const csv = fs.readFileSync(res.file, 'utf-8');

    const rk = dataLines(csv).find(l => l.includes('RueckkanalJob'))!.split(',');
    expect(rk[0]).toBe('https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK'); // source_url roh
    expect(rk[1]).toBe('<mid-1@mail>');                                   // message_id roh

    const man = dataLines(csv).find(l => l.includes('ManuellJob'))!.split(',');
    expect(man[0]).toBe(''); // source_url leer
    expect(man[1]).toBe(''); // message_id leer
    expect(csv).not.toContain('NULL');
  });

  it('leeres Fenster → nur Header, count 0', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0);
    insert({ title: 'Alt', company: 'A', status: 'new', created_at: '2000-01-01 12:00:00' });

    const res = runExport({ days: 90, out: outDir, db: dbPath }, today);
    expect(res.count).toBe(0);
    const lines = dataLines(fs.readFileSync(res.file, 'utf-8'));
    expect(lines).toHaveLength(1); // nur Header
  });

  it('lässt die DB unangetastet (read-only)', () => {
    const today = new Date(2026, 6, 21, 12, 0, 0);
    insert({ title: 'A', company: 'A', status: 'new', created_at: `${windowForDays(90, today).to} 12:00:00` });
    const before = fs.statSync(dbPath).mtimeMs;

    runExport({ days: 90, out: outDir, db: dbPath }, today);

    const db = openReadOnly(dbPath);
    try {
      expect(queryJobs(db)).toHaveLength(1); // nichts gelöscht/verändert
    } finally {
      db.close();
    }
    expect(fs.statSync(dbPath).mtimeMs).toBe(before); // DB-Datei nicht geschrieben
  });
});
