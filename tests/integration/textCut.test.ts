/**
 * Rauschen am Textende kappen – DB, Services, Matching und Export.
 * Läuft gegen die pro Datei migrierte Test-DB (tests/setup.ts).
 * Feature: feat/text-cut-noise
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// exportService/matchingService ziehen `electron` bzw. `electron-log` – unter
// Node vor dem Import mocken. Der KI-Aufruf wird abgefangen, um den Prompt zu prüfen.
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
const sendPrompt = vi.fn();
vi.mock('../../src/main/services/aiProviderService', () => ({
  sendPrompt: (...args: unknown[]) => sendPrompt(...args)
}));

import { getDatabase } from '../../src/main/database/db';
import * as jobService from '../../src/main/services/jobService';
import { getJobExportData } from '../../src/main/services/exportService';
import { matchJob } from '../../src/main/services/matchingService';
import { getEffectiveFullText, getTextCutMarkers } from '../../src/main/services/textCutService';
import { NO_TEXT_CUT } from '../../src/shared/textCut';
import type { JobOfferInput } from '../../src/shared/types';

const AD = 'IT-Spezialist DMS (m/w/d)\n' + 'Aufgaben und Profil. '.repeat(20) + '\nUnternehmens-Details\nAmadeus Fire AG\n';
const NOISE = 'Ähnliche Jobs\n\nIT-Administrator*in (w/m/d)\nNeuss\n42.000 € – 57.000 €\n';
const TEXT = AD + NOISE;

function input(overrides: Partial<JobOfferInput> = {}): JobOfferInput {
  return {
    sourceId: 1,
    title: 'IT-Spezialist DMS',
    company: 'Amadeus Fire AG',
    postedDate: new Date('2026-11-01'),
    status: 'new',
    importMethod: 'manual',
    fullText: TEXT,
    ...overrides
  } as JobOfferInput;
}

const storedCut = (id: number) =>
  (getDatabase().prepare('SELECT full_text_cut c FROM job_offers WHERE id = ?').get(id) as { c: number | null }).c;

beforeEach(() => {
  const db = getDatabase();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
  sendPrompt.mockReset();
});

describe('Migration: Markerliste', () => {
  it('legt die sechs Marker in fester Reihenfolge an, ohne Firmenangaben', () => {
    expect(getTextCutMarkers()).toEqual([
      'Interesse geweckt?', 'Ähnliche Jobs', 'Ähnliche Stellenanzeigen', 'Gehalts-Prognose', 'JOBSUCHENDE', 'Impressum'
    ]);
    expect(getTextCutMarkers()).not.toContain('Unternehmens-Details');
  });
});

describe('jobService: full_text_cut', () => {
  it('neuer Job ohne Angabe bleibt "noch nie bewertet", die Regel schneidet trotzdem', async () => {
    const job = await jobService.createJob(input());
    expect(storedCut(job.id)).toBeNull();
    expect(job.fullTextCut).toBeNull();
    expect(job.fullText).toBe(TEXT); // Rohtext unverändert
    const row = getDatabase().prepare('SELECT * FROM job_offers WHERE id = ?').get(job.id) as any;
    expect(getEffectiveFullText(row)).toBe(AD.trimEnd());
  });

  it('speichert Schnitt und bewusste Abwahl', async () => {
    const cut = await jobService.createJob(input({ fullTextCut: AD.length }));
    const off = await jobService.createJob(input({ fullTextCut: NO_TEXT_CUT }));
    expect(cut.fullTextCut).toBe(AD.length);
    expect(off.fullTextCut).toBe(NO_TEXT_CUT);
    const row = getDatabase().prepare('SELECT * FROM job_offers WHERE id = ?').get(off.id) as any;
    expect(getEffectiveFullText(row)).toBe(TEXT);
  });

  it('neuer Text ohne eigene Angabe setzt den Schnitt zurück', async () => {
    const job = await jobService.createJob(input({ fullTextCut: NO_TEXT_CUT }));
    await jobService.updateJob(job.id, { fullText: TEXT + 'Impressum\n' });
    expect(storedCut(job.id)).toBeNull();
  });

  it('andere Änderungen lassen den Schnitt stehen', async () => {
    const job = await jobService.createJob(input({ fullTextCut: NO_TEXT_CUT }));
    await jobService.updateJob(job.id, { status: 'interesting' });
    expect(storedCut(job.id)).toBe(NO_TEXT_CUT);
  });

  it('Text und Schnitt zusammen (Formular) werden beide gespeichert', async () => {
    const job = await jobService.createJob(input());
    await jobService.updateJob(job.id, { fullText: TEXT, fullTextCut: NO_TEXT_CUT });
    expect(storedCut(job.id)).toBe(NO_TEXT_CUT);
  });

  it('lehnt ungültige Werte ab', async () => {
    await expect(jobService.createJob(input({ fullTextCut: -1 }))).rejects.toThrow();
    await expect(jobService.createJob(input({ fullTextCut: 2.5 }))).rejects.toThrow();
  });
});

describe('Verbraucher nutzen den bereinigten Text', () => {
  it('Markdown-/PDF-Export endet mit der Anzeige', async () => {
    const job = await jobService.createJob(input());
    const data = getJobExportData(job.id);
    expect(data.fullText).toBe(AD.trimEnd());
    expect(data.fullText).not.toContain('Ähnliche Jobs');
  });

  it('Export bei bewusst keinem Schnitt: ganzer Text', async () => {
    const job = await jobService.createJob(input({ fullTextCut: NO_TEXT_CUT }));
    expect(getJobExportData(job.id).fullText).toBe(TEXT);
  });

  it('Matching schickt den Text ohne Rauschen an die KI', async () => {
    const db = getDatabase();
    db.prepare("INSERT OR IGNORE INTO user_profile (id, first_name, last_name) VALUES (1, 'Test', 'Profil')").run();
    const job = await jobService.createJob(input());
    sendPrompt.mockResolvedValue({
      content: JSON.stringify({
        match_score: 70, match_category: 'good', strengths: [], gaps: { missing_skills: [], experience_gaps: [] }, reasoning: 'ok'
      }),
      model: 'test-model',
      truncated: false
    });

    await matchJob(job.id);

    const prompt: string = sendPrompt.mock.calls[0][0][0].content;
    expect(prompt).toContain('Unternehmens-Details');
    expect(prompt).not.toContain('Ähnliche Jobs');
    expect(prompt).not.toContain('IT-Administrator');
  });
});
