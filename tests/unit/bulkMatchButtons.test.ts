/**
 * Bulk-Matching-Buttons hängen nur an DB-weiten Zählern, nicht an der
 * gefilterten Job-Liste (CodeRabbit-Finding PR #77).
 */

import { describe, it, expect } from 'vitest';
import { getBulkMatchButtonsState } from '../../src/renderer/utils/bulkMatchButtons';

describe('getBulkMatchButtonsState', () => {
  it('Statusfilter ohne Treffer: "Alle neu matchen" bleibt aktiv, solange die DB matchbare Jobs hat', () => {
    // Die gefilterte Liste ist leer – sie ist bewusst KEIN Eingabewert der Funktion.
    const state = getBulkMatchButtonsState({ unmatchedCount: 0, rematchableCount: 3 }, false);
    expect(state.rematchAll.disabled).toBe(false);
    expect(state.matchNew).toEqual({ disabled: true, label: 'Alle gematcht' });
  });

  it('keine matchbaren Jobs in der DB → beide Buttons gesperrt', () => {
    const state = getBulkMatchButtonsState({ unmatchedCount: 0, rematchableCount: 0 }, false);
    expect(state.rematchAll.disabled).toBe(true);
    expect(state.matchNew.disabled).toBe(true);
  });

  it('"Neue matchen (N)" zeigt den DB-Zähler', () => {
    const state = getBulkMatchButtonsState({ unmatchedCount: 2, rematchableCount: 5 }, false);
    expect(state.matchNew).toEqual({ disabled: false, label: 'Neue matchen (2)' });
  });

  it('Zähler nicht ladbar: gesperrt, aber KEIN irreführendes "Alle gematcht"', () => {
    const state = getBulkMatchButtonsState({ unmatchedCount: 0, rematchableCount: 0, countsUnavailable: true }, false);
    expect(state.matchNew).toEqual({ disabled: true, label: 'Neue matchen (?)' });
    expect(state.rematchAll.disabled).toBe(true);
  });

  it('erfolgreich geladene 0 bleibt "Alle gematcht" (unterscheidet sich vom Ladefehler)', () => {
    const state = getBulkMatchButtonsState({ unmatchedCount: 0, rematchableCount: 4, countsUnavailable: false }, false);
    expect(state.matchNew).toEqual({ disabled: true, label: 'Alle gematcht' });
    expect(state.rematchAll.disabled).toBe(false);
  });

  it('laufendes Matching sperrt beide Buttons', () => {
    const state = getBulkMatchButtonsState({ unmatchedCount: 2, rematchableCount: 5 }, true);
    expect(state.rematchAll.disabled).toBe(true);
    expect(state.matchNew.disabled).toBe(true);
  });
});
