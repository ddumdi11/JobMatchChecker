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

/** Minimaler `--key value` / `--key=value` Parser (keine Fremd-Deps). */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq >= 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[a.slice(2)] = next;
        i++;
      } else {
        out[a.slice(2)] = 'true'; // Flag ohne Wert
      }
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
  env: NodeJS.ProcessEnv = process.env
): NanobotConfig {
  const args = parseArgs(argv);
  const file = loadConfigFile();

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
