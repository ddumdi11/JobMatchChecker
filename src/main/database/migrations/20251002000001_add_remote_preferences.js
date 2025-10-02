/**
 * Add enhanced remote work preferences to user_preferences
 * Migration: T002 - Profile Management UI
 */

exports.up = function(knex) {
  return knex.schema.table('user_preferences', (table) => {
    // Add three new remote work preference fields
    table.integer('preferred_remote_percentage')
      .unsigned()
      .nullable()
      .comment('Preferred remote work percentage (0-100)');

    table.integer('acceptable_remote_min')
      .unsigned()
      .nullable()
      .comment('Minimum acceptable remote work percentage (0-100)');

    table.integer('acceptable_remote_max')
      .unsigned()
      .nullable()
      .comment('Maximum acceptable remote work percentage (0-100)');
  }).then(() => {
    // Add CHECK constraint to ensure: acceptableRemoteMin <= preferredRemotePercentage <= acceptableRemoteMax
    // SQLite syntax for adding constraint
    return knex.raw(`
      CREATE TRIGGER check_remote_range_insert
      BEFORE INSERT ON user_preferences
      FOR EACH ROW
      WHEN NEW.acceptable_remote_min IS NOT NULL
        AND NEW.preferred_remote_percentage IS NOT NULL
        AND NEW.acceptable_remote_max IS NOT NULL
        AND (NEW.acceptable_remote_min > NEW.preferred_remote_percentage
          OR NEW.preferred_remote_percentage > NEW.acceptable_remote_max)
      BEGIN
        SELECT RAISE(ABORT, 'Remote preference range invalid: acceptableRemoteMin <= preferredRemotePercentage <= acceptableRemoteMax required');
      END;
    `);
  }).then(() => {
    return knex.raw(`
      CREATE TRIGGER check_remote_range_update
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW
      WHEN NEW.acceptable_remote_min IS NOT NULL
        AND NEW.preferred_remote_percentage IS NOT NULL
        AND NEW.acceptable_remote_max IS NOT NULL
        AND (NEW.acceptable_remote_min > NEW.preferred_remote_percentage
          OR NEW.preferred_remote_percentage > NEW.acceptable_remote_max)
      BEGIN
        SELECT RAISE(ABORT, 'Remote preference range invalid: acceptableRemoteMin <= preferredRemotePercentage <= acceptableRemoteMax required');
      END;
    `);
  });
};

exports.down = function(knex) {
  return knex.raw('DROP TRIGGER IF EXISTS check_remote_range_update')
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_range_insert'))
    .then(() => {
      return knex.schema.table('user_preferences', (table) => {
        table.dropColumn('acceptable_remote_max');
        table.dropColumn('acceptable_remote_min');
        table.dropColumn('preferred_remote_percentage');
      });
    });
};