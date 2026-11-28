import { useEffect, useState } from 'react';

/**
 * Markerliste für den Textschnitt (DB-Tabelle text_cut_markers), einmal pro
 * Sitzung geladen. `loaded` ist false, solange die Liste fehlt oder nicht
 * geladen werden konnte – dann zeigt die UI keinen Schnitt an.
 */
let cache: Promise<string[]> | null = null;

export function useTextCutMarkers(): { markers: string[]; loaded: boolean } {
  const [state, setState] = useState<{ markers: string[]; loaded: boolean }>({ markers: [], loaded: false });

  useEffect(() => {
    let active = true;
    if (!cache) {
      cache = window.api.getTextCutMarkers().catch(err => {
        console.error('Failed to load text cut markers:', err);
        cache = null; // beim nächsten Mal erneut versuchen
        throw err;
      });
    }
    cache
      .then(markers => { if (active) setState({ markers, loaded: true }); })
      .catch(() => { /* bereits geloggt; ohne Liste kein Schnitt in der Anzeige */ });
    return () => { active = false; };
  }, []);

  return state;
}
