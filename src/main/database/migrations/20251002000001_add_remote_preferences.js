/**
 * Add enhanced remote work preferences to user_preferences
 * Migration: T002 - Profile Management UI
 */

exports.up = function(knex) {
  return knex.schema.table('user_preferences', (table) => {
    // Add remote work preference field (string-based)
    table.string('remote_work_preference', 50)
      .nullable()
      .comment('Remote work preference: remote_only, hybrid, on_site, flexible');

    // Add timestamp for tracking when remote_work_preference was last updated
    table.datetime('remote_work_updated_at')
      .nullable()
      .comment('Timestamp when remote_work_preference was last modified');

    // Add three new remote work preference fields (percentage-based)
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
        SELECT RAISE(ABORT, 'Remote preference range invalid: acceptable_remote_min <= preferred_remote_percentage <= acceptable_remote_max required');
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
        SELECT RAISE(ABORT, 'Remote preference range invalid: acceptable_remote_min <= acceptable_remote_percentage <= acceptable_remote_max required');
      END;
    `);
  }).then(() => {
    // Ensure acceptable_remote_min <= acceptable_remote_max when both provided
    return knex.raw(`
      CREATE TRIGGER check_remote_min_max_insert
      BEFORE INSERT ON user_preferences
      FOR EACH ROW
      WHEN NEW.acceptable_remote_min IS NOT NULL
        AND NEW.acceptable_remote_max IS NOT NULL
        AND NEW.acceptable_remote_min > NEW.acceptable_remote_max
      BEGIN
        SELECT RAISE(ABORT, 'Remote preference range invalid: acceptable_remote_min <= acceptable_remote_max required');
      END;
    `);
  }).then(() => {
    return knex.raw(`
      CREATE TRIGGER check_remote_min_max_update
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW
      WHEN NEW.acceptable_remote_min IS NOT NULL
        AND NEW.acceptable_remote_max IS NOT NULL
        AND NEW.acceptable_remote_min > NEW.acceptable_remote_max
      BEGIN
        SELECT RAISE(ABORT, 'Remote preference range invalid: acceptable_remote_min <= acceptable_remote_max required');
      END;
    `);
  }).then(() => {
    // Enforce 0..100 bounds independently for each percentage field
    return knex.raw(`
      CREATE TRIGGER check_remote_bounds_insert
      BEFORE INSERT ON user_preferences
      FOR EACH ROW
      WHEN (NEW.preferred_remote_percentage IS NOT NULL AND (NEW.preferred_remote_percentage < 0 OR NEW.preferred_remote_percentage > 100))
        OR (NEW.acceptable_remote_min IS NOT NULL AND (NEW.acceptable_remote_min < 0 OR NEW.acceptable_remote_min > 100))
        OR (NEW.acceptable_remote_max IS NOT NULL AND (NEW.acceptable_remote_max < 0 OR NEW.acceptable_remote_max > 100))
      BEGIN
        SELECT RAISE(ABORT, 'Remote preference bounds invalid: values must be between 0 and 100');
      END;
    `);
  }).then(() => {
    return knex.raw(`
      CREATE TRIGGER check_remote_bounds_update
      BEFORE UPDATE ON user_preferences
      FOR EACH ROW
      WHEN (NEW.preferred_remote_percentage IS NOT NULL AND (NEW.preferred_remote_percentage < 0 OR NEW.preferred_remote_percentage > 100))
        OR (NEW.acceptable_remote_min IS NOT NULL AND (NEW.acceptable_remote_min < 0 OR NEW.acceptable_remote_min > 100))
        OR (NEW.acceptable_remote_max IS NOT NULL AND (NEW.acceptable_remote_max < 0 OR NEW.acceptable_remote_max > 100))
      BEGIN
        SELECT RAISE(ABORT, 'Remote preference bounds invalid: values must be between 0 and 100');
      END;
    `);
  }).then(() => {
    // Add trigger to auto-update remote_work_updated_at when remote_work_preference changes
    // NOTE: Using AFTER UPDATE instead of BEFORE UPDATE due to SQLite limitations.
    // SQLite does not support directly setting NEW.column values in BEFORE triggers
    // like other databases (PostgreSQL, MySQL). The AFTER UPDATE approach with a
    // separate UPDATE statement is the standard SQLite pattern for this use case.
    return knex.raw(`
      CREATE TRIGGER update_remote_work_timestamp_on_preference
      AFTER UPDATE OF remote_work_preference ON user_preferences
      FOR EACH ROW
      WHEN NEW.remote_work_preference IS NOT OLD.remote_work_preference
      BEGIN
        UPDATE user_preferences
        SET remote_work_updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;
    `);
  }).then(() => {
    // Add trigger to set remote_work_updated_at on INSERT of percentage fields
    return knex.raw(`
      CREATE TRIGGER set_remote_work_timestamp_on_insert
      AFTER INSERT ON user_preferences
      FOR EACH ROW
      WHEN NEW.preferred_remote_percentage IS NOT NULL
        OR NEW.acceptable_remote_min IS NOT NULL
        OR NEW.acceptable_remote_max IS NOT NULL
      BEGIN
        UPDATE user_preferences
        SET remote_work_updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;
    `);
  }).then(() => {
    // Add trigger to update remote_work_updated_at when percentage fields change
    return knex.raw(`
      CREATE TRIGGER update_remote_work_timestamp_on_percentage
      AFTER UPDATE OF preferred_remote_percentage, acceptable_remote_min, acceptable_remote_max ON user_preferences
      FOR EACH ROW
      WHEN (NEW.preferred_remote_percentage IS NOT OLD.preferred_remote_percentage)
        OR (NEW.acceptable_remote_min IS NOT OLD.acceptable_remote_min)
        OR (NEW.acceptable_remote_max IS NOT OLD.acceptable_remote_max)
      BEGIN
        UPDATE user_preferences
        SET remote_work_updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;
    `);
  });
};

exports.down = function(knex) {
  // Drop triggers in reverse order
  return knex.raw('DROP TRIGGER IF EXISTS update_remote_work_timestamp_on_percentage')
    .then(() => knex.raw('DROP TRIGGER IF EXISTS set_remote_work_timestamp_on_insert'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS update_remote_work_timestamp_on_preference'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_bounds_update'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_bounds_insert'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_min_max_update'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_min_max_insert'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_range_update'))
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_remote_range_insert'))
    .then(() => {
      // Drop columns in reverse order
      return knex.schema.table('user_preferences', (table) => {
        table.dropColumn('acceptable_remote_max');
        table.dropColumn('acceptable_remote_min');
        table.dropColumn('preferred_remote_percentage');
        table.dropColumn('remote_work_updated_at');
        table.dropColumn('remote_work_preference');
      });
    });
};