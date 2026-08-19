import Database from 'better-sqlite3';
import type { JobCsvRow } from '../../../src/shared/jobCsv';

/**
 * Öffnet die DB STRIKT read-only:
 * - readonly: true      → das Tool kann/​darf nie schreiben.
 * - fileMustExist: true → keine leere DB anlegen, wenn der Pfad falsch ist.
 * Paralleler Betrieb neben der laufenden App (WAL-Modus) ist damit unbedenklich.
 */
export function openReadOnly(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

/**
 * Liest die für das nanobot-Profil nötigen Felder. Nur job_offers – keine
 * Joins/Subqueries nötig (source_name/match_category/posted_date bleiben null).
 */
export function queryJobs(db: Database.Database): JobCsvRow[] {
  // SQL snake_case → camelCase-DTO-Felder (JobCsvRow). Nicht benötigte Felder
  // (postedDate/sourceName/matchCategory) bleiben null.
  return db
    .prepare(
      `SELECT
         jo.title, jo.company,
         jo.match_score AS matchScore,
         jo.status, jo.url,
         jo.source_url AS sourceUrl,
         jo.message_id AS messageId,
         jo.created_at AS createdAt,
         NULL AS postedDate, NULL AS sourceName, NULL AS matchCategory
       FROM job_offers jo
       ORDER BY jo.created_at ASC, jo.id ASC`
    )
    .all() as JobCsvRow[];
}
