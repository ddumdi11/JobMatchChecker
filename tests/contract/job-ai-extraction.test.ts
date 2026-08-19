/**
 * Contract test for the extractJobFields IPC handler (Issue #57, Option 3).
 *
 * ⚠️ BEWUSST SCHLANK: Diese Datei prüft NUR den Handler-Contract der IPC-Schicht —
 * Kanal registriert, Argument unverändert an den Service durchgereicht,
 * Service-Ergebnis unverfälscht zurück, Fehler als Rejection propagiert.
 *
 * Die EXTRAKTIONS-SEMANTIK (Titel/Firma erkennen, missingRequired, 5-Sek-Timeout,
 * Confidence-Warnings) liegt BEWUSST NUR in der Live-API-Suite
 * `tests/unit/aiExtractionService.test.ts` (in CI ausgeschlossen, läuft mit
 * gesetztem ANTHROPIC_API_KEY). Sie hier mit einem Provider-Mock nachzubilden wäre
 * Doppel-Coverage mit dünnerem Aussagewert — dieselbe Sorte Testtheater, die wir
 * bei Option 2 abgelehnt haben. Wer volle Extraktions-Abdeckung sucht: dort, nicht hier.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Service an der Grenze mocken: der Handler-Contract testet die Verdrahtung, nicht
// die Extraktion. vi.hoisted, damit die (hochgezogene) Mock-Factory die Fn kennt.
const { extractJobFieldsMock } = vi.hoisted(() => ({ extractJobFieldsMock: vi.fn() }));
vi.mock('../../src/main/services/aiExtractionService', () => ({
  extractJobFields: extractJobFieldsMock,
}));

import { invoke, isRegistered } from '../helpers/ipcContract';

describe('Contract: extractJobFields IPC-Handler (Handler-Schicht, schlank)', () => {
  beforeEach(() => {
    extractJobFieldsMock.mockReset();
  });

  it('registriert den Kanal extractJobFields', () => {
    expect(isRegistered('extractJobFields')).toBe(true);
  });

  it('reicht den Text unverändert an den Service durch', async () => {
    extractJobFieldsMock.mockResolvedValue({ success: true, fields: {}, confidence: 'low', missingRequired: [] });

    await invoke('extractJobFields', 'Stellentext XYZ');

    expect(extractJobFieldsMock).toHaveBeenCalledTimes(1);
    expect(extractJobFieldsMock).toHaveBeenCalledWith('Stellentext XYZ');
  });

  it('gibt das Service-Ergebnis unverfälscht zurück', async () => {
    const serviceResult = { success: true, fields: { title: 'X' }, confidence: 'high', missingRequired: [] };
    extractJobFieldsMock.mockResolvedValue(serviceResult);

    const result = await invoke('extractJobFields', 'irgendein Text');

    expect(result).toBe(serviceResult); // exakt dieselbe Referenz, nichts umgeformt
  });

  it('propagiert Service-Fehler als Rejection (nicht als Rückgabewert)', async () => {
    extractJobFieldsMock.mockRejectedValue(new Error('AI-Service kaputt'));

    await expect(invoke('extractJobFields', 'Text')).rejects.toThrow('AI-Service kaputt');
  });
});
