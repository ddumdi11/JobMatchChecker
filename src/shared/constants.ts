/**
 * Shared constants for Job Match Checker
 */

export const APP_NAME = 'Job Match Checker';
export const APP_VERSION = '0.1.0';

export const DB_VERSION = '1.0.0';

export const SKILL_LEVELS = {
  MIN: 0,
  MAX: 10
} as const;

export const MATCH_SCORE = {
  MIN: 0,
  MAX: 100,
  EXCELLENT: 90,
  GOOD: 75,
  FAIR: 60,
  POOR: 40
} as const;

export const SKILL_CATEGORIES = [
  'Programming Languages',
  'Frameworks & Libraries',
  'Databases',
  'DevOps & Cloud',
  'Tools & IDEs',
  'Soft Skills',
  'Domain Knowledge'
] as const;

export const GAP_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

export const IPC_CHANNELS = {
  // Job operations
  JOB_CREATE: 'job:create',
  JOB_UPDATE: 'job:update',
  JOB_DELETE: 'job:delete',
  JOB_GET_ALL: 'job:getAll',
  JOB_GET_BY_ID: 'job:getById',

  // Profile operations
  PROFILE_CREATE: 'profile:create',
  PROFILE_UPDATE: 'profile:update',
  PROFILE_GET: 'profile:get',

  // Skills operations
  SKILLS_GET_ALL: 'skills:getAll',
  SKILLS_UPSERT: 'skills:upsert',
  SKILLS_DELETE: 'skills:delete',

  // Preferences operations
  PREFERENCES_GET: 'preferences:get',
  PREFERENCES_UPDATE: 'preferences:update',

  // Matching operations
  MATCH_RUN: 'match:run',
  MATCH_GET_RESULTS: 'match:getResults',

  // Parser operations
  PARSE_LATEX_CV: 'parse:latexCv',
  PARSE_JOB_TEXT: 'parse:jobText',
  PARSE_PDF: 'parse:pdf',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Database
  DB_BACKUP: 'db:backup',
  DB_RESTORE: 'db:restore',
  DB_MIGRATE: 'db:migrate',

  // Testing
  TEST_MIGRATION: 'test-migration'
} as const;

export const DEFAULT_MATCHING_PROMPT = `You are an expert career advisor and job matching assistant.

Analyze the following job offer and user profile to determine compatibility.

USER PROFILE:
{profile}

JOB OFFER:
{job}

Provide a detailed analysis in JSON format with the following structure:
{
  "matchScore": <number between 0-100>,
  "gapAnalysis": [
    {
      "category": "<skill category>",
      "missingSkill": "<specific skill name>",
      "requiredLevel": <number 0-10>,
      "currentLevel": <number 0-10>,
      "priority": "<high|medium|low>"
    }
  ],
  "reasoning": "<detailed explanation of the score and gaps>"
}

Be objective and consider:
1. Technical skill alignment (40%)
2. Experience level match (30%)
3. Location/remote preferences (15%)
4. Salary expectations (15%)`;
