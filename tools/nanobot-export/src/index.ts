#!/usr/bin/env node
/**
 * nanobot-export CLI
 *
 * Exportiert Jobs der letzten N Tage (Default 90) im nanobot-Profil als
 * jobs_processed.csv in einen Zielordner. Läuft OHNE die Electron-App unter
 * plainem Node mit eigenem better-sqlite3 (Node-ABI). Öffnet die DB read-only.
 *
 * Nutzung:
 *   tsx src/index.ts --out <ordner> [--days 90] [--db <pfad>]
 *   (oder via npm: npm start -- --out <ordner>)
 */
import { resolveConfig } from './config';
import { runExport } from './export';

function main(): void {
  let cfg;
  try {
    cfg = resolveConfig(process.argv.slice(2));
  } catch (e: any) {
    console.error(`[nanobot-export] Konfigurationsfehler: ${e.message}`);
    process.exit(2);
  }

  try {
    const { file, count, from, to } = runExport(cfg);
    console.log(`[nanobot-export] ${count} Job(s) (${from} bis ${to}) → ${file}`);
  } catch (e: any) {
    console.error(`[nanobot-export] Export fehlgeschlagen: ${e.message}`);
    process.exit(1);
  }
}

main();
