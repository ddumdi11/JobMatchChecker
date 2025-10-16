/**
 * Add match_score column to job_offers table
 *
 * Feature: 005-job-offer-management
 * The match_score field was implemented in jobService but the column
 * was missing from the job_offers table schema.
 */

exports.up = function(knex) {
  return knex.schema.table('job_offers', (table) => {
    // Add match_score column (0-100 range enforced at application level)
    // Note: SQLite doesn't support CHECK constraints in ALTER TABLE
    table.integer('match_score');
    table.index('match_score', 'idx_job_offers_match_score');
  });
};

exports.down = function(knex) {
  return knex.schema.table('job_offers', (table) => {
    table.dropIndex('match_score', 'idx_job_offers_match_score');
    table.dropColumn('match_score');
  });
};
