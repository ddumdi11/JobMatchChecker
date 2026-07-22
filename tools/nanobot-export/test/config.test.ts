/**
 * Tests für die Argument-/Konfigurationsauflösung des nanobot-Tools.
 * Fokus: Wert-Keys (out/db/days) dürfen nicht still zu "true" werden.
 */
import { describe, it, expect } from 'vitest';
import { parseArgs, resolveConfig, defaultDbPath } from '../src/config';

describe('parseArgs – Wert-Keys erfordern einen Wert', () => {
  it('liest --key value und --key=value', () => {
    expect(parseArgs(['--out', '/ziel', '--days', '30'])).toEqual({ out: '/ziel', days: '30' });
    expect(parseArgs(['--out=/ziel', '--db=/db.sqlite'])).toEqual({ out: '/ziel', db: '/db.sqlite' });
  });

  it('wirft, wenn --out am Ende ohne Wert steht (nicht still "true")', () => {
    expect(() => parseArgs(['--out'])).toThrow(/--out erfordert einen Wert/);
  });

  it('wirft, wenn auf --out direkt ein weiteres Flag folgt', () => {
    expect(() => parseArgs(['--out', '--days', '30'])).toThrow(/--out erfordert einen Wert/);
  });

  it('wirft ebenso für --db und --days ohne Wert', () => {
    expect(() => parseArgs(['--db'])).toThrow(/--db erfordert einen Wert/);
    expect(() => parseArgs(['--days'])).toThrow(/--days erfordert einen Wert/);
  });

  it('erlaubt unbekannte Boolean-Flags weiterhin', () => {
    expect(parseArgs(['--verbose'])).toEqual({ verbose: 'true' });
  });
});

describe('resolveConfig – Priorität und Pflichtfelder', () => {
  // Leere Datei-Konfig injizieren → Tests sind von einer lokal evtl.
  // vorhandenen nanobot.config.json isoliert und nutzen nur ihre expliziten
  // Eingaben (argv + env).
  const noFile = {} as const;

  it('CLI schlägt Env; Default-DB, wenn nichts gesetzt', () => {
    // DB_PATH bewusst NICHT gesetzt (undefined) → defaultDbPath greift.
    const cfg = resolveConfig(['--out', '/cli', '--days', '30'], { NANOBOT_OUT: '/env' } as any, noFile);
    expect(cfg.out).toBe('/cli');   // CLI > Env
    expect(cfg.days).toBe(30);
    expect(cfg.db).toBe(defaultDbPath());
  });

  it('nutzt NANOBOT_OUT, wenn kein --out übergeben wird', () => {
    const cfg = resolveConfig([], { NANOBOT_OUT: '/env' } as any, noFile);
    expect(cfg.out).toBe('/env');
    expect(cfg.days).toBe(90); // Default
  });

  it('meldet fehlenden Zielordner als Fehler', () => {
    expect(() => resolveConfig([], {} as any, noFile)).toThrow(/Zielordner fehlt/);
  });

  it('lehnt ungültige --days ab', () => {
    expect(() => resolveConfig(['--out', '/x', '--days', '0'], {} as any, noFile)).toThrow(/positive Ganzzahl/);
    expect(() => resolveConfig(['--out', '/x', '--days', 'abc'], {} as any, noFile)).toThrow(/positive Ganzzahl/);
  });
});
