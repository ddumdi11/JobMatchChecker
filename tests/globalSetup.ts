/**
 * Vitest globalSetup – läuft EINMAL im Hauptprozess, bevor die Test-Worker
 * geforkt werden. Hier gesetzte process.env-Werte werden von den Workern als
 * echte OS-Env geerbt, sodass glibc die Zeitzone beim ersten Date-Aufruf im
 * Worker korrekt liest. (Ein `process.env.TZ` IM Testfile käme zu spät –
 * setup.ts nutzt Date bereits, und glibc cached die Zone.)
 *
 * Zweck: deterministische, plattformunabhängige Zeitzone für date-sensitive
 * Tests (z. B. der UTC-Mitternachts-Tageswechsel in jobsCsvExport) – auch für
 * Mitwirkende, deren Maschine nicht ohnehin auf Europe/Berlin steht. In CI wird
 * TZ zusätzlich als OS-Env gesetzt (.github/workflows/test.yml).
 */
export default function setup(): void {
  if (!process.env.TZ) {
    process.env.TZ = 'Europe/Berlin';
  }
}
