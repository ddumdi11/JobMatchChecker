/**
 * Skills Import Service - CSV/JSON Import for Skills
 *
 * Handles importing skills from CSV or JSON files
 * Features:
 * - CSV/JSON parsing
 * - Future Skills Framework 2030 support
 * - Duplicate detection (by skill name + category)
 * - Batch upsert to skills table
 */

import { getDatabase } from '../database/db';
import type { HardSkill, SkillLevel, SkillType, FutureSkillCategory, AssessmentMethod } from '../../shared/types';

// =============================================================================
// Types
// =============================================================================

export interface SkillImportRow {
  name: string;
  category: string;
  level?: number | string; // Can be numeric or string like "5" or "Beginner/Intermediate/Advanced/Expert"
  yearsOfExperience?: number | string;
  skillType?: SkillType;
  futureSkillCategory?: FutureSkillCategory;
  assessmentMethod?: AssessmentMethod;
  certifications?: string | string[]; // Can be comma-separated string or array
  notes?: string;
}

export interface SkillImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; skill: string; error: string }>;
}

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Parse CSV content into skill rows
 * Expected columns: name, category, level, yearsOfExperience, skillType, futureSkillCategory, assessmentMethod, certifications, notes
 * Minimum required: name, category, level
 */
export function parseSkillsCsv(csvContent: string): SkillImportRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));

  const rows: SkillImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: any = {};

    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      if (value) {
        row[header] = value;
      }
    });

    // Validate minimum required fields
    if (row.name && row.category) {
      rows.push(row as SkillImportRow);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      i++; // Skip next quote
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// =============================================================================
// JSON Parsing
// =============================================================================

/**
 * Parse JSON content into skill rows
 * Accepts both array format: [{name, category, level, ...}]
 * And object format: {skills: [{...}]}
 */
export function parseSkillsJson(jsonContent: string): SkillImportRow[] {
  try {
    const parsed = JSON.parse(jsonContent);

    // Handle array format
    if (Array.isArray(parsed)) {
      return parsed.filter(skill => skill.name && skill.category);
    }

    // Handle object format with 'skills' key
    if (parsed.skills && Array.isArray(parsed.skills)) {
      return parsed.skills.filter((skill: any) => skill.name && skill.category);
    }

    return [];
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return [];
  }
}

// =============================================================================
// Level Normalization
// =============================================================================

/**
 * Normalize skill level from various formats to 0-10 scale
 * Supports:
 * - Numeric: 0-10 (direct)
 * - String numeric: "5" → 5
 * - Beginner/Novice → 2
 * - Intermediate/Competent → 5
 * - Advanced/Proficient → 7
 * - Expert/Master → 9
 */
export function normalizeSkillLevel(level: string | number | undefined): SkillLevel {
  if (level === undefined || level === null) return 5; // Default to intermediate

  // If numeric, validate range
  if (typeof level === 'number') {
    return Math.max(0, Math.min(10, Math.round(level))) as SkillLevel;
  }

  // If string, try to parse as number first
  const numericLevel = parseInt(level as string, 10);
  if (!isNaN(numericLevel)) {
    return Math.max(0, Math.min(10, numericLevel)) as SkillLevel;
  }

  // Text-based levels
  const levelLower = (level as string).toLowerCase();
  if (levelLower.includes('beginner') || levelLower.includes('novice') || levelLower.includes('anfänger')) return 2;
  if (levelLower.includes('intermediate') || levelLower.includes('competent') || levelLower.includes('fortgeschritten')) return 5;
  if (levelLower.includes('advanced') || levelLower.includes('proficient') || levelLower.includes('erfahren')) return 7;
  if (levelLower.includes('expert') || levelLower.includes('master') || levelLower.includes('experte')) return 9;

  return 5; // Default fallback
}

// =============================================================================
// Category ID Resolution
// =============================================================================

/**
 * Get or create category ID by name
 */
export function getCategoryId(categoryName: string): number {
  const db = getDatabase();

  // Try to find existing category
  const existing = db.prepare('SELECT id FROM skill_categories WHERE name = ?').get(categoryName) as { id: number } | undefined;
  if (existing) return existing.id;

  // Create new category
  const result = db.prepare('INSERT INTO skill_categories (name, sort_order) VALUES (?, 999)').run(categoryName);
  return result.lastInsertRowid as number;
}

// =============================================================================
// Duplicate Detection
// =============================================================================

/**
 * Check if skill already exists (by name + category)
 */
export function findExistingSkill(name: string, categoryId: number): HardSkill | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT s.*, sc.name as category
    FROM skills s
    LEFT JOIN skill_categories sc ON s.category_id = sc.id
    WHERE s.name = ? AND s.category_id = ?
  `).get(name, categoryId) as any;

  if (!row) return null;

  return rowToSkill(row);
}

/**
 * Convert database row to HardSkill interface
 */
function rowToSkill(row: any): HardSkill {
  return {
    id: row.id,
    name: row.name,
    category: row.category || '',
    level: row.level as SkillLevel,
    yearsOfExperience: row.years_experience,
    skillType: row.skill_type,
    futureSkillCategory: row.future_skill_category,
    assessmentMethod: row.assessment_method,
    certifications: row.certifications,
    lastAssessed: row.last_assessed ? new Date(row.last_assessed) : undefined,
    notes: row.notes
  };
}

// =============================================================================
// Import Operations
// =============================================================================

/**
 * Import skills from parsed rows
 * - Skips duplicates with same name+category if level is equal or lower
 * - Updates duplicates if new level is higher
 * - Inserts new skills
 */
export function importSkills(rows: SkillImportRow[]): SkillImportResult {
  const db = getDatabase();
  const result: SkillImportResult = {
    success: true,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const categoryId = getCategoryId(row.category);
      const level = normalizeSkillLevel(row.level);
      const yearsExp = row.yearsOfExperience ?
        (typeof row.yearsOfExperience === 'number' ? row.yearsOfExperience : parseFloat(row.yearsOfExperience))
        : undefined;

      // Handle certifications (array → comma-separated string)
      let certificationsStr: string | undefined = undefined;
      if (row.certifications) {
        certificationsStr = Array.isArray(row.certifications)
          ? row.certifications.join(', ')
          : row.certifications;
      }

      // Check for existing skill
      const existing = findExistingSkill(row.name, categoryId);

      if (existing) {
        // Update if new level is higher or if new data has additional fields
        if (level > existing.level || row.skillType || row.futureSkillCategory || row.assessmentMethod) {
          db.prepare(`
            UPDATE skills
            SET level = ?,
                years_experience = COALESCE(?, years_experience),
                skill_type = COALESCE(?, skill_type),
                future_skill_category = COALESCE(?, future_skill_category),
                assessment_method = COALESCE(?, assessment_method),
                certifications = COALESCE(?, certifications),
                notes = COALESCE(?, notes),
                last_assessed = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            level,
            yearsExp,
            row.skillType,
            row.futureSkillCategory,
            row.assessmentMethod,
            certificationsStr,
            row.notes,
            existing.id
          );
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // Insert new skill
        db.prepare(`
          INSERT INTO skills (
            name, category_id, level, years_experience,
            skill_type, future_skill_category, assessment_method,
            certifications, notes, last_assessed,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          row.name,
          categoryId,
          level,
          yearsExp,
          row.skillType,
          row.futureSkillCategory,
          row.assessmentMethod,
          certificationsStr,
          row.notes
        );
        result.imported++;
      }
    } catch (error: any) {
      result.errors.push({
        row: i + 1,
        skill: row.name,
        error: error.message || 'Unknown error'
      });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * Import skills from CSV content
 */
export function importSkillsFromCsv(csvContent: string): SkillImportResult {
  const rows = parseSkillsCsv(csvContent);
  if (rows.length === 0) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, skill: '', error: 'No valid rows found in CSV' }]
    };
  }
  return importSkills(rows);
}

/**
 * Import skills from JSON content
 */
export function importSkillsFromJson(jsonContent: string): SkillImportResult {
  const rows = parseSkillsJson(jsonContent);
  if (rows.length === 0) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, skill: '', error: 'No valid skills found in JSON' }]
    };
  }
  return importSkills(rows);
}
