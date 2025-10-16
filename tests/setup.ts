/**
 * Vitest global setup file
 *
 * This file runs once before all tests to configure the test environment.
 * Feature: 005-job-offer-management
 */

import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Set test database path BEFORE any imports that might use it
const TEST_DATA_DIR = path.join(__dirname, 'data');
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'test.db');

// Configure environment for tests
process.env.DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

console.log(`[Test Setup] DB_PATH set to: ${TEST_DB_PATH}`);
console.log(`[Test Setup] NODE_ENV set to: test`);
console.log(`[Test Setup] ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? 'is set ✓' : 'is NOT set ✗'}`);
