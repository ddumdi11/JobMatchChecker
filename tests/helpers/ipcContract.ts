/**
 * Contract-Test-Harness für die IPC-Handler-Schicht (Issue #57, Option 3).
 *
 * Statt gegen `window.api` (Electron-Preload, in Node nicht vorhanden) zu testen,
 * prüfen wir die ECHTE Verdrahtung `handlers.ts → Services`:
 *   - `ipcMain.handle` wird gemockt und fängt jede Registrierung (Kanal → Fn).
 *   - `registerIpcHandlers()` läuft einmal und füllt die Handler-Map.
 *   - `invoke(channel, ...args)` ruft den registrierten Handler mit einem
 *     Fake-Event auf — wie es der echte IPC-Dispatch täte.
 *
 * Dadurch fällt u. a. "IPC-Handler vergessen zu registrieren" auf (invoke wirft),
 * und die Handler-Logik läuft gegen die echten Services + die Test-DB.
 *
 * Modul-Load von handlers.ts braucht nur drei Electron-Mocks: `electron`
 * (ipcMain/dialog/shell/app), `electron-log` und `electron-store` (handlers.ts
 * und aiProviderService instanziieren `new Store()` beim Load — ohne Electron-
 * Binary würde das in CI werfen; siehe ci-local-vs-runner-gaps).
 */
import { vi } from 'vitest';

// vi.hoisted: die Map muss existieren, bevor die (hochgezogene) electron-Mock-
// Factory sie referenziert.
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>() }));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: any[]) => any) => {
      handlers.set(channel, fn);
    },
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
  app: { getPath: vi.fn(() => '') },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// In-Memory-Fake für electron-store (nur die im Code genutzten Methoden).
vi.mock('electron-store', () => ({
  default: class FakeStore {
    private data: Record<string, unknown> = {};
    get(key: string): unknown {
      return this.data[key];
    }
    set(key: string, value: unknown): void {
      this.data[key] = value;
    }
    delete(key: string): void {
      delete this.data[key];
    }
  },
}));

// Handler EINMAL registrieren (Import nach den Mocks → Modul-Load ist sauber).
import { registerIpcHandlers } from '../../src/main/ipc/handlers';

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  registerIpcHandlers();
  registered = true;
}
ensureRegistered();

/** True, wenn für den Kanal ein Handler registriert wurde. */
export function isRegistered(channel: string): boolean {
  return handlers.has(channel);
}

/**
 * Ruft den registrierten IPC-Handler auf (mit Fake-Event als erstem Arg, genau
 * wie ipcMain es täte). Wirft, wenn der Kanal nicht registriert ist.
 */
export function invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
  const fn = handlers.get(channel);
  if (!fn) {
    throw new Error(`Kein IPC-Handler für Kanal "${channel}" registriert`);
  }
  return Promise.resolve(fn({}, ...args));
}

export { handlers };

// Re-Export, damit Contract-Tests die (bereits mit aktiven Mocks geladene)
// DB-Instanz nutzen können, ohne selbst db.ts zu importieren (Mock-Reihenfolge
// garantiert: db.ts wurde via handlers.ts nach den vi.mock-Calls geladen).
export { getDatabase } from '../../src/main/database/db';
