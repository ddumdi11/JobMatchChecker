import React, { createContext, useContext, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import { Sidebar } from './Sidebar';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

export interface UnsavedChangesContextValue {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  onSave?: () => Promise<void>;
  setOnSave: (callback: (() => Promise<void>) | undefined) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export const useUnsavedChangesContext = () => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChangesContext must be used within Layout');
  }
  return context;
};

export const Layout: React.FC = () => {
  const [isDirty, setIsDirty] = React.useState(false);
  const [onSave, setOnSave] = React.useState<(() => Promise<void>) | undefined>(() => undefined);

  // Re-enabled after migrating to createBrowserRouter (fixes #9)
  const { blocker, handleSave, handleDiscard, handleCancel } = useUnsavedChanges(isDirty, onSave);

  // Guard against browser reload/close (Issue #12)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // Chrome requires returnValue to be set
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const contextValue: UnsavedChangesContextValue = {
    isDirty,
    setIsDirty,
    onSave,
    setOnSave: (callback) => setOnSave(() => callback)
  };

  const isBlocked = blocker.state === 'blocked';
  const hasSaveAction = onSave !== undefined;

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      <Box sx={{ display: 'flex' }}>
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Unsaved Changes Dialog */}
      <Dialog open={isBlocked} onClose={handleCancel}>
        <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {hasSaveAction
              ? 'Sie haben ungespeicherte Änderungen. Möchten Sie diese speichern, bevor Sie die Seite verlassen?'
              : 'Sie haben ungespeicherte Änderungen. Möchten Sie diese verwerfen?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleDiscard} color="error">
            Verwerfen
          </Button>
          {hasSaveAction && (
            <Button onClick={handleSave} color="primary" variant="contained">
              Speichern
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
};
