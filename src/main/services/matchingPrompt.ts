/**
 * Prompt-Aufbau und Antwort-Parsing fürs KI-Matching (matchingService).
 *
 * Eigenes Modul ohne Electron-/DB-/Provider-Abhängigkeiten, damit es in CI
 * testbar ist (matchingService lädt über aiProviderService electron-store).
 *
 * Hintergrund (Job 406, DevSecOps): Gap-reiche Jobs erzeugten so lange
 * Antworten, dass das Token-Limit mitten im JSON griff. Deshalb sind die
 * Listen im Prompt begrenzt (MATCHING_LIMITS) und der Parser erkennt
 * abgeschnittene Antworten gezielt.
 */

import { AiResponseTruncatedError, looksLikeTruncatedJson } from './aiTruncation';

/**
 * Obergrenzen für die Listen der Matching-Antwort. Gelten im Prompt UND als
 * defensive Kürzung im Parser – eine Quelle, damit beides nicht auseinanderläuft.
 * Inhaltlich: Bei einem schwach passenden Job sind die Top-Lücken das einzig
 * Relevante; 12 Lernempfehlungen sind Rauschen statt Hilfe.
 */
export const MATCHING_LIMITS = {
  missingSkills: 8,
  experienceGaps: 4,
  recommendations: 5
} as const;

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
 * Build the matching prompt for AI-based job matching
 */
export function buildMatchingPrompt(profile: any, skills: any[], preferences: any, job: any): string {
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

**LÄNGENGRENZEN (verbindlich):**
- "missing_skills": höchstens ${MATCHING_LIMITS.missingSkills} Einträge – nur die für diese Stelle WICHTIGSTEN Lücken, nach Relevanz absteigend sortiert
- "experience_gaps": höchstens ${MATCHING_LIMITS.experienceGaps} Einträge – die wichtigsten zuerst
- "recommendations": höchstens ${MATCHING_LIMITS.recommendations} Einträge, jede Empfehlung in EINEM Satz
- Lieber wenige aussagekräftige Einträge als eine vollständige Aufzählung

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
 * Die KI-Antwort war vollständig, aber kein gültiges/verwertbares JSON.
 * (Abgeschnittene Antworten → AiResponseTruncatedError.)
 */
export class MatchingResponseFormatError extends Error {
  constructor(public readonly cause?: unknown) {
    super('KI-Antwort hatte kein gültiges JSON-Format und konnte nicht verarbeitet werden.');
    this.name = 'MatchingResponseFormatError';
  }
}

/**
 * Parse the AI response and extract matching result.
 *
 * - Abgeschnittenes JSON (offenes Objekt/String, z. B. Token-Limit bei einem
 *   Provider ohne Stop-Grund) → AiResponseTruncatedError.
 * - Sonstiges ungültiges JSON → MatchingResponseFormatError.
 * - Listen werden defensiv auf MATCHING_LIMITS gekürzt, falls die KI die
 *   Längengrenzen aus dem Prompt ignoriert.
 */
export function parseMatchingResponse(text: string): MatchingResult {
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

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    if (looksLikeTruncatedJson(text)) {
      throw new AiResponseTruncatedError();
    }
    throw new MatchingResponseFormatError(error);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new MatchingResponseFormatError();
  }

  // Validate and transform to MatchingResult
  return {
    matchScore: Math.min(100, Math.max(0, parsed.match_score || 0)),
    matchCategory: parsed.match_category || 'needs_work',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    gaps: {
      missingSkills: Array.isArray(parsed.gaps?.missing_skills)
        ? parsed.gaps.missing_skills.slice(0, MATCHING_LIMITS.missingSkills).map((g: any) => ({
            skill: g?.skill || '',
            requiredLevel: g?.required_level || 0,
            currentLevel: g?.current_level || 0,
            gap: g?.gap || 0
          }))
        : [],
      experienceGaps: Array.isArray(parsed.gaps?.experience_gaps)
        ? parsed.gaps.experience_gaps.slice(0, MATCHING_LIMITS.experienceGaps).map((g: any) => ({
            area: g?.area || '',
            requiredYears: g?.required_years || 0,
            actualYears: g?.actual_years || 0
          }))
        : []
    },
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, MATCHING_LIMITS.recommendations)
      : [],
    reasoning: parsed.reasoning || 'Keine Begründung verfügbar'
  };
}
