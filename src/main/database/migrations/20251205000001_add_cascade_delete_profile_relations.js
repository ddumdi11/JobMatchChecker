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
 *
 * IMPORTANT: No default profile is created by this migration.
 * The First-Run-Dialog will handle initial profile creation.
 */

exports.up = async function(knex) {
  // Step 1: Add user_profile_id to skills table with CASCADE DELETE
  // Note: nullable() allows existing skills to remain until profile is created
  // Application must set user_profile_id explicitly when creating new skills
  await knex.schema.alterTable('skills', (table) => {
    table.integer('user_profile_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('CASCADE')
      .index('idx_skills_user_profile'); // Add index for join performance
  });

  // Step 2: Add user_profile_id to user_preferences table with CASCADE DELETE
  // Note: nullable() allows existing preferences to remain until profile is created
  // Application must set user_profile_id explicitly when creating new preferences
  await knex.schema.alterTable('user_preferences', (table) => {
    table.integer('user_profile_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('CASCADE')
      .index('idx_preferences_user_profile'); // Add index for join performance
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
