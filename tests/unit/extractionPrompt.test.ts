/**
 * Datums-Bausteine des KI-Extraktions-Prompts:
 * - heutiges LOKALES Datum im Prompt (relative Angaben wie "Vor 2 Tagen")
 * - Plausibilisierung des KI-Datums (ungültig/zukünftig → verworfen)
 *
 * Praxistest-Befund: Ohne heutiges Datum lieferte die KI für
 * "Vor 2 Tagen veröffentlicht" den 14.01.2025.
 * TZ: Europe/Berlin via tests/globalSetup.ts.
 *
 * Feature: feat/source-dropdown-date-default
 */

import { describe, it, expect } from 'vitest';
import { buildPostedDateInstruction, sanitizePostedDate } from '../../src/main/services/extractionPrompt';

describe('buildPostedDateInstruction', () => {
  it('enthält das heutige lokale Datum', () => {
    expect(buildPostedDateInstruction(new Date(2026, 9, 11, 10, 0))).toContain("Today's date is 2026-10-11");
  });

  it('nutzt den LOKALEN Tag kurz nach Mitternacht (UTC wäre noch Vortag)', () => {
    expect(buildPostedDateInstruction(new Date(2027, 0, 1, 0, 30))).toContain('2027-01-01');
  });

  it('fordert Berechnung relativer Angaben und Weglassen statt Raten', () => {
    const text = buildPostedDateInstruction(new Date(2026, 9, 11));
    expect(text).toMatch(/Vor 2 Tagen/);
    expect(text).toMatch(/omit this field/);
    expect(text).toMatch(/never guess/);
  });

  it('Vorrang: absolutes Datum schlägt relative Angabe, unabhängig von der Position', () => {
    const text = buildPostedDateInstruction(new Date(2026, 9, 11));
    expect(text).toMatch(/BOTH an explicit\s+absolute posting date/);
    expect(text).toMatch(/Veröffentlichungsdatum: 01\.10\.2026/);
    expect(text).toMatch(/ALWAYS use the absolute date/);
    expect(text).toMatch(/regardless\s+of where in the text it appears/);
  });
});

describe('sanitizePostedDate', () => {
  const now = new Date(2026, 9, 11, 10, 0);

  it('übernimmt gültige vergangene Daten', () => {
    expect(sanitizePostedDate('2026-10-09', now)).toBe('2026-10-09');
  });

  it('heute ist erlaubt', () => {
    expect(sanitizePostedDate('2026-10-11', now)).toBe('2026-10-11');
  });

  it('zukünftige Daten werden verworfen', () => {
    expect(sanitizePostedDate('2026-10-12', now)).toBeUndefined();
  });

  it('ungültige Kalenderdaten / Formate werden verworfen', () => {
    expect(sanitizePostedDate('2026-02-30', now)).toBeUndefined();
    expect(sanitizePostedDate('09.10.2026', now)).toBeUndefined();
    expect(sanitizePostedDate('vor 2 Tagen', now)).toBeUndefined();
    expect(sanitizePostedDate(undefined, now)).toBeUndefined();
    expect(sanitizePostedDate(20261009, now)).toBeUndefined();
  });

  it('ISO mit Uhrzeit wird auf das Datum reduziert', () => {
    expect(sanitizePostedDate('2026-10-09T00:00:00Z', now)).toBe('2026-10-09');
  });
});
