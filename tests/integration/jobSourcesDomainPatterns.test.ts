/**
 * Migration 20261011000001_add_domain_patterns_to_job_sources:
 * - leitet domain_patterns defensiv aus job_sources.url ab
 * - Freitext-Quellen ohne url bleiben NULL (nie auto-erkannt)
 * - legt "stellenangebote.de" an (idempotent bzgl. Namensgleichheit)
 * - getJobSources() liefert die Domains mit
 *
 * Eigene Temp-DB, die bis VOR die Migration hochgezogen wird, damit ein
 * realistischer Altbestand (Freitext-Kreationen) simuliert werden kann.
 *
 * Feature: feat/source-dropdown-date-default
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Knex, { type Knex as KnexType } from 'knex';
import { getJobSources } from '../../src/main/services/jobService';

const MIGRATION = '20261011000001_add_domain_patterns_to_job_sources.js';
const migrationsDir = path.join(__dirname, '../../src/main/database/migrations');

describe('Migration: job_sources.domain_patterns', () => {
  let knex: KnexType;
  let dbPath: string;

  beforeAll(async () => {
    dbPath = path.join(os.tmpdir(), 'jobmatch-vitest', `domain-patterns-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    knex = Knex({
      client: 'better-sqlite3',
      connection: { filename: dbPath },
      useNullAsDefault: true,
      migrations: { directory: migrationsDir, extension: 'js' }
    });

    // Bis direkt vor die neue Migration hochziehen
    for (;;) {
      const [, pending] = await knex.migrate.list();
      const next = pending[0];
      const nextName = next?.file ?? next?.name ?? next;
      if (!next || nextName === MIGRATION) break;
      await knex.migrate.up();
    }

    // Altbestand wie in der echten DB: Freitext-Quellen ohne url
    await knex('job_sources').insert([
      { name: 'Stepstone/LinkedIn', url: null, api_available: false },
      { name: 'LinkedIn-Kontakt / via Mail', url: null, api_available: false },
      { name: 'Kaputt', url: 'kein-link', api_available: false }
    ]);

    await knex.migrate.up(); // die neue Migration
  });

  afterAll(async () => {
    await knex.destroy();
    try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
  });

  async function patternsByName(): Promise<Record<string, string | null>> {
    const rows = await knex('job_sources').select('name', 'domain_patterns');
    return Object.fromEntries(rows.map((r: any) => [r.name, r.domain_patterns]));
  }

  // Bewusst das ERGEBNIS für jede Bestands-Quelle exakt festgeschrieben statt
  // eines allgemeinen Public-Suffix-Algorithmus: Die Ableitung läuft einmalig
  // über bekannte .com/.de-URLs; danach sind die Patterns editierbare Daten
  // (eine künftige .co.uk-Börse bekommt ihr Pattern von Hand).
  it('leitet für ALLE Seed-Quellen exakt die erwartete Domain ab', async () => {
    const p = await patternsByName();
    expect({
      LinkedIn: p['LinkedIn'],
      XING: p['XING'],
      Stepstone: p['Stepstone'],
      Indeed: p['Indeed'],
      Arbeitsagentur: p['Arbeitsagentur'],
      'Nachhaltige Jobs': p['Nachhaltige Jobs'],
      MeineStadt: p['MeineStadt']
    }).toEqual({
      LinkedIn: 'linkedin.com',             // www.linkedin.com
      XING: 'xing.com',                     // www.xing.com
      Stepstone: 'stepstone.de',            // www.stepstone.de
      Indeed: 'indeed.com',                 // de.indeed.com
      Arbeitsagentur: 'arbeitsagentur.de',  // web.arbeitsagentur.de
      'Nachhaltige Jobs': 'nachhaltigejobs.de', // www.nachhaltigejobs.de
      MeineStadt: 'meinestadt.de'           // konto.meinestadt.de
    });
  });

  it('Quellen ohne (parsebare) url bleiben NULL', async () => {
    const p = await patternsByName();
    expect(p['Stepstone/LinkedIn']).toBeNull();
    expect(p['LinkedIn-Kontakt / via Mail']).toBeNull();
    expect(p['Kaputt']).toBeNull();
  });

  it('legt stellenangebote.de genau einmal an', async () => {
    const rows = await knex('job_sources').whereRaw('lower(name) = ?', ['stellenangebote.de']);
    expect(rows).toHaveLength(1);
    expect(rows[0].domain_patterns).toBe('stellenangebote.de');
  });

  it('down entfernt Spalte und unbenutzte neue Quelle', async () => {
    await knex.migrate.down();
    const cols = await knex.raw('PRAGMA table_info(job_sources)');
    expect(cols.map((c: any) => c.name)).not.toContain('domain_patterns');
    const rows = await knex('job_sources').where({ name: 'stellenangebote.de' });
    expect(rows).toHaveLength(0);
    await knex.migrate.up(); // wieder herstellen für Idempotenz-Check
    const again = await knex('job_sources').where({ name: 'stellenangebote.de' });
    expect(again).toHaveLength(1);
  });

  it('down lässt die Quelle stehen, wenn ihre Patterns von Hand angepasst wurden', async () => {
    await knex('job_sources')
      .where({ name: 'stellenangebote.de' })
      .update({ domain_patterns: 'stellenangebote.de, stellenanzeigen.de' });
    await knex.migrate.down();
    expect(await knex('job_sources').where({ name: 'stellenangebote.de' })).toHaveLength(1);
    await knex.migrate.up();
  });

  it('down lässt die Quelle stehen, wenn ein Job daran hängt', async () => {
    const source = await knex('job_sources').where({ name: 'stellenangebote.de' }).first();
    await knex('job_sources').where({ id: source.id }).update({ domain_patterns: 'stellenangebote.de' });
    await knex('job_offers').insert({
      source_id: source.id,
      title: 'Tester',
      company: 'Firma',
      posted_date: '2026-10-10',
      status: 'new'
    });
    await knex.migrate.down();
    expect(await knex('job_sources').where({ name: 'stellenangebote.de' })).toHaveLength(1);
  });
});

describe('jobService.getJobSources', () => {
  it('liefert domainPatterns (camelCase) aus der migrierten Test-DB', () => {
    const sources = getJobSources();
    const linkedin = sources.find(s => s.name === 'LinkedIn');
    expect(linkedin?.domainPatterns).toBe('linkedin.com');
    expect(sources.find(s => s.name === 'stellenangebote.de')?.domainPatterns).toBe('stellenangebote.de');
  });
});
