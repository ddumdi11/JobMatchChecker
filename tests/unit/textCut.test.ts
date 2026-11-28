/**
 * Rauschen am Textende kappen – reine Regel (src/shared/textCut.ts).
 * Feature: feat/text-cut-noise
 */
import { describe, it, expect } from 'vitest';
import {
  NO_TEXT_CUT,
  findTextCut,
  getEffectiveText,
  resolveTextCut,
  textCutToStore
} from '../../src/shared/textCut';

const MARKERS = ['Interesse geweckt?', 'Ähnliche Jobs', 'Ähnliche Stellenanzeigen', 'Gehalts-Prognose', 'JOBSUCHENDE', 'Impressum'];

// Anzeige (lang genug, damit die Marker in der hinteren Hälfte liegen) + Rauschen
const AD = 'IT-Spezialist DMS (m/w/d)\n' + 'Aufgaben und Profil. '.repeat(20) + '\nUnternehmens-Details\nAmadeus Fire AG\n';
const NOISE = 'Ähnliche Jobs\n\nIT-Administrator*in (w/m/d)\nNeuss\n42.000 € – 57.000 €\n';
const TEXT = AD + NOISE;

describe('findTextCut', () => {
  it('schneidet am Marker in der hinteren Hälfte', () => {
    expect(findTextCut(TEXT, MARKERS)).toEqual({ position: AD.length, marker: 'Ähnliche Jobs' });
  });

  it('nimmt den frühesten Marker, unabhängig von der Reihenfolge der Liste', () => {
    const text = AD + 'Gehalts-Prognose\n61.500 €\n' + NOISE;
    expect(findTextCut(text, MARKERS)?.marker).toBe('Gehalts-Prognose');
    expect(findTextCut(text, [...MARKERS].reverse())?.marker).toBe('Gehalts-Prognose');
  });

  it('ignoriert Marker in der vorderen Hälfte', () => {
    const text = 'Impressum der Firma\n' + 'Text der Anzeige. '.repeat(30);
    expect(findTextCut(text, MARKERS)).toBeNull();
  });

  it('sucht nach einem Treffer vorne weiter in der hinteren Hälfte', () => {
    const text = 'Interesse geweckt? Wir suchen dich.\n' + 'Text der Anzeige. '.repeat(30) + 'Interesse geweckt?\nfremde Stellen';
    expect(findTextCut(text, MARKERS)?.position).toBe(text.lastIndexOf('Interesse geweckt?'));
  });

  it('behält Firmenangaben ("Unternehmens-Details" ist kein Marker)', () => {
    expect(TEXT.slice(0, findTextCut(TEXT, MARKERS)!.position)).toContain('Unternehmens-Details');
  });

  it('liefert null ohne Treffer, ohne Marker oder bei leerem Text', () => {
    expect(findTextCut(AD, MARKERS)).toBeNull();
    expect(findTextCut(TEXT, [])).toBeNull();
    expect(findTextCut(TEXT, [''])).toBeNull();
    expect(findTextCut('', MARKERS)).toBeNull();
  });

  it('unterscheidet Groß- und Kleinschreibung', () => {
    expect(findTextCut(AD + 'jobsuchende\nx', MARKERS)).toBeNull();
  });
});

describe('resolveTextCut', () => {
  it('null/undefined = noch nie bewertet → Regel', () => {
    expect(resolveTextCut(TEXT, null, MARKERS)).toEqual({ position: AD.length, marker: 'Ähnliche Jobs', source: 'rule' });
    expect(resolveTextCut(TEXT, undefined, MARKERS).source).toBe('rule');
  });

  it('0 = bewusst kein Schnitt, auch wenn ein Marker passt', () => {
    expect(resolveTextCut(TEXT, NO_TEXT_CUT, MARKERS)).toEqual({ position: null, marker: null, source: 'disabled' });
  });

  it('gespeicherter Schnitt gilt und nennt seinen Marker', () => {
    expect(resolveTextCut(TEXT, AD.length, MARKERS)).toEqual({ position: AD.length, marker: 'Ähnliche Jobs', source: 'stored' });
  });

  it('ungültiger gespeicherter Wert fällt auf die Regel zurück', () => {
    expect(resolveTextCut(TEXT, TEXT.length + 5, MARKERS).source).toBe('rule');
    expect(resolveTextCut(TEXT, 2.5, MARKERS).source).toBe('rule');
    expect(resolveTextCut(TEXT, -3, MARKERS).source).toBe('rule');
  });

  it('kein Marker → none', () => {
    expect(resolveTextCut(AD, null, MARKERS)).toEqual({ position: null, marker: null, source: 'none' });
    expect(resolveTextCut(null, null, MARKERS).source).toBe('none');
  });
});

describe('getEffectiveText', () => {
  it('liefert die Anzeige ohne Rauschen und ohne Leerraum am Ende', () => {
    expect(getEffectiveText(TEXT, null, MARKERS)).toBe(AD.trimEnd());
  });

  it('bei bewusst keinem Schnitt oder ohne Marker den ganzen Text', () => {
    expect(getEffectiveText(TEXT, NO_TEXT_CUT, MARKERS)).toBe(TEXT);
    expect(getEffectiveText(AD, null, MARKERS)).toBe(AD);
    expect(getEffectiveText(null, null, MARKERS)).toBe('');
  });
});

describe('textCutToStore (Formular)', () => {
  it('übernimmt den Schnitt, die Abwahl oder lässt die Regel gelten', () => {
    expect(textCutToStore(TEXT, MARKERS, false)).toBe(AD.length);
    expect(textCutToStore(TEXT, MARKERS, true)).toBe(NO_TEXT_CUT);
    expect(textCutToStore(AD, MARKERS, false)).toBeNull();
    expect(textCutToStore(AD, MARKERS, true)).toBeNull();
  });
});
