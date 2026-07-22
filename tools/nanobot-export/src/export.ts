import * as fs from 'fs';
import * as path from 'path';
import {
  serializeJobsCsv,
  localDateInRange,
  toLocalIsoDate
} from '../../../src/shared/jobCsv';
import type { NanobotConfig } from './config';
import { openReadOnly, queryJobs } from './db';

export const OUTPUT_FILENAME = 'jobs_processed.csv';

/**
 * Lokales Datumsfenster für "letzte N Tage inklusive heute":
 * from = heute − (N−1), to = heute (beide inklusiv, lokale ISO-Tage).
 * Konsistent zum App-Default (letzte 7 Tage = heute−6 … heute).
 */
export function windowForDays(days: number, today: Date): { from: string; to: string } {
  const to = toLocalIsoDate(today);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const from = toLocalIsoDate(start);
  return { from, to };
}

export interface ExportResult {
  file: string;
  count: number;
  from: string;
  to: string;
}

/**
 * Führt den Export aus: read-only öffnen, Jobs der letzten N Tage (created_at,
 * lokaler Tag) im nanobot-Profil serialisieren und nach <out>/jobs_processed.csv
 * schreiben. Schreibt NIE in die DB.
 */
export function runExport(cfg: NanobotConfig, today: Date = new Date()): ExportResult {
  const { from, to } = windowForDays(cfg.days, today);

  const db = openReadOnly(cfg.db);
  try {
    const rows = queryJobs(db).filter(r => localDateInRange(r.created_at, from, to));
    const { csv, count } = serializeJobsCsv(rows, 'nanobot');

    fs.mkdirSync(cfg.out, { recursive: true });
    const file = path.join(cfg.out, OUTPUT_FILENAME);
    fs.writeFileSync(file, csv, 'utf-8');

    return { file, count, from, to };
  } finally {
    db.close();
  }
}
