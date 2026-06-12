import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Some tests can't run under plain Node in CI. They are excluded when CI is set
// so the suite stays green as a PR check, but remain runnable locally. Tracked
// as known issues (see GitHub issues).
const ciExcludes = process.env.CI
  ? [
      // Need an Electron renderer environment (window.api).
      'tests/contract/**',
      // Imports electron-store (instantiated at module load → needs the Electron
      // runtime) and exercises the live AI API. Runs locally with an API key.
      'tests/unit/aiExtractionService.test.ts',
      // chmod-based permission-denied simulations assume Windows semantics; on
      // Linux (CI) deletion is governed by directory perms, so they fail with
      // EACCES. Cross-platform portability issue, parked.
      'tests/main/backup/BackupManager.delete.test.ts',
    ]
  : [];

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', ...ciExcludes],
    setupFiles: ['./tests/setup.ts'],
    // FS/DB-heavy tests (per-file SQLite databases, shared backup temp dirs)
    // are not safe to run in parallel across files. Run test files serially to
    // avoid cross-file races (e.g. one backup test rm-ing another's temp dir).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
});
