import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../database/db';
import * as log from 'electron-log';

/**
 * Matching result structure returned by AI analysis
 */
export interface MatchingResult {
  matchScore: number;
  matchCategory: 'perfect' | 'good' | 'needs_work' | 'poor';
  strengths: string[];
  gaps: {
    missingSkills: Array<{
      skill: string;
      requiredLevel: number;
      currentLevel: number;
      gap: number;
    }>;
    experienceGaps: Array<{
      area: string;
      requiredYears: number;
      actualYears: number;
    }>;
  };
  recommendations: string[];
  reasoning: string;
}

/**
 * Match a job offer against the user's profile using Claude AI
 * @param jobId - ID of the job to match
 * @param apiKey - Anthropic API key
 * @returns Matching result with score, gaps, and recommendations
 */
export async function matchJob(jobId: number, apiKey: string): Promise<MatchingResult> {
  const db = getDatabase();

  try {
    // 1. Load User Profile
    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
    const skills = db.prepare('SELECT * FROM skills WHERE user_profile_id = 1').all() as any[];
    const preferences = db.prepare('SELECT * FROM user_preferences WHERE id = 1').get() as any;

    if (!profile) {
      throw new Error('Kein Profil gefunden. Bitte erstelle zuerst ein Profil.');
    }

    // 2. Load Job
    const job = db.prepare(`
      SELECT jo.*, js.name as source_name
      FROM job_offers jo
      LEFT JOIN job_sources js ON jo.source_id = js.id
      WHERE jo.id = ?
    `).get(jobId) as any;

    if (!job) {
      throw new Error('Job nicht gefunden');
    }

    // 3. Construct Prompt
    const prompt = buildMatchingPrompt(profile, skills, preferences, job);

    // 4. Call Claude API
    log.info('Calling Claude API for job matching...');
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // 5. Parse Response
    const firstBlock = response.content[0];
    if (firstBlock.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }
    const result = parseMatchingResponse(firstBlock.text);

    // 6. Save to matching_results table
    db.prepare(`
      INSERT INTO matching_results (
        job_id, prompt_id, match_score, match_category,
        gap_analysis, strengths, ai_reasoning,
        api_model, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      jobId,
      1, // Default prompt ID
      result.matchScore,
      result.matchCategory,
      JSON.stringify(result.gaps),
      JSON.stringify(result.strengths),
      result.reasoning,
      'claude-sonnet-4-5-20250929'
    );

    // 7. Update match_score in job_offers table
    db.prepare(`
      UPDATE job_offers
      SET match_score = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(result.matchScore, jobId);

    log.info(`Matching completed for job ${jobId}: ${result.matchScore}%`);
    return result;

  } catch (error: any) {
    log.error('Error in matchJob:', error);
    throw error;
  }
}

/**
 * Build the matching prompt for Claude AI
 */
function buildMatchingPrompt(profile: any, skills: any[], preferences: any, job: any): string {
  // Format skills by category
  const skillsByCategory: Record<string, any[]> = {};
  skills.forEach(skill => {
    const category = skill.category || 'Uncategorized';
    if (!skillsByCategory[category]) {
      skillsByCategory[category] = [];
    }
    skillsByCategory[category].push(skill);
  });

  const skillsText = Object.entries(skillsByCategory)
    .map(([category, categorySkills]) => {
      const skillsList = categorySkills
        .map(s => `  - ${s.name} (Level ${s.level}/10${s.years_experience ? `, ${s.years_experience} Jahre Erfahrung` : ''})`)
        .join('\n');
      return `${category}:\n${skillsList}`;
    })
    .join('\n\n');

  return `Du bist ein Experte für Job-Matching. Analysiere, wie gut das folgende Jobprofil zum Kandidatenprofil passt.

**Kandidaten-Profil:**
Name: ${profile.first_name} ${profile.last_name}
${profile.email ? `Email: ${profile.email}` : ''}
${profile.location ? `Standort: ${profile.location}` : ''}

**Skills (${skills.length} insgesamt):**
${skillsText || 'Keine Skills angegeben'}

**Präferenzen:**
${preferences ? `
- Gewünschtes Gehalt: ${preferences.desired_salary_min ? `${preferences.desired_salary_min}€` : '?'} - ${preferences.desired_salary_max ? `${preferences.desired_salary_max}€` : '?'}
- Remote-Präferenz: ${preferences.remote_preference || 'Nicht angegeben'}
${preferences.desired_locations ? `- Wunschstandorte: ${preferences.desired_locations}` : ''}
${preferences.contract_types ? `- Vertragsarten: ${preferences.contract_types}` : ''}
` : 'Keine Präferenzen angegeben'}

**Job-Angebot:**
Titel: ${job.title}
Firma: ${job.company}
${job.location ? `Standort: ${job.location}` : ''}
${job.remote_option ? `Remote: ${job.remote_option}` : ''}
${job.salary_range ? `Gehalt: ${job.salary_range}` : ''}
${job.contract_type ? `Vertragsart: ${job.contract_type}` : ''}

Beschreibung:
${job.full_text || 'Keine Beschreibung vorhanden'}

---

**Aufgabe:**
Gib eine strukturierte Analyse als JSON zurück mit folgenden Feldern:

{
  "match_score": <0-100>,
  "match_category": "perfect" | "good" | "needs_work" | "poor",
  "strengths": ["Stärke 1", "Stärke 2", ...],
  "gaps": {
    "missing_skills": [
      {"skill": "Python", "required_level": 8, "current_level": 3, "gap": 5}
    ],
    "experience_gaps": [
      {"area": "Team Lead", "required_years": 2, "actual_years": 0}
    ]
  },
  "recommendations": ["Empfehlung 1", "Empfehlung 2", ...],
  "reasoning": "Begründung des Scores in 2-3 Sätzen"
}

**Bewertungskriterien:**
- Skills-Match (40%): Wie gut passen die vorhandenen Skills zu den Anforderungen?
- Erfahrungs-Match (30%): Passt das Erfahrungslevel?
- Standort/Remote-Match (15%): Passen Standort und Remote-Optionen?
- Gehalts-Match (15%): Liegt das Gehalt im gewünschten Bereich?

**Wichtig:**
- Sei objektiv und ehrlich
- Bei fehlenden Skills: Gib konkrete Level-Gaps an
- Bei Erfahrungslücken: Nenne die Bereiche
- Empfehlungen sollen konkret und umsetzbar sein
- Das Reasoning sollte die wichtigsten Punkte zusammenfassen

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`;
}

/**
 * Parse the AI response and extract matching result
 */
function parseMatchingResponse(text: string): MatchingResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find JSON object
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonText);

    // Validate and transform to MatchingResult
    return {
      matchScore: Math.min(100, Math.max(0, parsed.match_score || 0)),
      matchCategory: parsed.match_category || 'needs_work',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      gaps: {
        missingSkills: Array.isArray(parsed.gaps?.missing_skills)
          ? parsed.gaps.missing_skills.map((g: any) => ({
              skill: g.skill || '',
              requiredLevel: g.required_level || 0,
              currentLevel: g.current_level || 0,
              gap: g.gap || 0
            }))
          : [],
        experienceGaps: Array.isArray(parsed.gaps?.experience_gaps)
          ? parsed.gaps.experience_gaps.map((g: any) => ({
              area: g.area || '',
              requiredYears: g.required_years || 0,
              actualYears: g.actual_years || 0
            }))
          : []
      },
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      reasoning: parsed.reasoning || 'Keine Begründung verfügbar'
    };

  } catch (error: any) {
    log.error('Failed to parse AI response:', error);
    log.error('Response text:', text);
    throw new Error('AI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.');
  }
}

/**
 * Bulk match all jobs that don't have a match score yet (or rematch all)
 * @param apiKey - Anthropic API key
 * @param rematchAll - If true, rematch all jobs including those with existing scores
 * @param onProgress - Callback for progress updates
 * @returns Summary of bulk matching results
 */
export async function bulkMatchJobs(
  apiKey: string,
  rematchAll: boolean = false,
  onProgress?: (current: number, total: number, jobTitle: string) => void
): Promise<{ matched: number; failed: number; skipped: number; errors: string[] }> {
  const db = getDatabase();

  try {
    // Get jobs to match
    let jobs: any[];
    if (rematchAll) {
      jobs = db.prepare(`
        SELECT id, title FROM job_offers
        WHERE full_text IS NOT NULL AND full_text != ''
        ORDER BY created_at DESC
      `).all();
    } else {
      jobs = db.prepare(`
        SELECT id, title FROM job_offers
        WHERE match_score IS NULL
        AND full_text IS NOT NULL AND full_text != ''
        ORDER BY created_at DESC
      `).all();
    }

    const total = jobs.length;
    let matched = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    log.info(`Starting bulk matching for ${total} jobs (rematchAll: ${rematchAll})`);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      if (onProgress) {
        onProgress(i + 1, total, job.title);
      }

      try {
        await matchJob(job.id, apiKey);
        matched++;
        log.info(`Matched job ${i + 1}/${total}: ${job.title}`);
      } catch (error: any) {
        failed++;
        const errorMsg = `Job "${job.title}": ${error.message || 'Unknown error'}`;
        errors.push(errorMsg);
        log.error(`Failed to match job ${job.id}:`, error);
      }

      // Small delay between API calls to avoid rate limiting
      if (i < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    log.info(`Bulk matching completed: ${matched} matched, ${failed} failed, ${skipped} skipped`);

    return { matched, failed, skipped, errors };

  } catch (error: any) {
    log.error('Error in bulkMatchJobs:', error);
    throw error;
  }
}

/**
 * Match specific jobs by their IDs
 * @param apiKey - Anthropic API key
 * @param jobIds - Array of job IDs to match
 * @param onProgress - Callback for progress updates
 * @returns Summary of matching results
 */
export async function matchSelectedJobs(
  apiKey: string,
  jobIds: number[],
  onProgress?: (current: number, total: number, jobTitle: string) => void
): Promise<{ matched: number; failed: number; skipped: number; errors: string[] }> {
  const db = getDatabase();

  try {
    if (jobIds.length === 0) {
      return { matched: 0, failed: 0, skipped: 0, errors: [] };
    }

    // Get job details for selected IDs
    const placeholders = jobIds.map(() => '?').join(',');
    const jobs = db.prepare(`
      SELECT id, title FROM job_offers
      WHERE id IN (${placeholders})
      AND full_text IS NOT NULL AND full_text != ''
      ORDER BY created_at DESC
    `).all(...jobIds) as any[];

    const total = jobs.length;
    let matched = 0;
    let failed = 0;
    const skipped = jobIds.length - jobs.length; // Jobs without full_text
    const errors: string[] = [];

    log.info(`Starting selective matching for ${total} jobs (${skipped} skipped due to missing text)`);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      if (onProgress) {
        onProgress(i + 1, total, job.title);
      }

      try {
        await matchJob(job.id, apiKey);
        matched++;
        log.info(`Matched job ${i + 1}/${total}: ${job.title}`);
      } catch (error: any) {
        failed++;
        const errorMsg = `Job "${job.title}": ${error.message || 'Unknown error'}`;
        errors.push(errorMsg);
        log.error(`Failed to match job ${job.id}:`, error);
      }

      // Small delay between API calls to avoid rate limiting
      if (i < jobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    log.info(`Selective matching completed: ${matched} matched, ${failed} failed, ${skipped} skipped`);

    return { matched, failed, skipped, errors };

  } catch (error: any) {
    log.error('Error in matchSelectedJobs:', error);
    throw error;
  }
}

/**
 * Get count of jobs without match score (for UI display)
 */
export function getUnmatchedJobCount(): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM job_offers
    WHERE match_score IS NULL
    AND full_text IS NOT NULL AND full_text != ''
  `).get() as { count: number };
  return result.count;
}

/**
 * Get matching history for a job
 * @param jobId - ID of the job
 * @returns Array of previous matching results
 */
export function getMatchingHistory(jobId: number): any[] {
  const db = getDatabase();

  try {
    const history = db.prepare(`
      SELECT * FROM matching_results
      WHERE job_id = ?
      ORDER BY created_at DESC
    `).all(jobId) as any[];

    return history.map(h => ({
      id: h.id,
      jobId: h.job_id,
      matchScore: h.match_score,
      matchCategory: h.match_category,
      strengths: JSON.parse(h.strengths || '[]'),
      gaps: JSON.parse(h.gap_analysis || '{"missingSkills":[],"experienceGaps":[]}'),
      recommendations: [], // Not stored in current schema
      reasoning: h.ai_reasoning || '',
      createdAt: h.created_at,
      apiModel: h.api_model
    }));

  } catch (error: any) {
    log.error('Error getting matching history:', error);
    throw error;
  }
}
