import { describe, it, expect } from 'vitest';
import { blocksListKey, isCheckbox, isTypingTarget } from '../../src/renderer/utils/shortcutFocus';

const checkbox = { tagName: 'INPUT', type: 'checkbox' };
const text = { tagName: 'INPUT', type: 'text' };
const number = { tagName: 'INPUT', type: 'number' };
const textarea = { tagName: 'TEXTAREA', type: 'textarea' };
const select = { tagName: 'SELECT', type: 'select-one' };
const body = { tagName: 'BODY' };

describe('shortcutFocus', () => {
  it('erkennt nur Checkboxen als Checkbox', () => {
    expect(isCheckbox(checkbox)).toBe(true);
    for (const t of [text, number, textarea, select, body, null, undefined]) {
      expect(isCheckbox(t)).toBe(false);
    }
  });

  it('isTypingTarget: Textfelder ja, Checkbox und übrige Elemente nein', () => {
    for (const t of [text, number, textarea]) expect(isTypingTarget(t)).toBe(true);
    for (const t of [checkbox, select, body, null, undefined]) expect(isTypingTarget(t)).toBe(false);
  });

  it('blocksListKey: Checkbox gibt nur "n" frei', () => {
    expect(blocksListKey(checkbox, 'n')).toBe(false);
    for (const key of ['Delete', 'Backspace', 'Enter', 'e', 'j', 'k', 'ArrowDown', '/', ' ']) {
      expect(blocksListKey(checkbox, key)).toBe(true);
    }
  });

  it('blocksListKey: in Eingabefeldern bleibt auch "n" gesperrt', () => {
    for (const t of [text, number, textarea, select]) expect(blocksListKey(t, 'n')).toBe(true);
  });

  it('blocksListKey: außerhalb von Eingabefeldern ist alles frei', () => {
    for (const t of [body, null, undefined]) {
      expect(blocksListKey(t, 'n')).toBe(false);
      expect(blocksListKey(t, 'Delete')).toBe(false);
    }
  });
});
