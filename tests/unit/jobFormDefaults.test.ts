/**
 * Tests für die Vorbelegungen im Job-Erfassungsformular (JobAdd):
 * - Gestern-Default fürs Veröffentlichungsdatum (lokales Datum, heute − 1)
 * - Quelle-Vorbelegung: manuelle Auswahl übersteuert die Autoerkennung
 *
 * Zeitzone: tests/globalSetup.ts pinnt TZ=Europe/Berlin (CI zusätzlich als
 * OS-Env). Die Mitternachts-/Sommerzeit-Fälle unterscheiden eine lokale
 * Berechnung von einer UTC-/24h-Subtraktion (Lehre aus PR #63).
 *
 * Feature: feat/source-dropdown-date-default
 */

import { describe, it, expect } from 'vitest';
import {
  getYesterdayLocalIso,
  toLocalIsoDate,
  resolveSourceSelection
} from '../../src/shared/jobFormDefaults';

describe('getYesterdayLocalIso', () => {
  it('liefert den Vortag im Monat', () => {
    expect(getYesterdayLocalIso(new Date(2026, 9, 11, 14, 0))).toBe('2026-10-10');
  });

  it('Monatswechsel: 1. Oktober → 30. September', () => {
    expect(getYesterdayLocalIso(new Date(2026, 9, 1, 12, 0))).toBe('2026-09-30');
  });

  it('Monatswechsel auf 31-Tage-Monat: 1. August → 31. Juli', () => {
    expect(getYesterdayLocalIso(new Date(2026, 7, 1, 12, 0))).toBe('2026-07-31');
  });

  it('Jahreswechsel: 1. Januar → 31. Dezember des Vorjahres', () => {
    expect(getYesterdayLocalIso(new Date(2027, 0, 1, 12, 0))).toBe('2026-12-31');
  });

  it('März im Schaltjahr: 1. März 2028 → 29. Februar', () => {
    expect(getYesterdayLocalIso(new Date(2028, 2, 1, 12, 0))).toBe('2028-02-29');
  });

  it('März im Nicht-Schaltjahr: 1. März 2027 → 28. Februar', () => {
    expect(getYesterdayLocalIso(new Date(2027, 2, 1, 12, 0))).toBe('2027-02-28');
  });

  it('kurz nach lokaler Mitternacht zählt der LOKALE Tag (UTC ist noch Vortag)', () => {
    // 01.01.2027 00:30 Berlin = 31.12.2026 23:30 UTC → gestern lokal = 31.12.2026
    // (eine UTC-basierte Rechnung käme auf den 30.12.)
    expect(getYesterdayLocalIso(new Date(2027, 0, 1, 0, 30))).toBe('2026-12-31');
  });

  it('kurz vor lokaler Mitternacht bleibt es beim lokalen Tag', () => {
    expect(getYesterdayLocalIso(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-10');
  });

  it('Tag nach Sommerzeit-Umstellung (23-h-Tag): keine 24-h-Subtraktion', () => {
    // 30.03.2026 00:30 MESZ − 24 h = 28.03. 23:30 MEZ – falsch. Erwartet: 29.03.
    expect(getYesterdayLocalIso(new Date(2026, 2, 30, 0, 30))).toBe('2026-03-29');
  });

  it('Tag nach Winterzeit-Umstellung (25-h-Tag)', () => {
    expect(getYesterdayLocalIso(new Date(2026, 9, 26, 23, 30))).toBe('2026-10-25');
  });

  it('nutzt ohne Argument die aktuelle Zeit', () => {
    const now = new Date();
    const expected = toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    expect(getYesterdayLocalIso()).toBe(expected);
  });
});

describe('toLocalIsoDate', () => {
  it('formatiert lokal mit führenden Nullen', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 0, 15))).toBe('2026-01-05');
  });
});

describe('resolveSourceSelection', () => {
  it('übernimmt den erkannten Treffer, wenn nicht manuell gewählt', () => {
    expect(resolveSourceSelection({ currentSourceId: '', manuallySelected: false, detectedSourceId: 2 })).toBe(2);
  });

  it('Treffer überschreibt NIE eine manuelle Auswahl', () => {
    expect(resolveSourceSelection({ currentSourceId: 5, manuallySelected: true, detectedSourceId: 2 })).toBe(5);
  });

  it('manuelle Auswahl bleibt auch ohne Treffer erhalten', () => {
    expect(resolveSourceSelection({ currentSourceId: 5, manuallySelected: true, detectedSourceId: null })).toBe(5);
  });

  it('kein Treffer und keine manuelle Auswahl → leer (nie raten)', () => {
    expect(resolveSourceSelection({ currentSourceId: '', manuallySelected: false, detectedSourceId: null })).toBe('');
  });

  it('neue Extraktion ohne Treffer setzt eine frühere AUTO-Erkennung zurück', () => {
    // Vorher auto-erkannt (nicht manuell) → neuer Rohtext ohne Treffer → leer
    expect(resolveSourceSelection({ currentSourceId: 1, manuallySelected: false, detectedSourceId: null })).toBe('');
  });
});
