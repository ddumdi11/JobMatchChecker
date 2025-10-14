/**
 * Disk Space Utility
 *
 * Cross-platform utility to check available disk space.
 * Used by backup system to ensure sufficient space before creating backups.
 *
 * Feature: #004
 * Task: T003
 */

import { statfs } from 'node:fs';
import { promisify } from 'node:util';
import * as path from 'node:path';

const statfsAsync = promisify(statfs);

/**
 * Get available disk space for a given path
 *
 * @param targetPath - Directory or file path to check
 * @returns Available disk space in bytes
 * @throws Error if path is invalid or inaccessible
 *
 * @example
 * ```typescript
 * const available = await getAvailableDiskSpace('/path/to/backups');
 * console.log(`Available: ${(available / 1024 / 1024).toFixed(2)} MB`);
 * ```
 */
export async function getAvailableDiskSpace(targetPath: string): Promise<number> {
  try {
    // Resolve to absolute path
    const absolutePath = path.resolve(targetPath);

    // Get filesystem stats (works on Windows, macOS, Linux)
    const stats = await statfsAsync(absolutePath);

    // Calculate available space in bytes
    // bavail = available blocks for unprivileged users
    // bsize = block size in bytes
    const availableBytes = stats.bavail * stats.bsize;

    return availableBytes;
  } catch (error) {
    // Re-throw with more context
    throw new Error(
      `Failed to get disk space for path "${targetPath}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Check if there is sufficient disk space for a given operation
 *
 * @param targetPath - Directory or file path to check
 * @param requiredBytes - Required space in bytes
 * @param safetyMarginMultiplier - Safety margin (default: 1.5 = 150% of required)
 * @returns True if sufficient space is available
 *
 * @example
 * ```typescript
 * const dbSize = 50 * 1024 * 1024; // 50 MB
 * const hasSufficientSpace = await hasSufficientDiskSpace('/backups', dbSize);
 *
 * if (!hasSufficientSpace) {
 *   throw new Error('INSUFFICIENT_SPACE');
 * }
 * ```
 */
export async function hasSufficientDiskSpace(
  targetPath: string,
  requiredBytes: number,
  safetyMarginMultiplier = 1.5
): Promise<boolean> {
  const availableBytes = await getAvailableDiskSpace(targetPath);
  const requiredWithMargin = requiredBytes * safetyMarginMultiplier;

  return availableBytes >= requiredWithMargin;
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "15.73 MB")
 *
 * @example
 * ```typescript
 * formatBytes(15728640); // "15.00 MB"
 * formatBytes(1536, 0); // "2 KB"
 * ```
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
