/**
 * Add CASCADE DELETE constraints for profile-related tables
 * Fix for CodeRabbit Issue: Skills and preferences were orphaned on profile deletion
 *
 * This migration adds user_profile_id foreign keys with ON DELETE CASCADE to:
 * - skills table
 * - user_preferences table
 *
 * This ensures that when a user_profile is deleted, all related skills and preferences
 * are automatically removed, preventing orphaned records.
 */

exports.up = function(knex) {
  return knex.schema
    // Add user_profile_id to skills table with CASCADE DELETE
    .alterTable('skills', (table) => {
      table.integer('user_profile_id')
        .defaultTo(1)
        .notNullable()
        .references('id')
        .inTable('user_profile')
        .onDelete('CASCADE');
    })
    // Add user_profile_id to user_preferences table with CASCADE DELETE
    .alterTable('user_preferences', (table) => {
      table.integer('user_profile_id')
        .defaultTo(1)
        .notNullable()
        .references('id')
        .inTable('user_profile')
        .onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('skills', (table) => {
      table.dropColumn('user_profile_id');
    })
    .alterTable('user_preferences', (table) => {
      table.dropColumn('user_profile_id');
    });
};
