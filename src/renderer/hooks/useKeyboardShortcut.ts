import { useEffect, useCallback } from 'react';

interface ShortcutOptions {
  disabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Custom hook for keyboard shortcuts
 *
 * @param shortcut - Key combination (e.g., 'ctrl+s', 'ctrl+shift+n')
 * @param callback - Function to execute when shortcut is triggered
 * @param options - Optional configuration
 *
 * @example
 * useKeyboardShortcut('ctrl+s', handleSave, { disabled: !hasChanges });
 * useKeyboardShortcut('ctrl+m', handleMatch, { disabled: isMatching });
 */
export function useKeyboardShortcut(
  shortcut: string,
  callback: () => void,
  options: ShortcutOptions = {}
) {
  const { disabled = false, preventDefault = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      // Parse the shortcut string
      const parts = shortcut.toLowerCase().split('+');
      const key = parts[parts.length - 1];
      const requiresCtrl = parts.includes('ctrl') || parts.includes('control');
      const requiresShift = parts.includes('shift');
      const requiresAlt = parts.includes('alt');
      const requiresMeta = parts.includes('meta') || parts.includes('cmd');

      // Check modifiers
      const ctrlMatch = requiresCtrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = requiresShift === event.shiftKey;
      const altMatch = requiresAlt === event.altKey;
      const metaMatch = requiresMeta === event.metaKey;

      // Check the actual key
      const keyMatch = event.key.toLowerCase() === key;

      // Don't trigger if user is typing in an input/textarea (unless it's a save shortcut)
      const isTyping = ['INPUT', 'TEXTAREA'].includes(
        (event.target as HTMLElement)?.tagName
      );
      const isSaveShortcut = shortcut.toLowerCase() === 'ctrl+s';

      if (isTyping && !isSaveShortcut) return;

      if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback();
      }
    },
    [shortcut, callback, disabled, preventDefault]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
