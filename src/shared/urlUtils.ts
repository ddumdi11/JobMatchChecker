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
    // 1) ID im Pfad: /jobs/view/{ID} bzw. /comm/jobs/view/{ID}
    const jobIdMatch = parsed.pathname.match(/\/(?:comm\/)?jobs\/view\/(\d+)/);
    if (jobIdMatch) {
      return `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}/`;
    }

    // 2) ID nur im Query: /jobs/search/?currentJobId=… oder
    //    /jobs/collections/…?currentJobId=… → auf /jobs/view/{ID}/ kanonisieren
    const currentJobId = parsed.searchParams.get('currentJobId');
    if (currentJobId && /^\d+$/.test(currentJobId)) {
      return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
    }
    // Sonst: durchfallen zum generischen origin+pathname-Fallback unten
    // (degenerierter Key ohne echte Job-ID – siehe getJobUrlKey()).
  }

  // XING: Nicht verändern (Tracking-Links können Server-Aktionen auslösen)
  if (hostname === 'xing.com' || hostname.endsWith('.xing.com')) {
    return trimmed;
  }

  // Andere URLs: Query-Parameter entfernen
  return `${parsed.origin}${parsed.pathname}`;
}

/**
 * Liefert einen stabilen Dubletten-Schlüssel für eine Job-URL – oder `null`,
 * wenn die URL keine echte Job-Identität trägt.
 *
 * Hintergrund (Edge Case): Alt-Einträge, deren URL vor dem currentJobId-Fix
 * gespeichert wurde, kollabieren zu ID-losen LinkedIn-Fallback-Keys
 * (z. B. `https://www.linkedin.com/jobs/search`). Solche degenerierten Keys
 * sind untereinander identisch, OHNE dass es Dubletten sind. Sie dürfen daher
 * NICHT als sicherer Schlüssel gelten – solche Jobs werden höchstens über die
 * MÖGLICH-Schiene (Titel+Firma) verglichen.
 *
 * Regeln:
 * - LinkedIn: nur kanonisches `/jobs/view/{ID}/` zählt; jede andere
 *   LinkedIn-URL (search/collections/… ohne extrahierbare ID) → `null`.
 * - XING: `/jobs/{slug}-{numericId}` → Key aus der numerischen ID am
 *   Slug-Ende, Query/Fragment komplett verworfen. Gleiche ID mit
 *   abweichendem Slug/Tracking (`ijt=…`) → gleicher Key.
 * - Sonstige Hosts: Key = origin + pathname (Query/Fragment verworfen),
 *   außer der Pfad ist degeneriert (leer, "/", bloße Such-/Listen-Endpunkte)
 *   → `null`.
 *
 * Wichtig: Ein identischer Key bedeutet NICHT automatisch "sichere Dublette".
 * URLs können falsch zugeordnet sein (fehlerhafte Importe); die "sicher"-
 * Einstufung erfolgt erst zusätzlich über den normalisierten Titel
 * (siehe jobService: findJobDuplicates / scanDuplicateGroups).
 */

/** Degenerierte Pfade taugen nicht als Job-Key (bloße Listen-/Suchseiten). */
function isDegeneratePath(pathname: string): boolean {
  if (pathname === '' || pathname === '/') return true;
  // Bloße Listen-/Such-Endpunkte ohne spezifische Job-Kennung
  return /^\/(jobs?|stellenangebote|stellenanzeigen|stellenmarkt|jobsuche|suche|search|results|ergebnisse)\/?$/i.test(
    pathname
  );
}

export function getJobUrlKey(url: string | null | undefined): string | null {
  const cleaned = cleanJobUrl(url);
  if (!cleaned || typeof cleaned !== 'string') return null;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null; // nicht-parsebare "URL" trägt keinen verlässlichen Key
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const hostname = parsed.hostname;

  // LinkedIn: ausschließlich kanonische Job-View-URLs sind ein Key
  if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
    return /^\/jobs\/view\/\d+\/?$/.test(parsed.pathname) ? cleaned : null;
  }

  // XING: numerische ID am Slug-Ende extrahieren, Query/Tracking verwerfen
  if (hostname === 'xing.com' || hostname.endsWith('.xing.com')) {
    const idMatch = parsed.pathname.match(/-(\d+)\/?$/);
    if (idMatch) {
      return `https://www.xing.com/jobs/${idMatch[1]}`;
    }
    // Kein numerischer ID-Suffix → generische Behandlung unten (Query strippen)
  }

  // Generisch: Key = origin + pathname (Query/Fragment strippen)
  if (isDegeneratePath(parsed.pathname)) return null;

  return `${parsed.origin}${parsed.pathname}`;
}

/**
 * Extrahiert alle http(s)-URLs aus einem Freitext (z. B. eingefügte Mail).
 * Job-Mails enthalten oft mehrere Links (Firmenseite, Tracking, Job-Link) –
 * daher werden ALLE gefunden, dedupliziert und um typische Satz-/Markup-
 * Zeichen am Ende bereinigt. Reihenfolge = Vorkommen im Text.
 */
export function extractUrls(text: string | null | undefined): string[] {
  if (!text || typeof text !== 'string') return [];

  const matches = text.match(/https?:\/\/[^\s"'<>()[\]{}]+/gi);
  if (!matches) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of matches) {
    // Häufige nachgestellte Satzzeichen entfernen
    const url = raw.replace(/[.,;:!?]+$/, '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}
