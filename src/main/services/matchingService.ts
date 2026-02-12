import { getDatabase } from '../database/db';
import * as log from 'electron-log';
import { sendPrompt } from './aiProviderService';

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
      { maxTokens: 2000 }
    );

    // 5. Parse Response
    const rawResult = parseMatchingResponse(aiResponse.content);

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
        .map(s => {
          // Build skill description with metadata
          let desc = `  - ${s.name} (Level ${s.level}/10`;
          if (s.years_of_experience) {
            desc += `, ${s.years_of_experience} Jahre Erfahrung`;
          }
          // Add confidence and market relevance metadata for AI weighting
          const metadata: string[] = [];
          if (s.confidence) {
            const confidenceLabels: Record<string, string> = {
              'very_likely': 'sehr sicher',
              'possible': 'möglich'
            };
            metadata.push(`Konfidenz: ${confidenceLabels[s.confidence] || s.confidence}`);
          }
          if (s.market_relevance) {
            const relevanceLabels: Record<string, string> = {
              'high': 'hoch',
              'medium': 'mittel',
              'low': 'niedrig'
            };
            metadata.push(`Marktrelevanz: ${relevanceLabels[s.market_relevance] || s.market_relevance}`);
          }
          if (metadata.length > 0) {
            desc += ` [${metadata.join(', ')}]`;
          }
          desc += ')';
          return desc;
        })
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

**Bewertungskriterien (Gewichtung):**
- Skills-Match (40%): Wie gut passen die vorhandenen Skills zu den Anforderungen?
- Erfahrungs-Match (30%): Passt das Erfahrungslevel?
- Standort/Remote-Match (15%): Passen Standort und Remote-Optionen?
- Gehalts-Match (15%): Liegt das Gehalt im gewünschten Bereich?

**KRITISCH - Level-proportionale Skill-Bewertung:**
Das Skill-Level des Kandidaten MUSS proportional in den Score einfließen! Ein Skill bei Level 3/10 ist NICHT gleichwertig mit einem Skill bei Level 8/10.

Berechne für JEDEN geforderten Skill einen Erfüllungsgrad:
- Erfüllungsgrad = min(kandidat_level / anforderungs_level, 1.0)
- Beispiel: Job fordert "Python Level 7" → Kandidat hat "Python Level 3" → Erfüllungsgrad = 3/7 = 0.43 (nur 43% erfüllt!)
- Beispiel: Job fordert "SQL Level 5" → Kandidat hat "SQL Level 7" → Erfüllungsgrad = 1.0 (voll erfüllt)
- Fehlender Skill → Erfüllungsgrad = 0.0

Der Skills-Match-Anteil (40%) ergibt sich aus dem DURCHSCHNITT aller Erfüllungsgrade.

**ANTI-PATTERN - Vermeide binäre Bewertung!**
FALSCH: "Kandidat hat ITSM (egal welches Level) → volle Punkte für ITSM"
RICHTIG: "Kandidat hat ITSM Level 4/10, Job fordert Level 7 → nur 57% Erfüllung für diesen Skill"
Ein Skill bei Level 3/10 erfüllt eine Anforderung auf Level 8 nur zu ca. 37% (3/8 = 0.375).

**Kalibrierungsbeispiele für realistische Scores:**
- 85-100%: Kandidat erfüllt fast alle Anforderungen auf dem geforderten Level oder höher
- 70-84%: Gute Passung, aber einige Skills unter dem geforderten Level oder 1-2 fehlende Kernfähigkeiten
- 55-69%: Mittlere Passung, mehrere Skills deutlich unter dem geforderten Level
- 40-54%: Schwache Passung, viele Lücken oder Skills weit unter dem Anforderungsniveau
- 0-39%: Kaum Übereinstimmung, grundlegende Anforderungen nicht erfüllt

Beispiel: QA-Tester (Level 6) bewirbt sich auf eine Rollout-/IT-Infrastruktur-Stelle.
Hat ITSM Level 4/10, Hardware Level 3/10 → realistischer Score: 45-55%, NICHT 70%+

**Skill-Gewichtung nach Metadata:**
Bei manchen Skills sind Konfidenz und Marktrelevanz angegeben. Nutze diese als ZUSÄTZLICHE Faktoren:
- Marktrelevanz "hoch" → Faktor 1.2
- Marktrelevanz "mittel" → Faktor 1.0
- Marktrelevanz "niedrig" → Faktor 0.8
- Konfidenz "sehr sicher" → Faktor 1.1
- Konfidenz "möglich" → Faktor 1.0
- Fehlende Werte → Faktor 1.0

**Skill-Kategorien-Priorisierung:**
1. Hard Skills (höchste Priorität) - Technische Fähigkeiten sind am wichtigsten für den Job-Match
2. Future Skills (zweite Priorität) - Transformative, digitale, gemeinschaftliche Skills
3. Soft Skills (dritte Priorität) - Zusätzliche persönliche Eigenschaften, können max. 5-10% zum Score beitragen

**Level-basierte Sprachrichtlinien für Stärken-Beschreibungen:**
Verwende in den "strengths" Texten Formulierungen, die dem tatsächlichen Skill-Level entsprechen:
- Level 1-2/10: "Erste Erfahrungen mit...", "Grundverständnis von...", "Anfängerkenntnisse in..."
- Level 3-4/10: "Basiskenntnisse in...", "Praktische Grundlagen in...", "Grundsolide Erfahrung mit..."
- Level 5-6/10: "Solide Kenntnisse in...", "Gute praktische Erfahrung mit...", "Fundierte Kenntnisse in..."
- Level 7-8/10: "Starke Erfahrung mit...", "Sehr gute Kenntnisse in...", "Tiefgehende Expertise in..."
- Level 9-10/10: "Expertenkenntnisse in...", "Umfangreiche Expertise in...", "Tiefe Spezialisierung in..."
WICHTIG: Beschreibe NIE ein Level 3-4 als "stark" oder "umfangreich". Sei ehrlich und realistisch!

**Wichtig für Skill-Matching (SEMANTISCH interpretieren!):**
- Interpretiere Skills SEMANTISCH, nicht nur nach exaktem Namen oder Schreibweise
- Ignoriere Unterschiede in Groß/Kleinschreibung, Leerzeichen, Bindestriche (z.B. "Softwaretesting" = "Software Testing" = "Software-Testing")
- Wenn der Job "Programmiersprache" fordert und der Kandidat "Python", "TypeScript" oder "Java" hat → das ERFÜLLT die Anforderung
- "Softwareentwicklung" wird durch konkrete Programmiersprachen + Frameworks erfüllt
- "Datenbanken" wird durch "SQL", "PostgreSQL", "MySQL", "MongoDB" etc. erfüllt
- "Webtechnologien" wird durch "React", "Angular", "Vue", "HTML/CSS", "JavaScript" erfüllt
- "Testing & Qualitätssicherung" wird durch "Softwaretesting", "Testautomatisierung", "QA", "Unit Testing", "Jest", "Selenium" etc. erfüllt
- "Technische Affinität" / "Logisches Denken" / "Strukturierte Analyse" wird durch vorhandene technische Skills + Soft Skills wie "Analytisches Denken", "Critical Thinking" impliziert
- Bewerte nach dem BESTEN passenden Skill des Kandidaten, nicht nach Namens-Match
- Bei "current_level" im Gap-Report: Verwende das Level des am besten passenden vorhandenen Skills

**Wichtig für Erfahrungs-Lücken:**
- Leite Erfahrungsjahre aus den Skill-Jahren ab!
- Wenn Kandidat "Softwaretesting 3 Jahre" oder "Testautomatisierung 3 Jahre" hat → "Software Testing: 3 Jahre" Erfahrung
- Wenn Kandidat "Python 10 Jahre" hat → "Softwareentwicklung/Programmierung: 10 Jahre" Erfahrung
- Nimm das MAXIMUM der relevanten Skill-Jahre für einen Erfahrungsbereich
- Nur Erfahrungslücken angeben wenn wirklich KEINE relevanten Skill-Jahre vorhanden sind

**Allgemeine Regeln:**
- Sei objektiv und ehrlich
- Bei fehlenden Skills: Gib konkrete Level-Gaps an (nur wenn wirklich KEIN semantisch passender Skill vorhanden)
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
 * @param rematchAll - If true, rematch all jobs including those with existing scores
 * @param onProgress - Callback for progress updates
 * @returns Summary of bulk matching results
 */
export async function bulkMatchJobs(
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
    // Note: skipped is always 0 here since SQL query already filters out jobs without full_text
    const errors: string[] = [];

    log.info(`Starting bulk matching for ${total} jobs (rematchAll: ${rematchAll})`);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      if (onProgress) {
        onProgress(i + 1, total, job.title);
      }

      try {
        await matchJob(job.id);
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

    log.info(`Bulk matching completed: ${matched} matched, ${failed} failed`);

    return { matched, failed, skipped: 0, errors };

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
        await matchJob(job.id);
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
