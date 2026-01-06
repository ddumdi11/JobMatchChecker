/**
 * Add confidence and market_relevance columns to skills table
 * These fields come from Multi-LLM analysis in Skills Hub project
 *
 * - confidence: How certain the LLM analysis is about this skill (very_likely, possible)
 * - market_relevance: How relevant this skill is in the job market (high, medium, low)
 */

exports.up = function(knex) {
  return knex.schema.table('skills', (table) => {
    // Confidence from Multi-LLM analysis
    table.text('confidence').comment('LLM analysis confidence: very_likely, possible');

    // Market relevance of the skill
    table.text('market_relevance').comment('Job market relevance: high, medium, low');
  });
};

exports.down = function(knex) {
  return knex.schema.table('skills', (table) => {
    table.dropColumn('confidence');
    table.dropColumn('market_relevance');
  });
};
