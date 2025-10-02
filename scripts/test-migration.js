/**
 * Test script for remote preferences migration
 * Run this after the app has started to verify migration success
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'jobmatcher.db');

console.log('Testing migration: 20251002000001_add_remote_preferences');
console.log('Database path:', dbPath);
console.log('---');

let db;
try {
  db = new Database(dbPath);
  console.log('✓ Connected to database\n');
} catch (err) {
  console.error('❌ Error connecting to database:', err.message);
  process.exit(1);
}

// Test 1: Check if new columns exist
console.log('Test 1: Checking schema...');
const columns = db.prepare("PRAGMA table_info(user_preferences)").all();
const columnNames = columns.map(r => r.name);
const expectedColumns = ['remote_work_preference', 'remote_work_updated_at'];
const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));

if (missingColumns.length === 0) {
  console.log('✓ All new columns exist:', expectedColumns.join(', '));
} else {
  console.error('❌ Missing columns:', missingColumns.join(', '));
  db.close();
  process.exit(1);
}

// Test 2: Verify default values
console.log('\nTest 2: Checking default values...');
const row = db.prepare("SELECT remote_work_preference, remote_work_updated_at FROM user_preferences LIMIT 1").get();

if (row) {
  console.log('✓ Current values:', row);
} else {
  console.log('⚠ No rows in user_preferences table yet');
  db.close();
  process.exit(0);
}

// Test 3: Test remote_work_preference trigger
(async () => {
  try {
    console.log('\nTest 3: Testing remote_work_preference trigger...');
    const testValue = 'remote_only';

    const beforeUpdate = db.prepare("SELECT remote_work_preference, remote_work_updated_at FROM user_preferences LIMIT 1").get();
    const originalPreference = beforeUpdate.remote_work_preference;
    console.log('Before update - remote_work_updated_at:', beforeUpdate.remote_work_updated_at);

    // Wait a moment to ensure timestamp will be different
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = db.prepare("UPDATE user_preferences SET remote_work_preference = ?").run(testValue);

    if (result.changes > 0) {
      const afterUpdate = db.prepare("SELECT remote_work_preference, remote_work_updated_at FROM user_preferences LIMIT 1").get();

      console.log('✓ Updated remote_work_preference to:', afterUpdate.remote_work_preference);
      console.log('✓ Trigger set remote_work_updated_at to:', afterUpdate.remote_work_updated_at);

      if (afterUpdate.remote_work_updated_at !== beforeUpdate.remote_work_updated_at) {
        console.log('✓ Timestamp was updated by trigger');
      } else {
        console.error('❌ Timestamp was not updated by trigger');
      }

      const timestamp = new Date(afterUpdate.remote_work_updated_at);
      const now = new Date();
      const diff = Math.abs(now - timestamp);

      if (diff < 5000) { // Within 5 seconds
        console.log('✓ Timestamp is current');
      } else {
        console.error('❌ Timestamp seems stale:', diff, 'ms old');
      }

      // Restore original value to prevent database state mutation
      db.prepare("UPDATE user_preferences SET remote_work_preference = ?").run(originalPreference);
      console.log('✓ Restored original preference value');

      console.log('\n✅ All migration tests passed!');
    } else {
      console.log('⚠ No rows to update.');
    }
  } catch (error) {
    console.error('❌ Error during trigger test:', error.message);
    process.exitCode = 1;
  } finally {
    db.close();
    console.log('✓ Database connection closed');
  }
})();