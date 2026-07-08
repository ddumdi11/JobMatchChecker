/**
 * Unit tests for skillsImportService — stable-id duplicate-free re-import.
 *
 * Runs against the real per-file migrated SQLite DB provided by tests/setup.ts
 * (schema + seeded skill_categories). No mocks — exercises real SQL.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../src/main/database/db';
import {
  importSkills,
  detectConflicts,
  importNewSkillsOnly,
} from '../../src/main/services/skillsImportService';

function countSkills(): number {
  return (getDatabase().prepare('SELECT COUNT(*) AS c FROM skills').get() as { c: number }).c;
}

function getSkillByName(name: string): any {
  return getDatabase()
    .prepare(`
      SELECT s.*, sc.name AS category
      FROM skills s LEFT JOIN skill_categories sc ON s.category_id = sc.id
      WHERE s.name = ?
    `)
    .get(name);
}

describe('Unit: skillsImportService — stable-id re-import', () => {
  beforeEach(() => {
    // The per-file DB is shared across tests in this file; start each with an
    // empty skills table (seeded skill_categories remain).
    getDatabase().prepare('DELETE FROM skills').run();
  });

  it('id-match with name correction updates the original (no duplicate)', () => {
    const r1 = importSkills([{ name: 'Pyton', category: 'Programmiersprachen', level: 5 }]);
    expect(r1.imported).toBe(1);
    const id = getSkillByName('Pyton').id;

    const r2 = importSkills([{ id, name: 'Python', category: 'Programmiersprachen', level: 5 }]);
    expect(r2.updated).toBe(1);
    expect(r2.imported).toBe(0);

    expect(countSkills()).toBe(1);
    expect(getSkillByName('Python')).toBeTruthy();
    expect(getSkillByName('Pyton')).toBeFalsy();
  });

  it('id-match with category change moves the skill (no duplicate)', () => {
    importSkills([{ name: 'SQL', category: 'Programmiersprachen', level: 4 }]);
    const id = getSkillByName('SQL').id;

    const r = importSkills([{ id, name: 'SQL', category: 'Datenbanken', level: 4 }]);
    expect(r.updated).toBe(1);

    expect(countSkills()).toBe(1);
    expect(getSkillByName('SQL').category).toBe('Datenbanken');
  });

  it('unknown id falls back to name+category match (no duplicate)', () => {
    importSkills([{ name: 'Java', category: 'Programmiersprachen', level: 4 }]);

    const r = importSkills([{ id: 999999, name: 'Java', category: 'Programmiersprachen', level: 6 }]);
    expect(r.updated).toBe(1);
    expect(r.imported).toBe(0);

    expect(countSkills()).toBe(1);
    expect(getSkillByName('Java').level).toBe(6);
  });

  it('import without id field (old format) still matches by name+category', () => {
    importSkills([{ name: 'Go', category: 'Programmiersprachen', level: 3 }]);

    const r = importSkills([{ name: 'Go', category: 'Programmiersprachen', level: 7 }]);
    expect(r.updated).toBe(1);

    expect(countSkills()).toBe(1);
    expect(getSkillByName('Go').level).toBe(7);
  });

  it('name+category fallback is trim + case-insensitive (no duplicate)', () => {
    importSkills([{ name: 'React', category: 'Frameworks & Libraries', level: 5 }]);

    const r = importSkills([{ name: '  react ', category: 'frameworks & libraries', level: 8 }]);
    expect(r.updated).toBe(1);
    expect(r.imported).toBe(0);

    expect(countSkills()).toBe(1);
  });

  it('detectConflicts routes id-matches to autoUpdates, and importNewSkillsOnly applies them', () => {
    importSkills([{ name: 'Rust', category: 'Programmiersprachen', level: 5 }]);
    const id = getSkillByName('Rust').id;

    const rows = [{ id, name: 'Rust Lang', category: 'Programmiersprachen', level: 5 }];
    const detection = detectConflicts(rows);
    expect(detection.autoUpdates.length).toBe(1);
    expect(detection.conflicts.length).toBe(0);

    const r = importNewSkillsOnly(rows);
    expect(r.updated).toBe(1);
    expect(countSkills()).toBe(1);
    expect(getSkillByName('Rust Lang')).toBeTruthy();
  });
});
