/**
 * Entscheidet, ob ein fokussiertes Element Tastenkürzel sperrt.
 *
 * Eine Checkbox ist technisch ein INPUT, nimmt aber keinen Text entgegen. Nach
 * dem An- oder Abwählen einer Zeile behält sie den Fokus – "n" und Ctrl+N
 * blieben dadurch in der Job-Liste wirkungslos.
 */

type FocusTarget = Partial<Pick<HTMLInputElement, 'tagName' | 'type'>> | null | undefined;

export function isCheckbox(target: FocusTarget): boolean {
  return target?.tagName === 'INPUT' && target.type === 'checkbox';
}

/** Für useKeyboardShortcut: Tippt der Nutzer gerade Text? */
export function isTypingTarget(target: FocusTarget): boolean {
  return ['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '') && !isCheckbox(target);
}

/**
 * Für die Einzeltasten der Job-Liste. Auf einer Checkbox ist nur "n" frei:
 * Entf/Backspace sollen dort nicht versehentlich den Löschdialog öffnen, und
 * die übrigen Tasten behalten ihr bisheriges Verhalten.
 */
export function blocksListKey(target: FocusTarget, key: string): boolean {
  if (isCheckbox(target)) return key !== 'n';
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
}
