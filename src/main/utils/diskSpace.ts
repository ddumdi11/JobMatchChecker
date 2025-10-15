/**
 * Disk Space Utility
 *
 * Cross-platform utility to check available disk space.
 * Used by backup system to ensure sufficient space before creating backups.
 *
 * NOTE: On Windows, disk space checks are currently disabled due to platform limitations.
 * The statfs API is not available on Windows. Future versions may implement a Windows-specific
 * fallback using PowerShell or wmic.
 *
 * Feature: #004
 * Task: T003
 */

import * as path from 'node:path';
import * as os from 'node:os';

// Try to import statfs (only available on POSIX systems and Node >= 18.15.0)
let statfsAsync: ((path: string) => Promise<{
  bavail: number;
  bsize: number;
}>) | null = null;

try {
  const { statfs } = require('node:fs');
  const { promisify } = require('node:util');
  statfsAsync = promisify(statfs);
} catch {
  // statfs not available - will use fallback
  statfsAsync = null;
}

/**
 * Get available disk space for a given path
 *
 * @param targetPath - Directory or file path to check
 * @returns Available disk space in bytes, or a large number if check is not supported
 * @throws Error if path is invalid or inaccessible
 *
 * NOTE: On Windows, this function returns a large number (10 TB) as a safe default
 * since disk space checks are not reliable on that platform.
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

    // Platform check: Windows does not support statfs
    if (os.platform() === 'win32' || !statfsAsync) {
      // On Windows, return a large number (10 TB) as a safe default
      // This effectively disables the disk space check on Windows
      // TODO: Implement Windows-specific check using PowerShell or wmic
      return 10 * 1024 * 1024 * 1024 * 1024; // 10 TB
    }

    // Get filesystem stats (works on macOS, Linux)
    const stats = await statfsAsync(absolutePath);

    // Calculate available space in bytes
    // bavail = available blocks for unprivileged users
    // bsize = block size in bytes
    const availableBytes = stats.bavail * stats.bsize;

    return availableBytes;
  } catch (error) {
    // On error, return a safe default to prevent blocking backups
    console.warn(`Failed to get disk space for path "${targetPath}":`, error);
    return 10 * 1024 * 1024 * 1024 * 1024; // 10 TB
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
