/**
 * Unit-Tests für das geteilte CSV-Serialisierungsmodul (src/shared/jobCsv.ts),
 * Fokus nanobot-Profil (Rohwerte für jobs_processed.csv) und der geteilte
 * Datums-Fensterfilter. Rein funktional – keine DB, kein window.api, kein
 * electron. Zeitzone via globalSetup auf Europe/Berlin gepinnt.
 */
import { describe, it, expect } from 'vitest';
import {
  serializeJobsCsv,
  localDateInRange,
  neutralizeFormula,
  csvProfiles,
  type JobCsvRow
} from '../../src/shared/jobCsv';

function row(overrides: Partial<JobCsvRow> = {}): JobCsvRow {
  return {
    title: 'Dev',
    company: 'ACME',
    matchScore: null,
    matchCategory: null,
    status: 'new',
    sourceName: null,
    url: null,
    sourceUrl: null,
    messageId: null,
    createdAt: '2026-07-15 12:00:00',
    postedDate: null,
    ...overrides
  };
}

/** Datenzeilen (ohne BOM, ohne Header). */
function dataLines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').split('\r\n').filter(l => l.length > 0);
}

describe('nanobot-Profil – Spaltenaufbau (Rohwerte)', () => {
  it('hat genau die abgestimmten Spalten in der richtigen Reihenfolge', () => {
    expect(csvProfiles.nanobot.map(c => c.header)).toEqual([
      'source_url', 'message_id', 'url', 'title', 'company', 'match_score', 'status', 'processed_at'
    ]);
  });

  it('serialisiert Rohwerte: Status roh, Score leer bei null, processed_at lokaler ISO-Tag', () => {
    const { csv, count } = serializeJobsCsv(
      [row({ title: 'Backend', company: 'Globex', status: 'applied', matchScore: null, createdAt: '2026-07-15 12:00:00' })],
      'nanobot'
    );
    expect(count).toBe(1);
    const cells = dataLines(csv)[1].split(',');
    // source_url,message_id,url,title,company,match_score,status,processed_at
    expect(cells[3]).toBe('Backend');
    expect(cells[4]).toBe('Globex');
    expect(cells[5]).toBe('');          // Score leer, nicht "null"
    expect(cells[6]).toBe('applied');   // Rohwert, NICHT "Beworben"
    expect(cells[7]).toBe('2026-07-15');
  });

  it('gibt source_url/message_id ROH aus (kein cleanJobUrl) und leer bei null', () => {
    // XING-Tracking-Link: source_url byte-identisch, url via cleanJobUrl (XING unverändert).
    const withLink = serializeJobsCsv(
      [row({ sourceUrl: 'https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK', messageId: '<abc@mail>', url: 'https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK' })],
      'nanobot'
    );
    const cells = dataLines(withLink.csv)[1].split(',');
    expect(cells[0]).toBe('https://www.xing.com/m/s59bHHnmzWETgf8bNLHKgK'); // source_url roh
    expect(cells[1]).toBe('<abc@mail>');                                     // message_id roh

    // Manuell erfasster Job (kein Rückkanal): beide Felder leer, nie "null".
    const manual = serializeJobsCsv([row({ sourceUrl: null, messageId: null })], 'nanobot');
    const mCells = dataLines(manual.csv)[1].split(',');
    expect(mCells[0]).toBe('');
    expect(mCells[1]).toBe('');
  });

  it('bereinigt die URL via cleanJobUrl (LinkedIn kanonisch, Query weg, null → leer)', () => {
    const linkedin = serializeJobsCsv(
      [row({ url: 'https://www.linkedin.com/jobs/view/456/?refId=abc&trk=xyz' })],
      'nanobot'
    );
    expect(dataLines(linkedin.csv)[1].split(',')[2]).toBe('https://www.linkedin.com/jobs/view/456/');

    const generic = serializeJobsCsv([row({ url: 'https://example.com/jobs/42?utm_source=x' })], 'nanobot');
    expect(dataLines(generic.csv)[1].split(',')[2]).toBe('https://example.com/jobs/42');

    const none = serializeJobsCsv([row({ url: null })], 'nanobot');
    expect(dataLines(none.csv)[1].split(',')[2]).toBe('');
  });

  it('gibt Match-Score als Rohzahl ohne Formatierung aus', () => {
    const { csv } = serializeJobsCsv([row({ matchScore: 73 })], 'nanobot');
    expect(dataLines(csv)[1].split(',')[5]).toBe('73');
  });
});

describe('nanobot-Profil – BOM, Quoting, Formel-Schutz', () => {
  it('beginnt mit BOM und nutzt CRLF-Zeilen', () => {
    const { csv } = serializeJobsCsv([row()], 'nanobot');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.includes('\r\n')).toBe(true);
  });

  it('quotet Komma/Anführungszeichen korrekt (RFC4180)', () => {
    const { csv } = serializeJobsCsv([row({ title: 'Dev, "Senior"' })], 'nanobot');
    expect(csv).toContain('"Dev, ""Senior"""');
  });

  it('neutralisiert Formel-Auslöser am Zellenanfang', () => {
    const { csv } = serializeJobsCsv([row({ company: '=SUM(A1)' })], 'nanobot');
    expect(dataLines(csv)[1].split(',')[4]).toBe("'=SUM(A1)");
  });

  it('neutralisiert auch führende Steuerzeichen (Tab/CR/LF) vor einer Formel', () => {
    // = + - @ plus Tab/CR/LF am Anfang → führender Apostroph.
    expect(neutralizeFormula('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(neutralizeFormula('+1')).toBe("'+1");
    expect(neutralizeFormula('-1')).toBe("'-1");
    expect(neutralizeFormula('@cmd')).toBe("'@cmd");
    expect(neutralizeFormula('\t=SUM(A1)')).toBe("'\t=SUM(A1)"); // Tab maskiert Formel
    expect(neutralizeFormula('\r=cmd')).toBe("'\r=cmd");
    expect(neutralizeFormula('\n=cmd')).toBe("'\n=cmd");
    // Harmlose Werte bleiben unangetastet.
    expect(neutralizeFormula('Normal')).toBe('Normal');
    expect(neutralizeFormula('73')).toBe('73');
    expect(neutralizeFormula('2026-07-15')).toBe('2026-07-15');
  });

  it('serialisiert einen Tab-maskierten Formelwert mit Apostroph', () => {
    const { csv } = serializeJobsCsv([row({ company: '\t=SUM(A1)' })], 'nanobot');
    expect(dataLines(csv)[1].split(',')[4]).toBe("'\t=SUM(A1)");
  });
});

describe('localDateInRange – Fenster-Grenzen (inklusive)', () => {
  it('schließt Rand-Tage ein und Nachbartage aus', () => {
    expect(localDateInRange('2026-07-01 12:00:00', '2026-07-01', '2026-07-07')).toBe(true);  // untere Grenze
    expect(localDateInRange('2026-07-07 12:00:00', '2026-07-01', '2026-07-07')).toBe(true);  // obere Grenze
    expect(localDateInRange('2026-07-04 12:00:00', '2026-07-01', '2026-07-07')).toBe(true);  // Mitte
    expect(localDateInRange('2026-06-30 12:00:00', '2026-07-01', '2026-07-07')).toBe(false); // davor
    expect(localDateInRange('2026-07-08 12:00:00', '2026-07-01', '2026-07-07')).toBe(false); // danach
  });

  it('offene Grenzen (null) und ungültige/leere Daten', () => {
    expect(localDateInRange('2026-01-01 12:00:00', null, null)).toBe(true);
    expect(localDateInRange('2026-01-01 12:00:00', '2025-01-01', null)).toBe(true);
    expect(localDateInRange('2020-01-01 12:00:00', '2025-01-01', null)).toBe(false);
    expect(localDateInRange(null, null, null)).toBe(false);
    expect(localDateInRange('', '2026-01-01', '2026-12-31')).toBe(false);
  });

  it('filtert eine Zeilenmenge auf das Fenster (90-Tage-Szenario)', () => {
    // Fenster [2026-04-23 .. 2026-07-21] = letzte 90 Tage inkl. heute (Konvention heute-89 … heute).
    const from = '2026-04-23';
    const to = '2026-07-21';
    const rows = [
      row({ title: 'RandVon', createdAt: '2026-04-23 09:00:00' }),
      row({ title: 'Mitte', createdAt: '2026-06-01 09:00:00' }),
      row({ title: 'RandBis', createdAt: '2026-07-21 09:00:00' }),
      row({ title: 'ZuAlt', createdAt: '2026-04-22 09:00:00' }),
      row({ title: 'ZuNeu', createdAt: '2026-07-22 09:00:00' })
    ];
    const kept = rows.filter(r => localDateInRange(r.createdAt, from, to)).map(r => r.title);
    expect(kept).toEqual(['RandVon', 'Mitte', 'RandBis']);
  });
});
