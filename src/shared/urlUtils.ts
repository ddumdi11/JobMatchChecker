/**
 * Bereinigt Job-URLs von Tracking-Parametern.
 * LinkedIn-URLs werden auf kanonisches Format normalisiert.
 * Kritisch für Nanobot-Integration (URL = primärer Key).
 */
export function cleanJobUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string') return url;

  const trimmed = url.trim();
  if (!trimmed) return url;

  // LinkedIn: Job-ID extrahieren und kanonische URL bauen
  const linkedinMatch = trimmed.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/);
  if (linkedinMatch) {
    return `https://www.linkedin.com/jobs/view/${linkedinMatch[1]}/`;
  }

  // XING: Nicht verändern (Tracking-Links können Server-Aktionen auslösen)
  if (trimmed.includes('xing.com')) {
    return trimmed;
  }

  // Andere URLs: Query-Parameter entfernen
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed; // Ungültige URL nicht verändern
  }
}
