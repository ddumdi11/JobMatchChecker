/**
 * Unit tests für die extrahierte Score-/Range-Filterlogik der Jobliste.
 *
 * Rein funktional – kein window.api, keine Renderer-Umgebung, keine DB.
 * Deckt ab: scoreFilter all/with/without sowie die Kombination aus aktivem
 * Score-Range und 'without' (Regression für den früheren unscored-Leak).
 */
import { describe, it, expect } from 'vitest';
import { filterJobsByScore, isRangeActive, hasScore } from '../../src/renderer/utils/jobScoreFilter';

type J = { title: string; matchScore: number | null };

const jobs: J[] = [
  { title: 'Low', matchScore: 10 },
  { title: 'Mid', matchScore: 55 },
  { title: 'High', matchScore: 90 },
  { title: 'NoScoreA', matchScore: null },
  { title: 'NoScoreB', matchScore: null }
];

const titles = (rows: J[]) => rows.map(j => j.title).sort();
const FULL: number[] = [0, 100];

describe('jobScoreFilter – hasScore / isRangeActive', () => {
  it('hasScore erkennt null als "kein Score"', () => {
    expect(hasScore({ matchScore: 0 })).toBe(true); // 0 ist ein gültiger Score
    expect(hasScore({ matchScore: null })).toBe(false);
    expect(hasScore({ matchScore: undefined as any })).toBe(false);
  });

  it('isRangeActive nur bei eingeschränktem Bereich', () => {
    expect(isRangeActive([0, 100])).toBe(false);
    expect(isRangeActive([1, 100])).toBe(true);
    expect(isRangeActive([0, 99])).toBe(true);
  });
});

describe('jobScoreFilter – scoreFilter ohne aktiven Range', () => {
  it("'all' liefert alle Jobs", () => {
    expect(filterJobsByScore(jobs, 'all', FULL)).toHaveLength(5);
  });

  it("'with' liefert nur Jobs mit Score", () => {
    expect(titles(filterJobsByScore(jobs, 'with', FULL))).toEqual(['High', 'Low', 'Mid']);
  });

  it("'without' liefert nur Jobs ohne Score", () => {
    expect(titles(filterJobsByScore(jobs, 'without', FULL))).toEqual(['NoScoreA', 'NoScoreB']);
  });
});

describe('jobScoreFilter – aktiver Score-Range', () => {
  it("'all' + Range 50–100: unscored Jobs fliegen raus (Leak-Fix)", () => {
    const result = filterJobsByScore(jobs, 'all', [50, 100]);
    // Nur Mid (55) und High (90); KEINE unscored Jobs mehr.
    expect(titles(result)).toEqual(['High', 'Mid']);
  });

  it("'with' + Range 50–100: nur bewertete Jobs im Bereich", () => {
    expect(titles(filterJobsByScore(jobs, 'with', [50, 100]))).toEqual(['High', 'Mid']);
  });

  it("'without' + Range 50–100: nur unscored Jobs, Range wird ignoriert", () => {
    // Kombination Range + without: die unscored Jobs bleiben, obwohl der Range aktiv ist.
    expect(titles(filterJobsByScore(jobs, 'without', [50, 100]))).toEqual(['NoScoreA', 'NoScoreB']);
  });

  it('Range-Grenzen sind inklusive', () => {
    expect(titles(filterJobsByScore(jobs, 'with', [10, 90]))).toEqual(['High', 'Low', 'Mid']);
    expect(titles(filterJobsByScore(jobs, 'with', [11, 89]))).toEqual(['Mid']);
  });

  it('mutiert die Eingabe nicht', () => {
    const before = titles(jobs);
    filterJobsByScore(jobs, 'without', [50, 100]);
    expect(titles(jobs)).toEqual(before);
  });
});
