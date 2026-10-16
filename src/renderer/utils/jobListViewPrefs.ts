/**
 * Reine Ansichts-Einstellungen der Job-Liste (pro Rechner, nicht in der DB).
 *
 * localStorage kann fehlen oder werfen (z. B. Tests, gesperrter Speicher) –
 * deshalb jeder Zugriff in try/catch mit sicherem Default. Die Storage wird
 * injiziert, damit die Logik ohne Renderer-Umgebung testbar ist.
 */

export const SHOW_ID_COLUMN_KEY = 'jobList.showIdColumn';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** ID-Spalte anzeigen? Default: aus. */
export function readShowIdColumn(storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    return storage?.getItem(SHOW_ID_COLUMN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeShowIdColumn(value: boolean, storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.setItem(SHOW_ID_COLUMN_KEY, value ? 'true' : 'false');
  } catch {
    // Nicht kritisch: Einstellung gilt dann nur für diese Sitzung
  }
}
