/**
 * Initial database schema for Job Match Checker
 * Version: 1.0.0
 */

exports.up = function(knex) {
  return knex.schema
    // 1. User Profile
    .createTable('user_profile', (table) => {
      table.integer('id').primary().defaultTo(1);
      table.text('first_name').notNullable();
      table.text('last_name').notNullable();
      table.text('email').unique();
      table.text('phone');
      table.text('location');
      table.text('cv_latex_source');
      table.datetime('cv_imported_at');
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    // 2. Skill Categories
    .createTable('skill_categories', (table) => {
      table.increments('id').primary();
      table.text('name').notNullable().unique();
      table.integer('parent_id').references('id').inTable('skill_categories').onDelete('SET NULL');
      table.integer('sort_order').defaultTo(0);
    })

    // 3. Skills
    .createTable('skills', (table) => {
      table.increments('id').primary();
      table.text('name').notNullable();
      table.integer('category_id').references('id').inTable('skill_categories').onDelete('SET NULL');
      table.integer('level').notNullable().checkBetween([0, 10]);
      table.real('years_experience');
      table.boolean('verified').defaultTo(false);
      table.text('notes');
      table.text('source');
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    // 4. User Preferences
    .createTable('user_preferences', (table) => {
      table.integer('id').primary().defaultTo(1);
      table.integer('desired_salary_min');
      table.integer('desired_salary_max');
      table.text('desired_locations'); // JSON array
      table.text('remote_preference').checkIn(['onsite', 'hybrid', 'remote', 'flexible']);
      table.text('contract_types'); // JSON array
      table.date('availability_date');
      table.integer('max_commute_minutes');
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    // 5. Job Sources
    .createTable('job_sources', (table) => {
      table.increments('id').primary();
      table.text('name').notNullable().unique();
      table.text('url');
      table.boolean('api_available').defaultTo(false);
      table.text('api_config'); // JSON
      table.text('logo_url');
      table.text('notes');
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    })

    // 6. Job Offers
    .createTable('job_offers', (table) => {
      table.increments('id').primary();
      table.integer('source_id').notNullable().references('id').inTable('job_sources').onDelete('RESTRICT');
      table.text('title').notNullable();
      table.text('company').notNullable();
      table.text('url');
      table.date('posted_date').notNullable();
      table.date('deadline');
      table.text('location');
      table.text('remote_option');
      table.text('salary_range');
      table.text('contract_type');
      table.text('full_text');
      table.text('raw_import_data');
      table.text('import_method');
      table.text('notes');
      table.text('status').defaultTo('new');
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

      // Indexes
      table.index('source_id', 'idx_job_offers_source');
      table.index('posted_date', 'idx_job_offers_posted');
      table.index('status', 'idx_job_offers_status');
    })

    // 7. Matching Prompts
    .createTable('matching_prompts', (table) => {
      table.increments('id').primary();
      table.text('name').notNullable();
      table.text('prompt_text').notNullable();
      table.boolean('is_active').defaultTo(false);
      table.text('version');
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    })

    // 8. Matching Results
    .createTable('matching_results', (table) => {
      table.increments('id').primary();
      table.integer('job_id').notNullable().references('id').inTable('job_offers').onDelete('CASCADE');
      table.integer('prompt_id').notNullable().references('id').inTable('matching_prompts');
      table.integer('match_score').notNullable().checkBetween([0, 100]);
      table.text('match_category');
      table.text('gap_analysis').notNullable(); // JSON
      table.text('strengths'); // JSON
      table.text('ai_reasoning');
      table.text('api_model');
      table.integer('tokens_used');
      table.integer('processing_time_ms');
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());

      // Indexes
      table.index('job_id', 'idx_matching_job');
      table.index('match_score', 'idx_matching_score');
    })

    // 9. Reports
    .createTable('reports', (table) => {
      table.increments('id').primary();
      table.text('type').notNullable();
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.text('format').notNullable();
      table.text('file_path');
      table.text('content');
      table.text('metadata'); // JSON
      table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    })

    // 10. App Settings
    .createTable('app_settings', (table) => {
      table.text('key').primary();
      table.text('value');
      table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
    })

    // 11. Migration History
    .createTable('migration_history', (table) => {
      table.increments('id').primary();
      table.text('version').notNullable().unique();
      table.text('description');
      table.text('sql_script');
      table.text('backup_path');
      table.datetime('applied_at').notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('migration_history')
    .dropTableIfExists('app_settings')
    .dropTableIfExists('reports')
    .dropTableIfExists('matching_results')
    .dropTableIfExists('matching_prompts')
    .dropTableIfExists('job_offers')
    .dropTableIfExists('job_sources')
    .dropTableIfExists('user_preferences')
    .dropTableIfExists('skills')
    .dropTableIfExists('skill_categories')
    .dropTableIfExists('user_profile');
};
