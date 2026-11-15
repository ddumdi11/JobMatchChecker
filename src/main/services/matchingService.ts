import { getDatabase } from '../database/db';
import * as log from 'electron-log';
import { sendPrompt } from './aiProviderService';
import { TIMEOUT_MATCHING_MS, MATCHING_MAX_TOKENS } from '../../shared/constants';
import { AiResponseTruncatedError } from './aiTruncation';
import { buildMatchingPrompt, parseMatchingResponse, type MatchingResult } from './matchingPrompt';
import { runMatchingBatch } from './matchingBatch';
import { formatJobRef } from '../../shared/formatUtils';
import type { BulkMatchResult } from '../../shared/types';

export type { MatchingResult } from './matchingPrompt';

/**
 * Match a job offer against the user's profile using the configured AI provider
 * @param jobId - ID of the job to match
 * @returns Matching result with score, gaps, and recommendations
 */
export async function matchJob(jobId: number): Promise<MatchingResult> {
  const db = getDatabase();

  try {
    // 1. Load User Profile
    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
    const skills = db.prepare(`
      SELECT s.*, sc.name as category_name
      FROM skills s
      LEFT JOIN skill_categories sc ON s.category_id = sc.id
      ORDER BY sc.sort_order, s.name
    `).all() as any[];
    const preferences = db.prepare('SELECT * FROM user_preferences WHERE id = 1').get() as any;

    log.info(`Loaded profile: ${profile?.first_name} ${profile?.last_name}`);
    log.info(`Loaded ${skills.length} skills from database`);

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

    // 4. Call AI via provider abstraction
    log.info('Calling AI for job matching...');
    const aiResponse = await sendPrompt(
      [{ role: 'user', content: prompt }],
      { maxTokens: MATCHING_MAX_TOKENS, timeoutMs: TIMEOUT_MATCHING_MS }
    );

    // 4b. Abgeschnittene Antwort (Token-Limit) → gezielter Fehler, kein Parse-Versuch
    if (aiResponse.truncated) {
      log.error(
        `Matching-Antwort für Job ${jobId} abgeschnitten: Token-Limit ${MATCHING_MAX_TOKENS} erreicht ` +
        `(outputTokens: ${aiResponse.usage?.outputTokens ?? '?'}, model: ${aiResponse.model}).`
      );
      throw new AiResponseTruncatedError();
    }

    // 5. Parse Response
    let rawResult: MatchingResult;
    try {
      rawResult = parseMatchingResponse(aiResponse.content);
    } catch (parseError) {
      log.error('Failed to parse AI response:', parseError);
      log.error('Response text:', aiResponse.content);
      throw parseError;
    }

    // 5b. Plausibility check: validate score against reported gaps
    const result = validateAndAdjustScore(rawResult);

    // 6. Save to matching_results table (store actual model used)
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
      aiResponse.model
    );

    // 7. Update match_score in job_offers table
    db.prepare(`
      UPDATE job_offers
      SET match_score = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(result.matchScore, jobId);

    log.info(`Matching completed for job ${jobId}: ${result.matchScore}% (model: ${aiResponse.model})`);
    return result;

  } catch (error: any) {
    log.error('Error in matchJob:', error);
    throw error;
  }
}

/**
 * Validate AI score against reported gaps and adjust if inconsistent.
 * This acts as a safety net against binary scoring where the AI ignores level gaps.
 */
function validateAndAdjustScore(result: MatchingResult): MatchingResult {
  const gaps = result.gaps.missingSkills;

  if (gaps.length === 0) {
    return result; // No gaps reported, trust the AI score
  }

  // Calculate average fulfillment from the gap report
  let totalFulfillment = 0;
  let gapCount = 0;

  for (const gap of gaps) {
    if (gap.requiredLevel > 0) {
      const fulfillment = gap.currentLevel / gap.requiredLevel;
      totalFulfillment += Math.min(fulfillment, 1.0);
      gapCount++;
    }
  }

  if (gapCount === 0) {
    return result; // No meaningful gaps to validate against
  }

  const avgFulfillment = totalFulfillment / gapCount;

  // If significant gaps exist but score is unreasonably high, cap it
  // Rule: If average gap fulfillment is below 50%, score shouldn't exceed 65%
  // If average gap fulfillment is below 30%, score shouldn't exceed 50%
  let maxReasonableScore = 100;
  if (avgFulfillment < 0.3) {
    maxReasonableScore = 50;
  } else if (avgFulfillment < 0.5) {
    maxReasonableScore = 65;
  } else if (avgFulfillment < 0.7) {
    maxReasonableScore = 80;
  }

  if (result.matchScore > maxReasonableScore) {
    const adjustedScore = maxReasonableScore;
    log.info(
      `Score adjusted: ${result.matchScore}% → ${adjustedScore}% ` +
      `(avg gap fulfillment: ${(avgFulfillment * 100).toFixed(0)}%, ` +
      `${gapCount} gaps reported)`
    );

    // Adjust category to match new score
    let adjustedCategory = result.matchCategory;
    if (adjustedScore >= 80) adjustedCategory = 'good';
    else if (adjustedScore >= 55) adjustedCategory = 'needs_work';
    else adjustedCategory = 'poor';

    return {
      ...result,
      matchScore: adjustedScore,
      matchCategory: adjustedCategory,
      reasoning: result.reasoning +
        ` [Score angepasst von ${result.matchScore}% auf ${adjustedScore}% basierend auf Level-Gap-Analyse]`
    };
  }

  return result;
}


/**
 * Bulk match all jobs that don't have a match score yet (or rematch all)
 * @param rematchAll - If true, rematch all jobs including those with existing scores
 * @param onProgress - Callback for progress updates
 * @returns Summary of bulk matching results
 */
export async function bulkMatchJobs(
  rematchAll: boolean = false,
  onProgress?: (current: number, total: number, jobTitle: string) => void
): Promise<BulkMatchResult> {
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

    // Note: skipped is always 0 here since SQL query already filters out jobs without full_text
    log.info(`Starting bulk matching for ${jobs.length} jobs (rematchAll: ${rematchAll})`);

    const result = await runMatchingBatch(jobs, matchJob, {
      onProgress,
      onMatched: (job, i, total) => log.info(`Matched job ${i + 1}/${total}: ${formatJobRef(job.id, job.title)}`),
      onFailed: (job, error) => log.error(`Failed to match ${formatJobRef(job.id, job.title)}:`, error)
    });

    log.info(`Bulk matching completed: ${result.matched} matched, ${result.failed} failed`);

    return result;

  } catch (error: any) {
    log.error('Error in bulkMatchJobs:', error);
    throw error;
  }
}

/**
 * Match specific jobs by their IDs
 * @param jobIds - Array of job IDs to match
 * @param onProgress - Callback for progress updates
 * @returns Summary of matching results
 */
export async function matchSelectedJobs(
  jobIds: number[],
  onProgress?: (current: number, total: number, jobTitle: string) => void
): Promise<BulkMatchResult> {
  const db = getDatabase();

  try {
    if (jobIds.length === 0) {
      return { matched: 0, failed: 0, skipped: 0, errors: [], matchedJobs: [], failedJobs: [] };
    }

    // Get job details for selected IDs
    const placeholders = jobIds.map(() => '?').join(',');
    const jobs = db.prepare(`
      SELECT id, title FROM job_offers
      WHERE id IN (${placeholders})
      AND full_text IS NOT NULL AND full_text != ''
      ORDER BY created_at DESC
    `).all(...jobIds) as any[];

    const skipped = jobIds.length - jobs.length; // Jobs without full_text

    log.info(`Starting selective matching for ${jobs.length} jobs (${skipped} skipped due to missing text)`);

    const result = await runMatchingBatch(jobs, matchJob, {
      onProgress,
      skipped,
      onMatched: (job, i, total) => log.info(`Matched job ${i + 1}/${total}: ${formatJobRef(job.id, job.title)}`),
      onFailed: (job, error) => log.error(`Failed to match ${formatJobRef(job.id, job.title)}:`, error)
    });

    log.info(`Selective matching completed: ${result.matched} matched, ${result.failed} failed, ${skipped} skipped`);

    return result;

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
