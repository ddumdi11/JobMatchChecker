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

/**
 * Minimale Sicht auf eine Quelle für die Domain-Erkennung
 * (`domainPatterns` = job_sources.domain_patterns, kommagetrennt).
 */
export interface SourceDomainEntry {
  id: number;
  domainPatterns?: string | null;
}

/** Zerlegt `domain_patterns` in normalisierte Domains ("www."/"*."/"." vorne entfernt). */
export function parseDomainPatterns(patterns: string | null | undefined): string[] {
  if (!patterns || typeof patterns !== 'string') return [];
  return patterns
    .split(',')
    .map(p => p.trim().toLowerCase().replace(/^\*?\./, '').replace(/^www\./, '').replace(/\.$/, ''))
    .filter(Boolean);
}

/**
 * Ermittelt die Quelle (job_sources.id) zu einer URL über ihren Hostnamen.
 *
 * Regeln:
 * - Treffer, wenn Hostname == Domain oder auf ".<Domain>" endet
 *   (`jobs.linkedin.com` → linkedin.com; `notlinkedin.com` → KEIN Treffer).
 * - Mehrere Treffer: die längste (spezifischste) Domain gewinnt.
 * - Gleich lange Treffer bei verschiedenen Quellen = mehrdeutig → null.
 * - Kein Treffer / ungültige URL → null. Niemals raten.
 */
export function detectSourceIdFromUrl(
  url: string | null | undefined,
  sources: SourceDomainEntry[]
): number | null {
  if (!url || typeof url !== 'string') return null;

  let hostname: string;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }

  let bestId: number | null = null;
  let bestLength = 0;
  let ambiguous = false;
  for (const source of sources) {
    for (const domain of parseDomainPatterns(source.domainPatterns)) {
      if (hostname !== domain && !hostname.endsWith(`.${domain}`)) continue;
      if (domain.length > bestLength) {
        bestId = source.id;
        bestLength = domain.length;
        ambiguous = false;
      } else if (domain.length === bestLength && source.id !== bestId) {
        ambiguous = true;
      }
    }
  }
  return ambiguous ? null : bestId;
}

/** Bis zu so vielen nicht-leeren Zeilen (z. B. "Geöffnete Tab-URLs:") darf vor dem URL-Block stehen. */
const MAX_LINES_BEFORE_URL_BLOCK = 3;

/**
 * Liefert den URL-Block am ANFANG eines eingefügten Rohtexts (Reihenfolge der
 * Weiterleitungskette: erste URL = Jobbörse/Absender, letzte URL = Link zum
 * vollständigen Angebot; bei nur einer URL ist sie beides).
 *
 * - Der Block beginnt mit der ersten Zeile, die eine URL enthält – aber nur,
 *   wenn davor höchstens MAX_LINES_BEFORE_URL_BLOCK nicht-leere Zeilen stehen
 *   (Überschrift o. Ä.). Sonst gibt es keinen Block → [].
 * - Er endet an der ersten nicht-leeren Zeile OHNE URL. Leerzeilen innerhalb
 *   werden übersprungen.
 * - URLs weiter unten im Anzeigentext (Bewerbungslink, Fußzeile) zählen nie.
 * - Wiederholungen bleiben erhalten (A, B, A → letzte URL = A).
 */
export function extractLeadingUrls(text: string | null | undefined): string[] {
  if (!text || typeof text !== 'string') return [];

  const block: string[] = [];
  let textLinesBefore = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const urls = extractUrls(line);
    if (urls.length === 0) {
      if (block.length > 0) break; // Block zu Ende
      if (++textLinesBefore > MAX_LINES_BEFORE_URL_BLOCK) break; // kein Block am Anfang
      continue;
    }
    // Jedes Vorkommen in Reihenfolge behalten (auch Wiederholungen): endet die
    // Kette wieder bei der Ausgangs-URL (A, B, A), ist A der Link zum Angebot.
    block.push(...urls);
  }
  return block;
}

/**
 * Ermittelt die Quelle aus einem eingefügten Rohtext. Maßgeblich ist
 * ausschließlich die ERSTE URL des URL-Blocks am Textanfang (sie trägt die
 * Jobbörse; weitere URLs sind Weiterleitungen bzw. der Link zum Angebot) –
 * es wird nie durchprobiert.
 */
export function detectSourceIdFromText(
  text: string | null | undefined,
  sources: SourceDomainEntry[]
): number | null {
  const [firstUrl] = extractLeadingUrls(text);
  return firstUrl ? detectSourceIdFromUrl(firstUrl, sources) : null;
}

/**
 * Ermittelt die Quell-URL (Link zum vollständigen Angebot) aus einem
 * eingefügten Rohtext: maßgeblich ist die LETZTE URL des URL-Blocks am
 * Textanfang (Ende der Weiterleitungskette; bei nur einer URL ist sie
 * zugleich die erste). Bereinigt via cleanJobUrl. Kein Block → null
 * (Aufrufer nutzt dann ggf. die KI-`url` als Fallback).
 */
export function extractOfferUrlFromText(text: string | null | undefined): string | null {
  const urls = extractLeadingUrls(text);
  if (urls.length === 0) return null;
  const cleaned = cleanJobUrl(urls[urls.length - 1]);
  return typeof cleaned === 'string' && cleaned ? cleaned : null;
}
