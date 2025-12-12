/**
 * Migration: Add import staging table for CSV imports
 *
 * This table temporarily holds imported job data from CSV files
 * before they are reviewed and imported into job_offers.
 */

exports.up = function(knex) {
  return knex.schema
    // Import Sessions - tracks each CSV import batch
    .createTable('import_sessions', (table) => {
      table.increments('id').primary();
      table.text('filename').notNullable();
      table.integer('total_rows').notNullable().defaultTo(0);
      table.integer('processed_rows').notNullable().defaultTo(0);
      table.integer('imported_rows').notNullable().defaultTo(0);
      table.integer('skipped_rows').notNullable().defaultTo(0);
      table.integer('duplicate_rows').notNullable().defaultTo(0);
      table.text('status').notNullable().defaultTo('pending'); // pending, in_progress, completed, cancelled
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
      table.datetime('completed_at');
    })

    // Import Staging - holds individual rows from CSV
    .createTable('import_staging', (table) => {
      table.increments('id').primary();
      table.integer('session_id').notNullable().references('id').inTable('import_sessions').onDelete('CASCADE');

      // Original CSV data
      table.integer('csv_row_id'); // Original ID from CSV
      table.text('csv_url');
      table.text('csv_title');
      table.text('csv_content'); // full_text from CSV
      table.text('csv_from_email'); // Source detection (XING, LinkedIn, etc.)
      table.text('csv_email_date');
      table.text('csv_raw_data'); // Complete original row as JSON

      // Processing status
      table.text('status').notNullable().defaultTo('pending');
      // pending = not yet reviewed
      // duplicate = exact URL match found
      // likely_duplicate = similar title/company found
      // new = no match, ready to import
      // imported = successfully created as job_offer
      // skipped = user chose to skip

      // Duplicate detection results
      table.integer('matched_job_id').references('id').inTable('job_offers').onDelete('SET NULL');
      table.integer('duplicate_score'); // 0-100, how confident is the duplicate match
      table.text('duplicate_reason'); // Why it was flagged (url_match, title_match, etc.)

      // Extracted fields (after AI extraction, before final import)
      table.text('extracted_title');
      table.text('extracted_company');
      table.text('extracted_location');
      table.text('extracted_remote_option');
      table.text('extracted_salary_range');
      table.text('extracted_contract_type');
      table.date('extracted_posted_date');
      table.date('extracted_deadline');
      table.integer('extracted_source_id').references('id').inTable('job_sources').onDelete('SET NULL');

      // Final import reference
      table.integer('imported_job_id').references('id').inTable('job_offers').onDelete('SET NULL');

      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
      table.datetime('processed_at');

      // Indexes for efficient querying
      table.index('session_id', 'idx_staging_session');
      table.index('status', 'idx_staging_status');
      table.index('csv_url', 'idx_staging_url');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('import_staging')
    .dropTableIfExists('import_sessions');
};
