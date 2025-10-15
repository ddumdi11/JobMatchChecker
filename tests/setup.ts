// Vitest setup file
import { expect, beforeAll } from 'vitest';
import { runMigrations, getDatabase } from '../src/main/database/db';

// Run database migrations before all tests
beforeAll(async () => {
  // Initialize database and run migrations
  try {
    getDatabase(); // Initialize DB
    await runMigrations(); // Run all migrations
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Failed to run database migrations:', error);
    throw error;
  }
});

// Export to ensure module is loaded
export {};
