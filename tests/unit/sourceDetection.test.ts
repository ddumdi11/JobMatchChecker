/**
 * Tests für die Quelle-Autoerkennung über die Domain der ERSTEN URL
 * (detectSourceIdFromUrl / detectSourceIdFromText in src/shared/urlUtils.ts).
 *
 * Die Quellen-Fixture spiegelt die domain_patterns, die die Migration
 * 20261011000001 aus job_sources.url ableitet.
 *
 * Feature: feat/source-dropdown-date-default
 */

import { describe, it, expect } from 'vitest';
import {
  detectSourceIdFromUrl,
  detectSourceIdFromText,
  parseDomainPatterns,
  extractLeadingUrls,
  extractOfferUrlFromText,
  type SourceDomainEntry
} from '../../src/shared/urlUtils';

const LINKEDIN = 1;
const XING = 2;
const ARBEITSAGENTUR = 5;
const STELLENANGEBOTE = 13;

const SOURCES: SourceDomainEntry[] = [
  { id: LINKEDIN, domainPatterns: 'linkedin.com' },
  { id: XING, domainPatterns: 'xing.com' },
  { id: 3, domainPatterns: 'stepstone.de' },
  { id: ARBEITSAGENTUR, domainPatterns: 'arbeitsagentur.de' },
  { id: 8, domainPatterns: null }, // Freitext-Quelle ohne url → nie erkannt
  { id: STELLENANGEBOTE, domainPatterns: 'stellenangebote.de' }
];

describe('detectSourceIdFromUrl – die vier Quellen', () => {
  it('LinkedIn (Mail-Tracking-Link /comm/jobs/view)', () => {
    expect(detectSourceIdFromUrl(
      'https://www.linkedin.com/comm/jobs/view/4377827138/?trackingId=abc&trk=eml', SOURCES
    )).toBe(LINKEDIN);
  });

  it('XING (Mail-Link /m/<token>)', () => {
    expect(detectSourceIdFromUrl('https://www.xing.com/m/AbCdEf123', SOURCES)).toBe(XING);
  });

  it('Arbeitsagentur (www. statt web. aus der Startseiten-URL)', () => {
    expect(detectSourceIdFromUrl(
      'https://www.arbeitsagentur.de/jobsuche/jobdetail/10000-1234567890-S', SOURCES
    )).toBe(ARBEITSAGENTUR);
  });

  it('stellenangebote.de', () => {
    expect(detectSourceIdFromUrl('https://www.stellenangebote.de/anzeige/123456.html', SOURCES)).toBe(STELLENANGEBOTE);
  });
});

describe('detectSourceIdFromUrl – Matching-Regeln', () => {
  it('Subdomains matchen per Suffix (jobs./click.)', () => {
    expect(detectSourceIdFromUrl('https://click.xing.com/redirect?x=1', SOURCES)).toBe(XING);
    expect(detectSourceIdFromUrl('https://de.linkedin.com/jobs/view/1/', SOURCES)).toBe(LINKEDIN);
  });

  it('nackte Domain ohne www matcht', () => {
    expect(detectSourceIdFromUrl('https://linkedin.com/jobs/view/1/', SOURCES)).toBe(LINKEDIN);
  });

  it('Groß-/Kleinschreibung im Hostnamen egal', () => {
    expect(detectSourceIdFromUrl('https://WWW.LinkedIn.COM/jobs/view/1/', SOURCES)).toBe(LINKEDIN);
  });

  it('notlinkedin.com ist KEIN LinkedIn (Suffix nur an Label-Grenze)', () => {
    expect(detectSourceIdFromUrl('https://notlinkedin.com/jobs/1', SOURCES)).toBeNull();
  });

  it('Domain nur im Pfad/Query zählt nicht', () => {
    expect(detectSourceIdFromUrl('https://evil.example.com/linkedin.com/jobs', SOURCES)).toBeNull();
    expect(detectSourceIdFromUrl('https://tracker.example.com/?u=https://www.xing.com/m/1', SOURCES)).toBeNull();
  });

  it('unbekannte Domain → null (niemals raten)', () => {
    expect(detectSourceIdFromUrl('https://careers.munichre.com/de/stelle/3382', SOURCES)).toBeNull();
  });

  it('ungültige / nicht-http URL → null', () => {
    expect(detectSourceIdFromUrl('kein link', SOURCES)).toBeNull();
    expect(detectSourceIdFromUrl('ftp://www.linkedin.com/x', SOURCES)).toBeNull();
    expect(detectSourceIdFromUrl('', SOURCES)).toBeNull();
    expect(detectSourceIdFromUrl(null, SOURCES)).toBeNull();
  });

  it('längste (spezifischste) Domain gewinnt', () => {
    const sources: SourceDomainEntry[] = [
      { id: 1, domainPatterns: 'example.com' },
      { id: 2, domainPatterns: 'jobs.example.com' }
    ];
    expect(detectSourceIdFromUrl('https://a.jobs.example.com/x', sources)).toBe(2);
    expect(detectSourceIdFromUrl('https://www.example.com/x', sources)).toBe(1);
  });

  it('gleich spezifische Treffer bei verschiedenen Quellen → mehrdeutig → null', () => {
    const sources: SourceDomainEntry[] = [
      { id: 1, domainPatterns: 'example.com' },
      { id: 2, domainPatterns: 'example.com' }
    ];
    expect(detectSourceIdFromUrl('https://www.example.com/x', sources)).toBeNull();
  });

  it('mehrere Domains pro Quelle (kommagetrennt)', () => {
    const sources: SourceDomainEntry[] = [
      { id: 7, domainPatterns: 'stellenangebote.de, stellenanzeigen.de' }
    ];
    expect(detectSourceIdFromUrl('https://mail.stellenanzeigen.de/c/1', sources)).toBe(7);
  });

  it('ohne Quellen-Liste → null', () => {
    expect(detectSourceIdFromUrl('https://www.linkedin.com/jobs/view/1/', [])).toBeNull();
  });
});

describe('detectSourceIdFromText – nur die ERSTE URL zählt', () => {
  it('typischer Rohtext mit zwei URLs: erste = Börse, letzte = Angebot', () => {
    const text = [
      'https://www.xing.com/m/AbCdEf123',
      'https://karriere.firma.de/jobs/senior-tester-4711',
      '',
      'Senior Software Tester (m/w/d)',
      'Firma GmbH, Köln'
    ].join('\n');
    expect(detectSourceIdFromText(text, SOURCES)).toBe(XING);
  });

  it('drei URLs (mehrere Weiterleitungen): weiterhin die erste', () => {
    const text = 'https://www.linkedin.com/comm/jobs/view/1/\nhttps://redirect.example.net/r/2\nhttps://www.stepstone.de/stellenangebote--3.html\nText';
    expect(detectSourceIdFromText(text, SOURCES)).toBe(LINKEDIN);
  });

  it('nur eine URL: sie ist zugleich die erste', () => {
    expect(detectSourceIdFromText('https://www.arbeitsagentur.de/jobsuche/jobdetail/1\nText', SOURCES)).toBe(ARBEITSAGENTUR);
  });

  it('erste URL unbekannt → null, auch wenn spätere URLs passen würden (nie durchprobieren)', () => {
    const text = 'https://careers.munichre.com/de/stelle/3382\nhttps://www.linkedin.com/jobs/view/1/';
    expect(detectSourceIdFromText(text, SOURCES)).toBeNull();
  });

  it('Rohtext ohne URL → null', () => {
    expect(detectSourceIdFromText('Senior Tester (m/w/d)\nFirma GmbH\nKöln', SOURCES)).toBeNull();
    expect(detectSourceIdFromText('', SOURCES)).toBeNull();
    expect(detectSourceIdFromText(null, SOURCES)).toBeNull();
  });

  it('Quelle ohne domain_patterns (Freitext-Altlast) wird nie erkannt', () => {
    const sources: SourceDomainEntry[] = [{ id: 8, domainPatterns: null }];
    expect(detectSourceIdFromText('https://www.xing.com/m/1', sources)).toBeNull();
  });
});

describe('parseDomainPatterns', () => {
  it('normalisiert Leerzeichen, Großschreibung, www./*./führenden Punkt', () => {
    expect(parseDomainPatterns(' LinkedIn.com , www.xing.com,*.stepstone.de, .indeed.com ,'))
      .toEqual(['linkedin.com', 'xing.com', 'stepstone.de', 'indeed.com']);
  });

  it('leer/null → []', () => {
    expect(parseDomainPatterns(null)).toEqual([]);
    expect(parseDomainPatterns('')).toEqual([]);
  });
});

// Praxistest-Rohtext (gekürzt): Überschrift, drei URLs, dann Anzeigentext
// mit weiteren URLs/Links weiter unten.
const PRAXIS_TEXT = [
  'Geöffnete Tab-URLs:',
  'https://www.xing.com/jobs/neuss-it-spezialist-dms-158426015?ijt=jb_17&rru=41693083.824524',
  'https://schlingeling.de/forwarding/checkicheck-3254464646',
  'http://slinghoebbelboepp.com/neuss-it-specialist-dms/493345345',
  '',
  'Navigation überspringen',
  'Jobs finden',
  'IT-Spezialist DMS (m/w/d)',
  'Bewerbung unter https://www.amadeus-fire.de/bewerben/12-247806',
  'Vor 2 TagenVor 2 Tagen veröffentlicht'
].join('\n');

describe('extractLeadingUrls – URL-Block am Textanfang', () => {
  it('Praxistext: genau die drei URLs des Kopfblocks, in Reihenfolge', () => {
    expect(extractLeadingUrls(PRAXIS_TEXT)).toEqual([
      'https://www.xing.com/jobs/neuss-it-spezialist-dms-158426015?ijt=jb_17&rru=41693083.824524',
      'https://schlingeling.de/forwarding/checkicheck-3254464646',
      'http://slinghoebbelboepp.com/neuss-it-specialist-dms/493345345'
    ]);
  });

  it('Leerzeilen innerhalb des Blocks und CRLF sind ok', () => {
    expect(extractLeadingUrls('https://a.example/1\r\n\r\nhttps://b.example/2\r\nText\r\nhttps://c.example/3'))
      .toEqual(['https://a.example/1', 'https://b.example/2']);
  });

  it('URLs erst tief im Anzeigentext → kein Block', () => {
    const text = 'Titel\nFirma\nOrt\nBeschreibung\nBewerbung: https://www.linkedin.com/jobs/view/1/';
    expect(extractLeadingUrls(text)).toEqual([]);
  });

  it('ohne URL / leer → []', () => {
    expect(extractLeadingUrls('nur Text')).toEqual([]);
    expect(extractLeadingUrls(null)).toEqual([]);
  });
});

describe('Quelle (erste URL) und Quell-URL (letzte URL) aus dem Praxistext', () => {
  it('Quelle = XING aus der ERSTEN URL', () => {
    expect(detectSourceIdFromText(PRAXIS_TEXT, SOURCES)).toBe(XING);
  });

  it('Quell-URL = LETZTE URL des Kopfblocks (nicht der Bewerbungslink im Text)', () => {
    expect(extractOfferUrlFromText(PRAXIS_TEXT)).toBe('http://slinghoebbelboepp.com/neuss-it-specialist-dms/493345345');
  });

  it('zwei URLs: die zweite ist die Quell-URL, bereinigt (Query entfernt)', () => {
    const text = 'https://www.linkedin.com/comm/jobs/view/1/\nhttps://karriere.firma.de/job/42?utm_source=li\n\nTitel';
    expect(extractOfferUrlFromText(text)).toBe('https://karriere.firma.de/job/42');
  });

  it('nur eine URL: sie ist zugleich Quelle und Quell-URL', () => {
    const text = 'https://www.linkedin.com/comm/jobs/view/4377827138/?trk=eml\nTitel';
    expect(detectSourceIdFromText(text, SOURCES)).toBe(LINKEDIN);
    expect(extractOfferUrlFromText(text)).toBe('https://www.linkedin.com/jobs/view/4377827138/');
  });

  it('kein URL-Block → null (Formular nutzt dann die KI-url)', () => {
    expect(extractOfferUrlFromText('Titel\nFirma')).toBeNull();
  });
});
