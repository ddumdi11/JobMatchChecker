/**
 * Erkennung abgeschnittener KI-Antworten (Token-Limit erreicht).
 *
 * Eigenes Modul ohne Electron-/Provider-Abhängigkeiten, damit es in CI
 * testbar ist und sowohl aiProviderService (Provider-Signal) als auch die
 * Antwort-Parser (Fallback ohne Signal) es nutzen können.
 */

import type { AIProvider } from '../../shared/types';

/**
 * Die KI-Antwort wurde wegen des Token-Limits abgeschnitten. Ein erneuter
 * Versuch scheitert deterministisch wieder – daher bewusst KEIN
 * "Bitte erneut versuchen" in der Meldung.
 */
export class AiResponseTruncatedError extends Error {
  constructor() {
    super(
      'KI-Antwort wurde abgeschnitten (Token-Limit erreicht). ' +
      'Erneutes Ausführen hilft nicht – das ist ein Fall für die Entwicklung.'
    );
    this.name = 'AiResponseTruncatedError';
  }
}

/**
 * Bildet den Stop-Grund des Providers auf "abgeschnitten" ab:
 * Anthropic `stop_reason === 'max_tokens'`, OpenRouter (OpenAI-kompatibel)
 * `finish_reason === 'length'`. Fehlender/unbekannter Grund → false.
 */
export function isTruncatedStop(provider: AIProvider, reason: unknown): boolean {
  if (provider === 'anthropic') return reason === 'max_tokens';
  return reason === 'length';
}

/**
 * Fallback für Provider ohne Stop-Grund: Ist das JSON ab der ersten `{`
 * strukturell unvollständig (offenes Objekt/Array oder offener String)?
 * Zählt Klammern nur außerhalb von Strings und beachtet Escapes.
 * Kein `{` vorhanden → false (das ist Formatmüll, kein Abbruch).
 */
export function looksLikeTruncatedJson(text: string): boolean {
  const start = text.indexOf('{');
  if (start === -1) return false;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return false; // Wurzelobjekt vollständig geschlossen
    }
  }
  return inString || depth > 0;
}
