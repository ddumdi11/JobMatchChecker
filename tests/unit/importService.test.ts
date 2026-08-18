/**
 * Unit-/Integrationstests für den Dual-URL-Rückkanal (feat/dual-url-roundtrip):
 * Format-Erkennung, deterministisches jobs_with_links-Mapping (KEINE KI),
 * Byte-genauer Import→Export-Roundtrip von source_url (LinkedIn mit Schluss-Slash
 * & XING /m/<token>), NULL-Verhalten (manuell erfasste Jobs → leere Felder),
 * Dedup auf url und Schema-Bestands-NULL.
 *
 * DB-gestützt: getDatabase() zeigt via setup.ts auf eine frisch migrierte Test-DB
 * (inkl. der neuen Migrationen). electron/electron-log werden – wie bei den
 * anderen Service-Tests – vor dem Import gemockt (Node/CI ohne Electron-Runtime).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import * as importService from '../../src/main/services/importService';
import * as jobService from '../../src/main/services/jobService';
import * as exportService from '../../src/main/services/exportService';
import { getDatabase } from '../../src/main/database/db';

function clearJobs(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM import_staging').run();
  db.prepare('DELETE FROM import_sessions').run();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
}

beforeEach(() => {
  clearJobs();
});

/** Baut eine jobs_with_links.csv (RFC4180, eine Datenzeile je jobs-Eintrag). */
function jobsWithLinksCsv(
  rows: Array<{ datum?: string; quelle?: string; jobtitel: string; unternehmen: string; ort?: string; link: string; messageId?: string; betreff?: string }>
): string {
  const header = '"Stars","Datum","Quelle","Jobtitel","Unternehmen","Ort","Link","message_id","Mail-Betreff"';
  const lines = rows.map(r =>
    ['5', r.datum ?? '24.07.2026', r.quelle ?? 'XING', r.jobtitel, r.unternehmen, r.ort ?? 'Neuss', r.link, r.messageId ?? '<mid@mail>', r.betreff ?? 'Neue Jobs']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...lines].join('\r\n') + '\r\n';
}

/** Datenzeilen einer Export-CSV (ohne BOM, ohne Header). */
function dataLines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(l => l.length > 0);
}

// ---------------------------------------------------------------------------

describe('detectFormat – Header-basierte Format-Erkennung', () => {
  it('erkennt jobs_with_links an Link + message_id', () => {
    expect(
      importService.detectFormat(['Stars', 'Datum', 'Quelle', 'Jobtitel', 'Unternehmen', 'Ort', 'Link', 'message_id', 'Mail-Betreff'])
    ).toBe('jobs_with_links');
  });

  it('erkennt jobs.csv-Altformat an url + title', () => {
    expect(importService.detectFormat(['id', 'url', 'title', 'content', 'from_email'])).toBe('jobs_csv');
  });

  it('wirft bei unbekanntem Header (kein leerer Import)', () => {
    expect(() => importService.detectFormat(['foo', 'bar', 'baz'])).toThrow(/Unbekanntes CSV-Format/);
  });
});

describe('parseGermanDateToIso', () => {
  it('konvertiert DD.MM.YYYY zum lokalstabilen Kalendertag (Mittag UTC)', () => {
    expect(importService.parseGermanDateToIso('24.07.2026')).toBe('2026-07-24T12:00:00.000Z');
    expect(importService.parseGermanDateToIso('01.01.2026')).toBe('2026-01-01T12:00:00.000Z');
  });

  it('lehnt Ungültiges/Leeres ab (→ null)', () => {
    expect(importService.parseGermanDateToIso('2026-07-24')).toBeNull(); // ISO ist nicht DD.MM.YYYY
    expect(importService.parseGermanDateToIso('32.13.2026')).toBeNull();
    expect(importService.parseGermanDateToIso('')).toBeNull();
    expect(importService.parseGermanDateToIso(undefined)).toBeNull();
  });

  it('lehnt kalender-ungültige Tage ab, statt still weiterzurollen', () => {
    // 31.02. würde in Date.UTC auf den 03.03. rollen – muss null sein.
    expect(importService.parseGermanDateToIso('31.02.2026')).toBeNull();
    expect(importService.parseGermanDateToIso('31.04.2026')).toBeNull(); // April hat 30 Tage
    expect(importService.parseGermanDateToIso('29.02.2025')).toBeNull(); // kein Schaltjahr
    expect(importService.parseGermanDateToIso('29.02.2028')).toBe('2028-02-29T12:00:00.000Z'); // Schaltjahr ok
  });
});

describe('parseCsv – deterministisches jobs_with_links-Mapping (keine KI)', () => {
  it('mappt Spalten, hält source_url ROH und bereinigt url', () => {
    const csv = jobsWithLinksCsv([
      { jobtitel: 'Anwendungsbetreuer', unternehmen: 'ITK Rheinland', ort: 'Neuss', quelle: 'XING', datum: '24.07.2026', link: 'https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK', messageId: '<abc@mail>' }
    ]);
    const rows = importService.parseCsv(csv);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r._format).toBe('jobs_with_links');
    expect(r.title).toBe('Anwendungsbetreuer');
    expect(r.company).toBe('ITK Rheinland');
    expect(r.location).toBe('Neuss');
    expect(r.source).toBe('XING');
    expect(r.source_url).toBe('https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK'); // ROH
    expect(r.url).toBe('https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK');        // XING via cleanJobUrl unverändert
    expect(r.message_id).toBe('<abc@mail>');
    expect(r.posted_date).toBe('2026-07-24T12:00:00.000Z');
    expect(r.content).toBeUndefined(); // kein Volltext → keine KI
  });

  it('bereinigt LinkedIn-url, lässt source_url aber mit Schluss-Slash unangetastet', () => {
    const csv = jobsWithLinksCsv([
      { jobtitel: 'Dev', unternehmen: 'ACME', quelle: 'LinkedIn', link: 'https://www.linkedin.com/jobs/view/123/?refId=xyz&trk=abc' }
    ]);
    const r = importService.parseCsv(csv)[0];
    expect(r.source_url).toBe('https://www.linkedin.com/jobs/view/123/?refId=xyz&trk=abc'); // ROH inkl. Query
    expect(r.url).toBe('https://www.linkedin.com/jobs/view/123/');                          // kanonisch, Query weg
  });
});

describe('Import end-to-end – Persistenz von source_url/message_id (jobs_with_links)', () => {
  it('legt Job ohne full_text an, mit deterministischen Feldern und Rückkanal-Daten', async () => {
    const csv = jobsWithLinksCsv([
      { jobtitel: 'Backend Engineer', unternehmen: 'Globex', ort: 'Ratingen', quelle: 'LinkedIn', datum: '10.07.2026', link: 'https://www.linkedin.com/jobs/view/999/', messageId: '<m999@mail>' }
    ]);
    const session = importService.processImportCsv('jobs_with_links.csv', csv);
    const res = await importService.importAllNewRows(session.id);
    expect(res.imported).toBe(1);

    const { jobs } = await jobService.getJobs();
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(job.title).toBe('Backend Engineer');
    expect(job.company).toBe('Globex'); // deterministisch, NICHT "Unknown"
    expect(job.location).toBe('Ratingen');
    expect(job.sourceUrl).toBe('https://www.linkedin.com/jobs/view/999/'); // ROH gespeichert
    expect(job.messageId).toBe('<m999@mail>');
    expect(job.url).toBe('https://www.linkedin.com/jobs/view/999/');       // bereinigt (hier identisch)
    expect(job.fullText == null || job.fullText === undefined).toBe(true); // kein Volltext
  });

  it('greift der Dedup-Add-Check auch für jobs_with_links (auf url)', () => {
    const db = getDatabase();
    // Bestehender Job mit derselben bereinigten url.
    db.prepare(
      `INSERT INTO job_offers (source_id, title, company, url, posted_date, status)
       VALUES (1, 'Vorhanden', 'ACME', 'https://www.linkedin.com/jobs/view/555/', '2026-07-01T12:00:00.000Z', 'new')`
    ).run();

    const csv = jobsWithLinksCsv([
      { jobtitel: 'Neu', unternehmen: 'ACME', quelle: 'LinkedIn', link: 'https://www.linkedin.com/jobs/view/555/?trk=abc' }
    ]);
    const session = importService.processImportCsv('jobs_with_links.csv', csv);
    const staging = importService.getStagingRows(session.id);
    expect(staging).toHaveLength(1);
    expect(staging[0].status).toBe('duplicate'); // url-Match trotz Tracking-Query
  });
});

describe('Byte-Roundtrip: source_url Import == Export (beide URL-Formen)', () => {
  it.each([
    ['LinkedIn mit Schluss-Slash', 'https://www.linkedin.com/jobs/view/424242/'],
    // Nicht-kanonisch mit Query: source_url MUSS den Query-String behalten
    // (url würde von cleanJobUrl kanonisiert – source_url NICHT).
    ['LinkedIn nicht-kanonisch mit Query', 'https://www.linkedin.com/jobs/view/424242/?refId=abc&trk=xyz'],
    ['XING /m/<token>', 'https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK']
  ])('%s bleibt byte-identisch', async (_name, link) => {
    const csv = jobsWithLinksCsv([{ jobtitel: 'RT', unternehmen: 'RTco', quelle: 'XING', link }]);
    const session = importService.processImportCsv('jobs_with_links.csv', csv);
    await importService.importAllNewRows(session.id);

    const { csv: out } = exportService.generateJobsCsv({ profile: 'nanobot' });
    const cells = dataLines(out)[1].split(',');
    // Spalte 0 = source_url; keine Sonderzeichen → kein Quoting → direkter Vergleich.
    expect(cells[0]).toBe(link);
  });
});

describe('NULL-Verhalten – manuell erfasste Jobs', () => {
  it('exportiert leere source_url/message_id-Felder (nie "NULL")', async () => {
    await jobService.createJob({
      title: 'Manuell',
      company: 'Handarbeit',
      sourceId: 1,
      postedDate: new Date('2026-07-05T12:00:00.000Z'),
      url: 'https://example.com/jobs/1',
      status: 'new',
      importMethod: 'manual'
    } as any);

    const { csv } = exportService.generateJobsCsv({ profile: 'nanobot' });
    const cells = dataLines(csv)[1].split(',');
    expect(cells[0]).toBe(''); // source_url leer
    expect(cells[1]).toBe(''); // message_id leer
    expect(csv).not.toContain('NULL');
  });
});

describe('Schema – Bestands-NULL', () => {
  it('job_offers hat source_url/message_id, Alt-Insert ohne diese Felder → NULL', () => {
    const db = getDatabase();
    const cols = (db.prepare(`PRAGMA table_info(job_offers)`).all() as Array<{ name: string }>).map(c => c.name);
    expect(cols).toContain('source_url');
    expect(cols).toContain('message_id');

    // Insert wie Bestandsdaten (ohne die neuen Spalten) → beide NULL.
    const info = db.prepare(
      `INSERT INTO job_offers (source_id, title, company, url, posted_date, status)
       VALUES (1, 'Alt', 'Bestand', 'https://example.com/jobs/9', '2026-01-01T12:00:00.000Z', 'new')`
    ).run();
    const rowread = db.prepare('SELECT source_url, message_id FROM job_offers WHERE id = ?').get(info.lastInsertRowid) as { source_url: unknown; message_id: unknown };
    expect(rowread.source_url).toBeNull();
    expect(rowread.message_id).toBeNull();
  });
});
