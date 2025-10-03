import { useBlocker } from 'react-router-dom';

export interface UseUnsavedChangesResult {
  blocker: ReturnType<typeof useBlocker>;
  handleSave: () => Promise<void>;
  handleDiscard: () => void;
  handleCancel: () => void;
}

export function useUnsavedChanges(
  isDirty: boolean,
  onSave?: () => Promise<void>
): UseUnsavedChangesResult {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const handleSave = async () => {
    if (onSave) {
      try {
        await onSave();
        blocker.proceed?.();
      } catch (error) {
        console.error('Failed to save:', error);
        // Don't proceed if save fails
      }
    } else {
      blocker.proceed?.();
    }
  };

  const handleDiscard = () => {
    blocker.proceed?.();
  };

  const handleCancel = () => {
    blocker.reset?.();
  };

  return {
    blocker,
    handleSave,
    handleDiscard,
    handleCancel
  };
}
