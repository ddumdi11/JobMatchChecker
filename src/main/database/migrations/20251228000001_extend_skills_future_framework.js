/**
 * Extend skills table for Future Skills Framework 2030 support
 * Migration: Add columns for skill classification, assessment method, certifications
 * Reference: Stifterverband Future Skills Framework 2030
 */

exports.up = function(knex) {
  return knex.schema.table('skills', (table) => {
    // Skill type classification
    table.text('skill_type').comment('Classification: technical/transformative/foundational/digital/community');

    // Future Skills Framework 2030 specific category
    table.text('future_skill_category').comment('Future Skills 2030 category: grundlegend/transformativ/gemeinschaft/digital/technologisch/traditional');

    // Assessment and validation
    table.text('assessment_method').comment('How skill level was determined: self/verified/tested/certified');

    // Certifications (JSON array or comma-separated)
    table.text('certifications').comment('Related certifications, comma-separated or JSON');

    // Last assessment date
    table.datetime('last_assessed').comment('When the skill was last evaluated/updated');

    // Additional context is already covered by existing 'notes' column
  });
};

exports.down = function(knex) {
  return knex.schema.table('skills', (table) => {
    table.dropColumn('skill_type');
    table.dropColumn('future_skill_category');
    table.dropColumn('assessment_method');
    table.dropColumn('certifications');
    table.dropColumn('last_assessed');
  });
};
