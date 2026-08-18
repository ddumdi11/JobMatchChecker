/**
 * Add source_url and message_id columns to job_offers (nanobot-Rückkanal).
 *
 * Feature: feat/dual-url-roundtrip
 *
 * Hintergrund: Das Rückkanal-Matching (jobs_processed.csv → nanobot-Pipeline)
 * über die bereinigte `url` schlägt real fehl, weil die Pipeline die ORIGINAL-
 * Tracking-Links als Schlüssel führt (XING `…/m/<token>`, LinkedIn `…/view/<id>/`).
 * Deshalb Dual-URL:
 *   - `source_url`  = roher Original-Link aus jobs_with_links.csv (Spalte "Link"),
 *                     NIEMALS durch cleanJobUrl geschickt — byte-identisch zum Import.
 *   - `message_id`  = Mail-Message-ID aus jobs_with_links.csv.
 *   - Die bestehende `url` bleibt Anzeige-/Dedup-URL (cleanJobUrl/getJobUrlKey und
 *     das komplette Dubletten-Feature bleiben unverändert auf `url`).
 *
 * Bestand: NULL in beiden Feldern ist ok — der Rückkanal gilt ab jetzt.
 */

exports.up = function (knex) {
  return knex.schema.table('job_offers', (table) => {
    table.text('source_url'); // roher Tracking-Link (nicht bereinigt!)
    table.text('message_id'); // Mail-Message-ID aus jobs_with_links.csv
  });
};

exports.down = function (knex) {
  return knex.schema.table('job_offers', (table) => {
    table.dropColumn('message_id');
    table.dropColumn('source_url');
  });
};
