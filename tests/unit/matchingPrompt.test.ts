/**
 * Matching-Antworten: Längengrenzen im Prompt, Erkennung abgeschnittener
 * Antworten (Token-Limit) und defensives Kürzen im Parser.
 *
 * Anlass: Job 406 (DevSecOps) – 13 Skill-Lücken + 4 Erfahrungslücken +
 * 12 Empfehlungen sprengten max_tokens 2000; die Antwort brach mitten in
 * "recommendations" ab ("Alternativ…") und das Matching scheiterte
 * reproduzierbar mit dem irreführenden "Bitte versuche es erneut".
 *
 * Fix: fix/matching-response-truncation
 */

import { describe, it, expect } from 'vitest';
import {
  buildMatchingPrompt,
  parseMatchingResponse,
  MATCHING_LIMITS,
  MatchingResponseFormatError
} from '../../src/main/services/matchingPrompt';
import {
  AiResponseTruncatedError,
  isTruncatedStop,
  looksLikeTruncatedJson
} from '../../src/main/services/aiTruncation';
import { MATCHING_MAX_TOKENS, TIMEOUT_MATCHING_MS } from '../../src/shared/constants';

const VALID = {
  match_score: 48,
  match_category: 'poor',
  strengths: ['Solide Kenntnisse in Python'],
  gaps: {
    missing_skills: [{ skill: 'Kubernetes', required_level: 7, current_level: 1, gap: 6 }],
    experience_gaps: [{ area: 'DevSecOps', required_years: 3, actual_years: 0 }]
  },
  recommendations: ['Kubernetes-Grundlagen aufbauen.'],
  reasoning: 'Viele Kernanforderungen fehlen.'
};

/** Nachbau des Job-406-Abbruchs: endet mitten im letzten Empfehlungs-String. */
const TRUNCATED_406 =
  '{\n  "match_score": 42,\n  "match_category": "poor",\n  "strengths": ["Basiskenntnisse in Linux"],\n' +
  '  "gaps": {\n    "missing_skills": [{"skill": "Remedy", "required_level": 6, "current_level": 0, "gap": 6}],\n' +
  '    "experience_gaps": []\n  },\n  "recommendations": [\n    "Kubernetes lernen",\n    "Alternativ';

describe('parseMatchingResponse – abgeschnittene Antwort', () => {
  it('Job-406-Muster (mitten im String) → AiResponseTruncatedError', () => {
    expect(() => parseMatchingResponse(TRUNCATED_406)).toThrow(AiResponseTruncatedError);
  });

  it('abgeschnitten innerhalb eines ```json-Zauns (schließender Zaun fehlt)', () => {
    expect(() => parseMatchingResponse('```json\n' + TRUNCATED_406)).toThrow(AiResponseTruncatedError);
  });

  it('abgeschnitten nach einem geschlossenen Teilobjekt (Regex fände eine "}")', () => {
    const text = '{"match_score": 40, "gaps": {"missing_skills": [{"skill": "K8s", "gap": 5}], "experience_gaps": [';
    expect(() => parseMatchingResponse(text)).toThrow(AiResponseTruncatedError);
  });

  it('Meldung richtet sich an den Nutzer: kein "erneut versuchen", Verweis auf die Entwicklung', () => {
    try {
      parseMatchingResponse(TRUNCATED_406);
      expect.unreachable();
    } catch (e: any) {
      expect(e.message).toMatch(/abgeschnitten/);
      expect(e.message).toMatch(/Erneutes Ausführen hilft nicht/);
      expect(e.message).toMatch(/Fall für die Entwicklung/);
      expect(e.message).not.toMatch(/versuche es erneut/i);
    }
  });
});

describe('parseMatchingResponse – Formatfehler vs. Abbruch', () => {
  it('vollständiges, aber ungültiges JSON → Formatfehler, NICHT Abbruch', () => {
    expect(() => parseMatchingResponse('{"match_score": 40,, "x": 1}')).toThrow(MatchingResponseFormatError);
    expect(() => parseMatchingResponse('{"match_score": 40,, "x": 1}')).not.toThrow(AiResponseTruncatedError);
  });

  it('gar kein JSON → Formatfehler', () => {
    expect(() => parseMatchingResponse('Ich kann das leider nicht bewerten.')).toThrow(MatchingResponseFormatError);
  });

  it('JSON null / Array → Formatfehler', () => {
    expect(() => parseMatchingResponse('null')).toThrow(MatchingResponseFormatError);
    expect(() => parseMatchingResponse('[1, 2]')).toThrow(MatchingResponseFormatError);
  });
});

describe('parseMatchingResponse – gültige Antworten', () => {
  it('mappt snake_case → camelCase wie bisher', () => {
    const r = parseMatchingResponse(JSON.stringify(VALID));
    expect(r.matchScore).toBe(48);
    expect(r.matchCategory).toBe('poor');
    expect(r.gaps.missingSkills).toEqual([{ skill: 'Kubernetes', requiredLevel: 7, currentLevel: 1, gap: 6 }]);
    expect(r.gaps.experienceGaps).toEqual([{ area: 'DevSecOps', requiredYears: 3, actualYears: 0 }]);
    expect(r.recommendations).toEqual(['Kubernetes-Grundlagen aufbauen.']);
  });

  it('akzeptiert ```json-Zaun und Text drumherum', () => {
    expect(parseMatchingResponse('```json\n' + JSON.stringify(VALID) + '\n```').matchScore).toBe(48);
    expect(parseMatchingResponse('Hier: ' + JSON.stringify(VALID) + ' Ende.').matchScore).toBe(48);
  });

  it('Klammern/Escapes in Strings stören nicht', () => {
    const v = { ...VALID, reasoning: 'Braucht "K8s" {Cluster} [Ops] \\ Pfade' };
    expect(parseMatchingResponse(JSON.stringify(v)).reasoning).toBe(v.reasoning);
  });

  it('kürzt zu lange Listen defensiv auf MATCHING_LIMITS (8/4/5)', () => {
    const many = {
      ...VALID,
      gaps: {
        missing_skills: Array.from({ length: 13 }, (_, i) => ({ skill: `S${i}`, required_level: 5, current_level: 1, gap: 4 })),
        experience_gaps: Array.from({ length: 6 }, (_, i) => ({ area: `A${i}`, required_years: 2, actual_years: 0 }))
      },
      recommendations: Array.from({ length: 12 }, (_, i) => `R${i}`)
    };
    const r = parseMatchingResponse(JSON.stringify(many));
    expect(r.gaps.missingSkills).toHaveLength(8);
    expect(r.gaps.experienceGaps).toHaveLength(4);
    expect(r.recommendations).toHaveLength(5);
    // die ersten (= wichtigsten) bleiben erhalten
    expect(r.gaps.missingSkills[0].skill).toBe('S0');
    expect(r.recommendations[4]).toBe('R4');
  });
});

describe('buildMatchingPrompt – Längengrenzen', () => {
  const prompt = buildMatchingPrompt(
    { first_name: 'Test', last_name: 'Person' },
    [{ name: 'Python', level: 6, category: 'Hard Skills' }],
    null,
    { title: 'Expert DevSecOps', company: 'Firma', full_text: 'Kubernetes, Remedy, Cloud' }
  );

  it('enthält die drei Grenzen aus MATCHING_LIMITS', () => {
    expect(MATCHING_LIMITS).toEqual({ missingSkills: 8, experienceGaps: 4, recommendations: 5 });
    expect(prompt).toMatch(/"missing_skills": höchstens 8 Einträge/);
    expect(prompt).toMatch(/"experience_gaps": höchstens 4 Einträge/);
    expect(prompt).toMatch(/"recommendations": höchstens 5 Einträge/);
  });

  it('fordert Sortierung nach Relevanz', () => {
    expect(prompt).toMatch(/WICHTIGSTEN Lücken, nach Relevanz absteigend sortiert/);
  });
});

describe('Provider-Signal und Fallback-Erkennung', () => {
  it('isTruncatedStop: Anthropic max_tokens, OpenRouter length', () => {
    expect(isTruncatedStop('anthropic', 'max_tokens')).toBe(true);
    expect(isTruncatedStop('anthropic', 'end_turn')).toBe(false);
    expect(isTruncatedStop('anthropic', undefined)).toBe(false);
    expect(isTruncatedStop('openrouter', 'length')).toBe(true);
    expect(isTruncatedStop('openrouter', 'stop')).toBe(false);
    expect(isTruncatedStop('openrouter', null)).toBe(false);
  });

  it('looksLikeTruncatedJson', () => {
    expect(looksLikeTruncatedJson(TRUNCATED_406)).toBe(true);
    expect(looksLikeTruncatedJson('{"a": "offen')).toBe(true);
    expect(looksLikeTruncatedJson('{"a": [1, 2')).toBe(true);
    expect(looksLikeTruncatedJson('{"a": "\\"}"}')).toBe(false); // escapte Quote im String
    expect(looksLikeTruncatedJson(JSON.stringify(VALID))).toBe(false);
    expect(looksLikeTruncatedJson('kein JSON')).toBe(false);
  });

  it('Token-Limit fürs Matching: deutlich über 2000, aber im Timeout-Rahmen', () => {
    expect(MATCHING_MAX_TOKENS).toBe(8000);
    expect(TIMEOUT_MATCHING_MS).toBe(120_000);
  });
});
