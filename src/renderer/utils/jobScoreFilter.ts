import type { JobOffer, ScoreFilter } from '../../shared/types';

/**
 * Reine, komponentenunabhängige Score-/Range-Filterung für die Jobliste.
 *
 * Extrahiert aus JobList, damit die Logik ohne window.api / Renderer-Umgebung
 * unter Node testbar ist (Konsequenz aus dem TZ-/Testbarkeits-Fund in PR #63).
 *
 * Regeln:
 * - scoreFilter 'all'     → keine Einschränkung nach Score-Vorhandensein.
 * - scoreFilter 'with'    → nur Jobs MIT Score.
 * - scoreFilter 'without' → nur Jobs OHNE Score.
 * - Aktiver Score-Range ([min,max] ≠ [0,100]): Jobs mit Score müssen im Range
 *   liegen; Jobs OHNE Score passieren den Range NUR, wenn explizit 'without'
 *   gewählt ist (fixt den früheren Leak, bei dem unscored Jobs bei aktivem
 *   Range unter 'all' fälschlich durchrutschten).
 */
export function hasScore(job: Pick<JobOffer, 'matchScore'>): boolean {
  return job.matchScore !== null && job.matchScore !== undefined;
}

export function isRangeActive(range: number[]): boolean {
  return range[0] > 0 || range[1] < 100;
}

export function filterJobsByScore<T extends Pick<JobOffer, 'matchScore'>>(
  jobs: T[],
  scoreFilter: ScoreFilter,
  matchScoreRange: number[]
): T[] {
  let result = jobs;

  // 1) Vorhandensein des Scores
  if (scoreFilter === 'with') {
    result = result.filter(hasScore);
  } else if (scoreFilter === 'without') {
    result = result.filter(job => !hasScore(job));
  }

  // 2) Score-Range (nur wenn aktiv)
  if (isRangeActive(matchScoreRange)) {
    result = result.filter(job => {
      if (!hasScore(job)) {
        // Unscored Jobs dürfen den aktiven Range nur unter 'without' passieren.
        return scoreFilter === 'without';
      }
      const score = job.matchScore as number;
      return score >= matchScoreRange[0] && score <= matchScoreRange[1];
    });
  }

  return result;
}
