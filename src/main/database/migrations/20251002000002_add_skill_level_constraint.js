/**
 * Add CHECK constraint to skills.level column (0-10 range)
 * Migration: T003 - TypeScript SkillLevel type enforcement at DB level
 */

exports.up = function(knex) {
  return knex.raw(`
    CREATE TRIGGER check_skill_level_insert
    BEFORE INSERT ON skills
    FOR EACH ROW
    WHEN NEW.level < 0 OR NEW.level > 10
    BEGIN
      SELECT RAISE(ABORT, 'Skill level must be between 0 and 10');
    END;
  `).then(() => {
    return knex.raw(`
      CREATE TRIGGER check_skill_level_update
      BEFORE UPDATE OF level ON skills
      FOR EACH ROW
      WHEN NEW.level < 0 OR NEW.level > 10
      BEGIN
        SELECT RAISE(ABORT, 'Skill level must be between 0 and 10');
      END;
    `);
  });
};

exports.down = function(knex) {
  return knex.raw('DROP TRIGGER IF EXISTS check_skill_level_update')
    .then(() => knex.raw('DROP TRIGGER IF EXISTS check_skill_level_insert'));
};
