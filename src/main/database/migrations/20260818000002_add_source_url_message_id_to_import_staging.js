/**
 * Add csv_source_url and csv_message_id to import_staging (nanobot Dual-URL).
 *
 * Feature: feat/dual-url-roundtrip
 *
 * jobs_with_links.csv liefert den rohen Tracking-Link (Spalte "Link") und die
 * Mail-Message-ID mit. Beide werden im Staging roh mitgeführt und beim finalen
 * Import in job_offers.source_url / job_offers.message_id übernommen (source_url
 * NIEMALS bereinigt). Für das jobs.csv-Altformat bleiben die Felder NULL.
 */

exports.up = function (knex) {
  return knex.schema.table('import_staging', (table) => {
    table.text('csv_source_url'); // roher Original-Link (nicht bereinigt!)
    table.text('csv_message_id'); // Mail-Message-ID aus jobs_with_links.csv
  });
};

exports.down = function (knex) {
  return knex.schema.table('import_staging', (table) => {
    table.dropColumn('csv_message_id');
    table.dropColumn('csv_source_url');
  });
};
