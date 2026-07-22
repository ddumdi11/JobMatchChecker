import * as fs from 'fs';
import * as path from 'path';

export interface NanobotConfig {
  /** Anzahl Tage rückwärts ab heute (inklusive), Default 90. */
  days: number;
  /** Zielordner für jobs_processed.csv. */
  out: string;
  /** Pfad zur SQLite-DB (read-only geöffnet). */
  db: string;
}

/** Repo-Standard-DB: <repo>/data/jobmatcher.db (relativ zu diesem Tool). */
export function defaultDbPath(): string {
  // src/ → tools/nanobot-export → tools → <repo>
  return path.resolve(__dirname, '../../../data/jobmatcher.db');
}

/** Optionale, gitignorete lokale Konfiguration neben package.json. */
function loadConfigFile(): Partial<NanobotConfig> {
  const file = path.resolve(__dirname, '../nanobot.config.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<NanobotConfig>;
  } catch (e: any) {
    throw new Error(`nanobot.config.json ist ungültiges JSON: ${e.message}`);
  }
}

/** Keys, die zwingend einen Wert brauchen (kein Boolean-Flag sein dürfen). */
const VALUE_KEYS = new Set(['out', 'db', 'days']);

/**
 * Minimaler `--key value` / `--key=value` Parser (keine Fremd-Deps).
 * Bekannte Wert-Keys (VALUE_KEYS) MÜSSEN einen Wert haben – steht keiner da
 * (Ende der Argumente oder direkt ein weiteres `--flag`), wird das als Fehler
 * gemeldet, statt still den String "true" zu setzen (sonst schriebe z. B.
 * `--out` ohne Wert in einen Ordner namens "true").
 */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;

    const eq = a.indexOf('=');
    if (eq >= 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }

    const key = a.slice(2);
    const next = argv[i + 1];
    const hasValue = next !== undefined && !next.startsWith('--');
    if (hasValue) {
      out[key] = next;
      i++;
    } else if (VALUE_KEYS.has(key)) {
      throw new Error(`Option --${key} erfordert einen Wert (z. B. --${key} <wert>).`);
    } else {
      out[key] = 'true'; // echtes Boolean-Flag (unbekannte Keys)
    }
  }
  return out;
}

/**
 * Löst die effektive Konfiguration auf. Priorität (hoch → niedrig):
 * CLI-Argument > Umgebungsvariable > Config-Datei > Default.
 * `out` ist Pflicht (kein Pfad im Repo hardcoden) und wird sonst als Fehler
 * gemeldet.
 */
export function resolveConfig(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  // Datei-Konfiguration injizierbar (Default: gitignorete nanobot.config.json).
  // Tests übergeben {}, um von einer lokal vorhandenen Datei isoliert zu sein.
  fileConfig: Partial<NanobotConfig> = loadConfigFile()
): NanobotConfig {
  const args = parseArgs(argv);
  const file = fileConfig;

  const daysRaw = args.days ?? env.NANOBOT_DAYS ?? (file.days != null ? String(file.days) : undefined);
  const days = daysRaw != null ? Number(daysRaw) : 90;
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`--days muss eine positive Ganzzahl sein (war: "${daysRaw}")`);
  }

  const out = args.out ?? env.NANOBOT_OUT ?? file.out;
  if (!out) {
    throw new Error(
      'Zielordner fehlt. Bitte --out <ordner> angeben, NANOBOT_OUT setzen ' +
      'oder out in tools/nanobot-export/nanobot.config.json hinterlegen.'
    );
  }

  const db = args.db ?? env.DB_PATH ?? file.db ?? defaultDbPath();

  return { days, out, db };
}
