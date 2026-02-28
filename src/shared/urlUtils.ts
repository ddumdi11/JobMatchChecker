/**
 * Bereinigt Job-URLs von Tracking-Parametern.
 * LinkedIn-URLs werden auf kanonisches Format normalisiert.
 * Kritisch für Nanobot-Integration (URL = primärer Key).
 */
export function cleanJobUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string') return url;

  const trimmed = url.trim();
  if (!trimmed) return url;

  // URL parsen für hostname-basierte Erkennung
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed; // Ungültige URL nicht verändern
  }

  const hostname = parsed.hostname;

  // LinkedIn: Job-ID extrahieren und kanonische URL bauen
  if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
    const jobIdMatch = parsed.pathname.match(/\/(?:comm\/)?jobs\/view\/(\d+)/);
    if (jobIdMatch) {
      return `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}/`;
    }
  }

  // XING: Nicht verändern (Tracking-Links können Server-Aktionen auslösen)
  if (hostname === 'xing.com' || hostname.endsWith('.xing.com')) {
    return trimmed;
  }

  // Andere URLs: Query-Parameter entfernen
  return `${parsed.origin}${parsed.pathname}`;
}
