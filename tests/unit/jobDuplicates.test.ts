/**
 * Unit tests for duplicate detection & cleanup (feat/job-duplicate-handling)
 *
 * Covers:
 * - findJobDuplicates: SICHER (URL-Key) / MÖGLICH (Titel+Firma), keine False-Positives
 * - scanDuplicateGroups: Gruppierung, neuester-gewinnt, Vorauswahl-Regeln,
 *   degenerierte URL-Keys NICHT als sichere Gruppe
 * - deleteJobs: Löschung inkl. abhängiger matching_results (ON DELETE CASCADE)
 *
 * Jeder Test läuft gegen eine frisch geleerte job_offers/matching_results-Tabelle
 * (die Test-DB wird pro Datei einmal migriert – siehe tests/setup.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as jobService from '../../src/main/services/jobService';
import { getDatabase } from '../../src/main/database/db';
import type { JobOfferInput } from '../../src/shared/types';

// Seed-Quellen: 1 = LinkedIn, 2 = XING (siehe 20250930000002_seed_initial_data.js)
const SOURCE_LINKEDIN = 1;

function clearJobs(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
}

beforeEach(() => {
  clearJobs();
});

async function makeJob(overrides: Partial<JobOfferInput> = {}) {
  return jobService.createJob({
    title: 'Default Title',
    company: 'Default Company',
    postedDate: new Date('2025-01-01'),
    sourceId: SOURCE_LINKEDIN,
    status: 'new',
    importMethod: 'manual',
    ...overrides
  } as JobOfferInput);
}

describe('findJobDuplicates – SICHER (identischer URL-Key)', () => {
  it('erkennt identische LinkedIn-Stelle trotz abweichender Tracking-URL', async () => {
    const existing = await makeJob({
      title: 'Java Developer',
      company: 'Acme',
      url: 'https://www.linkedin.com/jobs/view/555/',
      matchScore: 42
    });

    const res = await jobService.findJobDuplicates({
      title: 'Ganz anderer Titel',
      company: 'Andere Firma',
      url: 'https://www.linkedin.com/comm/jobs/view/555/?trackingId=x&trk=eml'
    });

    expect(res.safe).not.toBeNull();
    expect(res.safe!.job.id).toBe(existing.id);
    expect(res.safe!.job.matchScore).toBe(42);
    expect(res.possible).toHaveLength(0);
  });

  it('findet einen sicheren Treffer über eine der mehreren Rohtext-URLs (Pre-AI)', async () => {
    const existing = await makeJob({
      url: 'https://www.linkedin.com/jobs/view/777/'
    });

    const res = await jobService.findJobDuplicates({
      // Mehrere URLs wie aus einer Mail: Firmenseite + Job-Link (currentJobId)
      urls: [
        'https://acme.example.com/karriere',
        'https://www.linkedin.com/jobs/search/?currentJobId=777&keywords=java'
      ]
    });

    expect(res.safe).not.toBeNull();
    expect(res.safe!.job.id).toBe(existing.id);
  });

  it('degenerierte Fallback-URL (kein /jobs/view/{ID}) löst KEINEN sicheren Treffer aus', async () => {
    await makeJob({
      title: 'Something',
      company: 'Somewhere',
      url: 'https://www.linkedin.com/jobs/search/?keywords=java'
    });

    const res = await jobService.findJobDuplicates({
      title: 'Etwas anderes',
      company: 'Woanders',
      url: 'https://www.linkedin.com/jobs/search/?keywords=python'
    });

    expect(res.safe).toBeNull();
  });
});

describe('findJobDuplicates – MÖGLICH (Titel + Firma)', () => {
  it('erkennt gleiche Stelle über verschiedene Portale (URL-Key abweichend)', async () => {
    const existing = await makeJob({
      title: '  Senior QA   Engineer ', // wird normalisiert
      company: 'Peak One',
      url: 'https://www.xing.com/jobs/senior-qa-12345'
    });

    const res = await jobService.findJobDuplicates({
      title: 'senior qa engineer',
      company: 'peak one',
      url: 'https://www.linkedin.com/jobs/view/999/'
    });

    expect(res.safe).toBeNull();
    expect(res.possible).toHaveLength(1);
    expect(res.possible[0].job.id).toBe(existing.id);
  });

  it('KEIN False-Positive bei gleicher Firma mit unterschiedlichen Titeln', async () => {
    await makeJob({ title: 'Frontend Developer', company: 'Globex', url: 'https://a.example.com/1' });

    const res = await jobService.findJobDuplicates({
      title: 'Backend Developer',
      company: 'Globex',
      url: 'https://b.example.com/2'
    });

    expect(res.safe).toBeNull();
    expect(res.possible).toHaveLength(0);
  });

  it('KEIN False-Positive bei gleichem Titel mit unterschiedlichen Firmen', async () => {
    await makeJob({ title: 'DevOps Engineer', company: 'Initech', url: 'https://a.example.com/3' });

    const res = await jobService.findJobDuplicates({
      title: 'DevOps Engineer',
      company: 'Umbrella',
      url: 'https://b.example.com/4'
    });

    expect(res.possible).toHaveLength(0);
  });

  it('schließt den zu bearbeitenden Job selbst aus (excludeJobId)', async () => {
    const job = await makeJob({
      title: 'Cloud Architect',
      company: 'Stark',
      url: 'https://www.linkedin.com/jobs/view/321/'
    });

    const res = await jobService.findJobDuplicates({
      title: 'Cloud Architect',
      company: 'Stark',
      url: 'https://www.linkedin.com/jobs/view/321/',
      excludeJobId: job.id
    });

    expect(res.safe).toBeNull();
    expect(res.possible).toHaveLength(0);
  });
});

describe('scanDuplicateGroups', () => {
  it('bildet eine sichere Gruppe nach URL-Key; neuester bleibt, ältere vorausgewählt', async () => {
    const older = await makeJob({ title: 'Erst', company: 'A', url: 'https://www.linkedin.com/jobs/view/1000/' });
    const newer = await makeJob({ title: 'Zweit', company: 'B', url: 'https://www.linkedin.com/jobs/view/1000/' });

    const scan = await jobService.scanDuplicateGroups();

    expect(scan.safeGroupCount).toBe(1);
    expect(scan.possibleGroupCount).toBe(0);

    const group = scan.groups.find(g => g.kind === 'safe')!;
    expect(group.jobs).toHaveLength(2);

    const newestEntry = group.jobs.find(j => j.isNewest)!;
    expect(newestEntry.job.id).toBe(newer.id);
    expect(newestEntry.suggestDelete).toBe(false);

    const olderEntry = group.jobs.find(j => !j.isNewest)!;
    expect(olderEntry.job.id).toBe(older.id);
    expect(olderEntry.suggestDelete).toBe(true); // sichere Gruppe → vorausgewählt
  });

  it('bildet eine mögliche Gruppe nach Titel+Firma; NICHT vorausgewählt', async () => {
    await makeJob({ title: 'Data Scientist', company: 'Hooli', url: 'https://www.xing.com/jobs/ds-1' });
    await makeJob({ title: 'data scientist', company: 'HOOLI', url: 'https://www.linkedin.com/jobs/view/2000/' });

    const scan = await jobService.scanDuplicateGroups();

    expect(scan.safeGroupCount).toBe(0);
    expect(scan.possibleGroupCount).toBe(1);

    const group = scan.groups.find(g => g.kind === 'possible')!;
    expect(group.jobs).toHaveLength(2);
    expect(group.jobs.every(j => j.suggestDelete === false)).toBe(true);
    expect(group.jobs.filter(j => j.isNewest)).toHaveLength(1);
  });

  it('gruppiert zwei verschiedene Jobs mit identischem degeneriertem URL-Key NICHT als sichere Dubletten', async () => {
    await makeJob({ title: 'Role One', company: 'CompOne', url: 'https://www.linkedin.com/jobs/search/?keywords=java' });
    await makeJob({ title: 'Role Two', company: 'CompTwo', url: 'https://www.linkedin.com/jobs/search/?keywords=python' });

    const scan = await jobService.scanDuplicateGroups();

    expect(scan.safeGroupCount).toBe(0);
    expect(scan.groups).toHaveLength(0); // auch keine mögliche Gruppe (Titel+Firma verschieden)
  });
});

describe('deleteJobs', () => {
  it('löscht Jobs inkl. abhängiger matching_results (ON DELETE CASCADE)', async () => {
    const job = await makeJob({ title: 'To Delete', company: 'Z', url: 'https://www.linkedin.com/jobs/view/4242/' });
    const db = getDatabase();

    db.prepare(
      `INSERT INTO matching_results (job_id, prompt_id, match_score, gap_analysis)
       VALUES (?, 1, 88, '[]')`
    ).run(job.id);

    // Vorbedingung: abhängiger Datensatz existiert
    const before = db.prepare('SELECT COUNT(*) AS c FROM matching_results WHERE job_id = ?').get(job.id) as { c: number };
    expect(before.c).toBe(1);

    const result = await jobService.deleteJobs([job.id]);
    expect(result.deleted).toBe(1);

    const jobCount = db.prepare('SELECT COUNT(*) AS c FROM job_offers WHERE id = ?').get(job.id) as { c: number };
    expect(jobCount.c).toBe(0);

    // Cascade: abhängige matching_results ebenfalls entfernt
    const after = db.prepare('SELECT COUNT(*) AS c FROM matching_results WHERE job_id = ?').get(job.id) as { c: number };
    expect(after.c).toBe(0);
  });

  it('löscht mehrere Jobs und zählt nur tatsächlich gelöschte', async () => {
    const a = await makeJob({ title: 'A', company: 'A', url: 'https://a.example.com/x' });
    const b = await makeJob({ title: 'B', company: 'B', url: 'https://b.example.com/y' });

    const result = await jobService.deleteJobs([a.id, b.id, 999999]); // 999999 existiert nicht
    expect(result.deleted).toBe(2);
  });

  it('gibt bei leerer Liste 0 zurück', async () => {
    const result = await jobService.deleteJobs([]);
    expect(result.deleted).toBe(0);
  });
});
